-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260829220955 · inventaire_missions
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists inventaire_missions (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  date date not null,
  quart text not null check (quart in ('matin', 'soir')),
  moment_code text not null check (moment_code in ('debut', 'pendant', 'fin')),
  mission_rule_id uuid references inventaire_mission_rules(id),
  nom text not null,
  role_affecte text,
  via_repli boolean not null default false,
  statut text not null check (statut in ('affectee', 'non_affectee')),
  strategie_appliquee text,
  produit_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (site, date, quart, mission_rule_id, moment_code)
);

create index if not exists idx_inventaire_missions_site_date_quart on inventaire_missions(site, date, quart);
create index if not exists idx_inventaire_missions_role on inventaire_missions(site, date, quart, role_affecte);

alter table inventaire_missions enable row level security;

-- Miroir exact de la RLS de inventaire_plans_comptage (Article 11) : la
-- génération de missions est déclenchée côté client par l'employé qui
-- ouvre son quart, exactement comme la génération du plan de comptage.
create policy select_inventaire_missions on inventaire_missions
  for select using (site = (select current_employee_site_id()));
create policy insert_inventaire_missions on inventaire_missions
  for insert with check (site = (select current_employee_site_id()));
create policy update_inventaire_missions on inventaire_missions
  for update using (site = (select current_employee_site_id()));
