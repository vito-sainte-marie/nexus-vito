-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830224649 · inventaire_stock_localise_releves
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists public.inventaire_stock_localise_releves (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  produit_id uuid not null references public.inventaire_zone_produit(id) on delete cascade,
  zone_id uuid not null references public.inventaire_zones(id) on delete restrict,
  quantite_base numeric not null check (quantite_base >= 0),
  quantite_conditionnement numeric not null default 0 check (quantite_conditionnement >= 0),
  quantite_unitaire numeric not null default 0 check (quantite_unitaire >= 0),
  facteur_conditionnement numeric not null default 1 check (facteur_conditionnement > 0),
  unite_conditionnement text,
  employee_id uuid,
  releve_le timestamptz not null default now(),
  commentaire text,
  created_at timestamptz not null default now()
);
create index if not exists idx_inventaire_stock_localise_site_produit_zone_date
  on public.inventaire_stock_localise_releves(site, produit_id, zone_id, releve_le desc);
alter table public.inventaire_stock_localise_releves enable row level security;
drop policy if exists select_inventaire_stock_localise_releves on public.inventaire_stock_localise_releves;
create policy select_inventaire_stock_localise_releves on public.inventaire_stock_localise_releves for select using (site = current_employee_site_id());
drop policy if exists ecriture_inventaire_stock_localise_releves on public.inventaire_stock_localise_releves;
create policy ecriture_inventaire_stock_localise_releves on public.inventaire_stock_localise_releves for insert with check ((current_employee_role() = any(array['manager'::text,'gerant'::text])) and site = current_employee_site_id());
