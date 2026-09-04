-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810011853 · fdj_stock_references_inventaire_zero
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- NEXUS FDJ — "Inventaire de référence" (09/08/2026, demande de Frédéric) :
-- un contrôle physique certifié (Bureau + Caisse non activé) devient le
-- nouveau point zéro du stock. Les mouvements fdj_stock_movements déjà
-- enregistrés (activations, transferts du jour) restent intacts pour leur
-- valeur financière/historique (appro, audit) — mais pour le calcul du
-- stock physique confié (soldes bureau/caisse), seuls les mouvements
-- POSTÉRIEURS à la date de cette référence comptent désormais. Le contrôle
-- physique lui-même absorbe tout ce qui s'est passé avant.

create table fdj_stock_references (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  date date not null,
  controle_par uuid references employees(id),
  type text not null default 'initialisation' check (type in ('initialisation', 'recomptage')),
  statut text not null default 'valide' check (statut in ('valide')),
  note text,
  created_at timestamptz not null default now()
);

create table fdj_stock_reference_lignes (
  id uuid primary key default gen_random_uuid(),
  reference_id uuid not null references fdj_stock_references(id) on delete cascade,
  site text not null default 'vito-sainte-marie',
  game_id uuid not null references fdj_games(id),
  bureau_reel numeric not null default 0,
  caisse_reel numeric not null default 0,
  stock_theorique_bureau_avant numeric,
  stock_theorique_caisse_avant numeric,
  created_at timestamptz not null default now(),
  unique (reference_id, game_id)
);

alter table fdj_stock_references enable row level security;
alter table fdj_stock_reference_lignes enable row level security;

create policy select_fdj_stock_references on fdj_stock_references for select
  using (site = (select current_employee_site_id()));
create policy insert_fdj_stock_references on fdj_stock_references for insert
  with check (site = (select current_employee_site_id()));

create policy select_fdj_stock_reference_lignes on fdj_stock_reference_lignes for select
  using (site = (select current_employee_site_id()));
create policy insert_fdj_stock_reference_lignes on fdj_stock_reference_lignes for insert
  with check (site = (select current_employee_site_id()));

create index idx_fdj_stock_references_site_date on fdj_stock_references(site, date desc, created_at desc);
create index idx_fdj_stock_reference_lignes_reference on fdj_stock_reference_lignes(reference_id);
