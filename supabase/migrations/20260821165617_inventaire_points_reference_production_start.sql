-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821165617 · inventaire_points_reference_production_start
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Inventaire — Point de référence / cutover production (21/08/2026,
-- demande explicite de Frédéric suite à l'audit "Chaîne de données") :
-- établit un point dans le temps à partir duquel les comptages, alertes et
-- analyses du moteur Inventaire deviennent "opérationnels". Ne fabrique
-- jamais un stock de référence ni une vérité physique au moment du
-- cutover — seulement un marqueur temporel, jamais une donnée métier.
create table if not exists inventaire_points_reference (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  type text not null default 'PRODUCTION_START',
  date_heure timestamptz not null default now(),
  motif text,
  auteur_id uuid,
  cree_le timestamptz not null default now()
);

create index if not exists idx_inventaire_points_reference_site_date
  on inventaire_points_reference (site, date_heure desc);

alter table inventaire_points_reference enable row level security;

-- Même patron que inventaire_categories : lecture ouverte à tout employé du
-- site, écriture réservée manager/gérant (Article 11 — RLS déjà établie
-- ailleurs, jamais réinventée).
create policy select_inventaire_points_reference on inventaire_points_reference
  for select using (site = (select current_employee_site_id()));

create policy ecriture_inventaire_points_reference on inventaire_points_reference
  for all
  using (current_employee_role() = any (array['manager','gerant']) and site = (select current_employee_site_id()))
  with check (current_employee_role() = any (array['manager','gerant']) and site = (select current_employee_site_id()));
