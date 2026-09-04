-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803015407 · inventaire_supervision_configurable
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- NEXUS Inventaire — Supervision configurable (02/08/2026)
-- Additive uniquement : aucune donnée existante n'est renommée
-- ni supprimée. Les comptages terrain restent inchangés.
-- ============================================================

-- 1) Paramètres de contrôle inventaire, par site.
alter table public.station_config
  add column if not exists parametres_inventaire jsonb not null default jsonb_build_object(
    'reviewFrequency', 'daily',
    'weeklyReviewDay', 1,
    'monthlyReviewDay', 1,
    'reviewTime', '20:00',
    'quantityAlertThreshold', 1,
    'valueAlertThreshold', null,
    'immediateAlertCategoryIds', '[]'::jsonb,
    'closureDelayMinutes', 30,
    'immediateAlertsEnabled', true
  );

comment on column public.station_config.parametres_inventaire is
  'Paramètres de supervision inventaire (fréquence de contrôle manager, seuils, catégories sensibles). Ne modifie jamais la fréquence de comptage terrain.';

-- 2) Alertes persistantes : élargir le vocabulaire de statut.
alter table public.inventaire_alertes drop constraint if exists inventaire_alertes_statut_check;
alter table public.inventaire_alertes add constraint inventaire_alertes_statut_check
  check (statut = ANY (ARRAY['ouverte','en_cours','resolue','ignoree','archivee']));

alter table public.inventaire_alertes add column if not exists vue_le timestamptz;
alter table public.inventaire_alertes add column if not exists vue_par uuid references public.employees(id);

comment on column public.inventaire_alertes.vue_le is
  'Horodatage de première consultation par un manager. NULL = anomalie jamais vue (équivalent "new").';

-- 3) Historique des synthèses de contrôle.
create table if not exists public.inventory_reviews (
  id uuid primary key default gen_random_uuid(),
  site text not null references public.sites(site_id),
  review_type text not null check (review_type = ANY (ARRAY['daily','weekly','monthly','exception_only'])),
  period_start date not null,
  period_end date not null,
  generated_at timestamptz not null default now(),
  summary_json jsonb not null,
  status text not null default 'new' check (status = ANY (ARRAY['new','viewed','archived'])),
  reviewed_by uuid references public.employees(id),
  reviewed_at timestamptz
);

create index if not exists inventory_reviews_site_period_idx
  on public.inventory_reviews (site, review_type, period_start desc);

comment on table public.inventory_reviews is
  'Historique des synthèses de contrôle inventaire (une par génération), recalculable à tout moment à partir des données sources.';

alter table public.inventory_reviews enable row level security;

create policy select_inventory_reviews on public.inventory_reviews
  for select using (site = (select current_employee_site_id()));

create policy update_inventory_reviews on public.inventory_reviews
  for update using (
    site = (select current_employee_site_id())
    and current_employee_role() IN ('manager','gerant')
  );

create policy insert_inventory_reviews on public.inventory_reviews
  for insert with check (
    site = (select current_employee_site_id())
    and current_employee_role() IN ('manager','gerant')
  );
