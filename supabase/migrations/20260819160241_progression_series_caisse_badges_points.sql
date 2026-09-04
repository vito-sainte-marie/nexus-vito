-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260819160241 · progression_series_caisse_badges_points
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Ma Progression — Séries & récompenses, volet Caisse (19/08/2026)
-- Cadrage développeur "NEXUS_Ma_Progression_Series_Recompenses_Cadrage_Developpeur.pdf".
-- Décision (verdict du 19/08/2026) : on ne réintroduit PAS progression_events ni
-- progression_streaks — nexus-progression.js calcule déjà la série/le record
-- Caisse (toutes activités : Boutique/Piste/FDJ) en direct depuis les tables
-- source (audits_caisse, fdj_cash_controls), via serieValideeConformeUnifiee()
-- (Article 11 — jamais une deuxième vérité). Les deux seules choses qui
-- manquaient réellement : un badge acquis une seule fois (idempotence) et un
-- ledger de points auditable — donc uniquement ces deux tables ici.

create table if not exists progression_badge_awards (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  site_id text not null,
  domain text not null,               -- 'caisse' pour ce lot ; 'inventaire' viendra plus tard, une fois la qualification de session disponible
  badge_code text not null,           -- ex. 'caisse_x5' — voir PALIERS_SERIE_CAISSE (nexus-progression.js)
  streak_value_at_award integer not null,
  earned_at timestamptz not null default now(),
  unique (employee_id, badge_code)
);

create table if not exists progression_points_ledger (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id),
  site_id text not null,
  source_type text not null,          -- 'badge_caisse'
  source_id text not null,            -- badge_code — garantit qu'un même badge ne crédite jamais deux fois
  points integer not null,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (employee_id, source_type, source_id)
);

create index if not exists idx_progression_badge_awards_employee on progression_badge_awards(employee_id);
create index if not exists idx_progression_badge_awards_site on progression_badge_awards(site_id);
create index if not exists idx_progression_points_ledger_employee on progression_points_ledger(employee_id);
create index if not exists idx_progression_points_ledger_site on progression_points_ledger(site_id);

alter table progression_badge_awards enable row level security;
alter table progression_points_ledger enable row level security;

-- Même doctrine que apprentissage_snapshots : l'employé crédite ses propres
-- lignes (déclenché côté client à l'ouverture de "Ma Progression", jamais en
-- vue manager) ; lecture ouverte à l'employé lui-même, au manager/gérant du
-- même site, et au créateur si le site l'autorise. Aucune policy UPDATE/DELETE
-- : un badge ou un crédit de points reste acquis, jamais réécrit ni effacé
-- silencieusement (cadrage §12, "Recommandation badge").

create policy employee_own_badge_insert on progression_badge_awards
  for insert
  with check (employee_id = (select auth.uid()));

create policy select_progression_badge_awards on progression_badge_awards
  for select
  using (
    employee_id = (select auth.uid())
    or (
      (select current_employee_role()) = any (array['manager','gerant'])
      and site_id = (select current_employee_site_id())
    )
    or (
      (select je_suis_createur())
      and exists (select 1 from sites s where s.site_id = progression_badge_awards.site_id and s.acces_createur_autorise = true)
    )
  );

create policy employee_own_points_insert on progression_points_ledger
  for insert
  with check (employee_id = (select auth.uid()));

create policy select_progression_points_ledger on progression_points_ledger
  for select
  using (
    employee_id = (select auth.uid())
    or (
      (select current_employee_role()) = any (array['manager','gerant'])
      and site_id = (select current_employee_site_id())
    )
    or (
      (select je_suis_createur())
      and exists (select 1 from sites s where s.site_id = progression_points_ledger.site_id and s.acces_createur_autorise = true)
    )
  );
