-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731121642 · nexus_api_raw_layer
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- ============================================================
-- NEXUS API — Couche RAW (données brutes, immuables, insert-only)
-- Une ligne brute n'est jamais modifiée après réception, seulement
-- archivée. Le suivi de normalisation est déporté dans une table
-- séparée (normalization_state) pour ne jamais muter la donnée brute.
-- ============================================================

create table if not exists public.raw_sales (
  id                    uuid primary key default gen_random_uuid(),
  site                  text not null references public.sites(site_id),
  source                text not null references public.integration_sources(code),
  external_id           text not null,               -- identifiant côté logiciel externe
  external_updated_at   timestamptz not null,         -- pilote la synchronisation différentielle
  payload               jsonb not null,               -- la ligne telle que reçue, intacte
  recu_le               timestamptz not null default now(),
  unique(site, source, external_id, external_updated_at)
);
comment on table public.raw_sales is 'Ventes reçues du connecteur caisse, conservées exactement telles quelles. Insert-only.';
create table if not exists public.raw_products (
  id                    uuid primary key default gen_random_uuid(),
  site                  text not null references public.sites(site_id),
  source                text not null references public.integration_sources(code),
  external_id           text not null,
  external_updated_at   timestamptz not null,
  payload               jsonb not null,
  recu_le               timestamptz not null default now(),
  unique(site, source, external_id, external_updated_at)
);
comment on table public.raw_products is 'Catalogue produit reçu du connecteur caisse, conservé tel quel. Insert-only.';
create table if not exists public.raw_stock_movements (
  id                    uuid primary key default gen_random_uuid(),
  site                  text not null references public.sites(site_id),
  source                text not null references public.integration_sources(code),
  external_id           text not null,
  external_updated_at   timestamptz not null,
  payload               jsonb not null,
  recu_le               timestamptz not null default now(),
  unique(site, source, external_id, external_updated_at)
);
comment on table public.raw_stock_movements is 'Mouvements de stock reçus du connecteur caisse, conservés tels quels. Insert-only.';
create table if not exists public.raw_cash_sessions (
  id                    uuid primary key default gen_random_uuid(),
  site                  text not null references public.sites(site_id),
  source                text not null references public.integration_sources(code),
  external_id           text not null,
  external_updated_at   timestamptz not null,
  payload               jsonb not null,
  recu_le               timestamptz not null default now(),
  unique(site, source, external_id, external_updated_at)
);
comment on table public.raw_cash_sessions is 'Sessions de caisse (ouverture/fermeture) reçues du connecteur, conservées telles quelles. Insert-only.';
create table if not exists public.normalization_state (
  id            uuid primary key default gen_random_uuid(),
  raw_table     text not null check (raw_table in ('raw_sales','raw_products','raw_stock_movements','raw_cash_sessions')),
  raw_id        uuid not null,
  statut        text not null default 'en_attente' check (statut in ('en_attente','normalise','echec')),
  normalise_le  timestamptz,
  erreur        text,
  unique(raw_table, raw_id)
);
comment on table public.normalization_state is 'Suivi de l''état de normalisation d''une ligne brute, séparé de la couche RAW pour préserver son immutabilité stricte.';
create table if not exists public.integration_errors (
  id            uuid primary key default gen_random_uuid(),
  site          text not null,
  source        text,
  raw_table     text,
  raw_id        uuid,
  code          text not null,           -- ex. MISSING_FIELD, INVALID_FIELD, UNKNOWN_REFERENCE
  message       text not null,
  payload       jsonb,                    -- snapshot de la donnée en cause, pour diagnostic
  request_id    text,
  cree_le       timestamptz not null default now()
);
comment on table public.integration_errors is 'Anomalies détectées à la réception ou à la normalisation — rejet explicite, jamais de valeur inventée.';
create index if not exists idx_integration_errors_site_date on public.integration_errors(site, cree_le desc);
create table if not exists public.synchronization_history (
  id              uuid primary key default gen_random_uuid(),
  site            text not null references public.sites(site_id),
  source          text not null references public.integration_sources(code),
  domaine         text not null check (domaine in ('sales','products','stock','cash')),
  demarre_le      timestamptz not null default now(),
  termine_le      timestamptz,
  statut          text not null default 'en_cours' check (statut in ('en_cours','succes','echec_partiel','echec')),
  nb_recus        integer not null default 0,
  nb_erreurs      integer not null default 0,
  dernier_curseur text,                    -- (updated_at,id) composite ou curseur opaque fourni par la source
  message         text
);
comment on table public.synchronization_history is 'Historique des synchronisations différentielles — sert aussi de source du dernier curseur réussi par (site, source, domaine).';
create index if not exists idx_sync_history_lookup on public.synchronization_history(site, source, domaine, termine_le desc);
alter table public.raw_sales enable row level security;
alter table public.raw_products enable row level security;
alter table public.raw_stock_movements enable row level security;
alter table public.raw_cash_sessions enable row level security;
alter table public.normalization_state enable row level security;
alter table public.integration_errors enable row level security;
alter table public.synchronization_history enable row level security;
-- Aucune policy permissive : accès exclusif via service_role (Edge Functions).;
