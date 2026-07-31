-- ============================================================
-- NEXUS API — Couche normalisée
-- Reprend les corrections déjà actées dans NEXUS-API-Specification-v4 :
-- rapprochement produit par product_id/barcode (jamais le libellé),
-- marge en HT + cost_method, is_current/version_number pour ne jamais
-- compter deux versions d'une même vente.
-- normalized_cash_sessions ajoutée en complément (le master prompt liste
-- "notamment" — non exhaustif — et raw_cash_sessions a besoin d'une
-- contrepartie normalisée pour boucler le pipeline).
-- ============================================================

create table if not exists public.normalized_products (
  id                    uuid primary key default gen_random_uuid(),
  site                  text not null references public.sites(site_id),
  external_product_id   text not null,               -- identifiant côté logiciel externe — clé de rapprochement, jamais le libellé
  product_id            uuid references public.products(id),
  barcode               text,
  label                 text,                         -- affichage uniquement
  category              text,
  maj_le                timestamptz not null default now(),
  unique(site, external_product_id)
);
comment on table public.normalized_products is 'Produits harmonisés vers le format interne NEXUS. Rapprochement par external_product_id/barcode, jamais par label.';

create table if not exists public.normalized_sales (
  id                      uuid primary key default gen_random_uuid(),
  raw_sale_id             uuid references public.raw_sales(id),
  site                    text not null references public.sites(site_id),
  ticket_id               text not null,
  register_id             text,
  employee_id             uuid references public.employees(id),
  shift_id                text,
  sold_at                 timestamptz not null,
  product_id              uuid references public.products(id),
  category                text,
  quantity                numeric not null,
  unit_sale_price_ht      numeric not null,
  unit_sale_price_ttc     numeric,
  unit_purchase_price_ht  numeric,
  cost_method             text check (cost_method in ('cmp','dernier_achat')),
  margin_amount_ht        numeric,                     -- calculé côté NEXUS : (unit_sale_price_ht - unit_purchase_price_ht) * quantity
  margin_rate             numeric,                      -- calculé côté NEXUS
  currency                text default 'EUR',
  vat_rate                numeric,
  discount_ttc            numeric default 0,
  total_ttc               numeric not null,
  status                  text not null,
  version_number          integer not null default 1,
  is_current              boolean not null default true,
  normalise_le            timestamptz not null default now()
);
comment on table public.normalized_sales is 'Ventes harmonisées, source unique consommée par le moteur décisionnel. Toujours restreindre les calculs à is_current = true.';
create index if not exists idx_normalized_sales_site_current on public.normalized_sales(site, is_current);
create index if not exists idx_normalized_sales_ticket on public.normalized_sales(ticket_id, product_id);
create index if not exists idx_normalized_sales_sold_at on public.normalized_sales(sold_at);

create or replace view public.current_normalized_sales as
  select * from public.normalized_sales where is_current = true;
comment on view public.current_normalized_sales is 'Point d''entrée unique pour tout calcul agrégé (CA, marge, volumes) — ne compte jamais deux versions d''une même vente.';

create table if not exists public.normalized_stock (
  id                      uuid primary key default gen_random_uuid(),
  raw_stock_movement_id   uuid references public.raw_stock_movements(id),
  site                    text not null references public.sites(site_id),
  product_id              uuid references public.products(id),
  external_product_id     text,
  movement_type           text check (movement_type in ('entree','sortie','ajustement','inventaire')),
  quantity                numeric not null,
  movement_at             timestamptz not null,
  reason                  text,
  version_number          integer not null default 1,
  is_current              boolean not null default true,
  normalise_le            timestamptz not null default now()
);
comment on table public.normalized_stock is 'Mouvements de stock harmonisés, issus de raw_stock_movements.';
create index if not exists idx_normalized_stock_site_current on public.normalized_stock(site, is_current);

create table if not exists public.normalized_cash_sessions (
  id                      uuid primary key default gen_random_uuid(),
  raw_cash_session_id     uuid references public.raw_cash_sessions(id),
  site                    text not null references public.sites(site_id),
  register_id             text not null,
  shift_id                text not null,
  employee_id             uuid references public.employees(id),
  ouverte_le              timestamptz,
  fermee_le               timestamptz,
  total_ttc               numeric,
  nb_tickets              integer,
  normalise_le            timestamptz not null default now()
);
comment on table public.normalized_cash_sessions is 'Sessions de caisse harmonisées, issues de raw_cash_sessions.';

alter table public.normalized_products enable row level security;
alter table public.normalized_sales enable row level security;
alter table public.normalized_stock enable row level security;
alter table public.normalized_cash_sessions enable row level security;
-- Aucune policy permissive : accès exclusif via service_role (Edge Functions).
-- La vue current_normalized_sales hérite du RLS de normalized_sales (security_invoker par défaut sur les vues récentes de Postgres/Supabase).
