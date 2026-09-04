-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810022853 · coach_fdj_schema_v1
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Coach x FDJ Pilotage — Phase 1 (09/08/2026), audit "Coach FDJ" §16.
-- 3 tables : catalogue de règles (coach_rules), recommandation retenue par
-- employé/jour (coach_daily_recommendations, 1 seule par employé/jour —
-- critère d'acceptation §26 imposé au niveau base via une contrainte
-- unique, pas seulement côté application), et historique d'interaction
-- (coach_recommendation_events). Même convention que les tables fdj_* :
-- site en text (défaut 'vito-sainte-marie'), RLS scoping via
-- current_employee_site_id() déjà utilisée partout ailleurs dans NEXUS.

create table public.coach_rules (
  rule_id text primary key,
  site text not null default 'vito-sainte-marie',
  domain text not null default 'fdj',
  active boolean not null default true,
  priority integer not null,
  minimum_sample integer,
  cooldown_days integer not null default 7,
  message_template_id text not null,
  version integer not null default 1,
  created_at timestamptz not null default now()
);
comment on table public.coach_rules is 'Catalogue des règles de coaching Coach x FDJ Pilotage (audit §16/§28) — priority = tier de la hiérarchie de sélection §5 (1=risque de contrôle ... 6=conseil général).';

create table public.coach_daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  employee_id uuid not null references public.employees(id),
  date date not null,
  domain text not null default 'fdj',
  rule_id text not null references public.coach_rules(rule_id),
  priority integer not null,
  message text not null,
  reason text not null,
  confidence text not null check (confidence in ('Élevée','Moyenne','Faible')),
  evidence_json jsonb,
  status text not null default 'generee' check (status in ('generee','remplacee')),
  created_at timestamptz not null default now(),
  unique (site, employee_id, date)
);
comment on table public.coach_daily_recommendations is 'Une recommandation Coach retenue par employé et par jour (audit §2/§26 : jamais plus d''une par jour) — conserve le message et les preuves au moment de la génération plutôt que de tout recalculer a posteriori.';

create table public.coach_recommendation_events (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  recommendation_id uuid not null references public.coach_daily_recommendations(id),
  event_type text not null check (event_type in ('shown','acknowledged','dismissed','completed')),
  actor_id uuid references public.employees(id),
  created_at timestamptz not null default now()
);
comment on table public.coach_recommendation_events is 'Historique d''interaction avec une recommandation Coach (audit §16) — jamais une note de performance, seulement un journal d''usage.';

create index idx_coach_daily_reco_site_employee_date on public.coach_daily_recommendations (site, employee_id, date);
create index idx_coach_daily_reco_site_date on public.coach_daily_recommendations (site, date);
create index idx_coach_reco_events_recommendation on public.coach_recommendation_events (recommendation_id);
create index idx_coach_rules_site_active on public.coach_rules (site, active);

alter table public.coach_rules enable row level security;
alter table public.coach_daily_recommendations enable row level security;
alter table public.coach_recommendation_events enable row level security;

create policy select_coach_rules on public.coach_rules for select
  using (site = (select current_employee_site_id()));
create policy insert_coach_rules on public.coach_rules for insert
  with check (site = (select current_employee_site_id()));
create policy update_coach_rules on public.coach_rules for update
  using (site = (select current_employee_site_id()));

create policy select_coach_daily_recommendations on public.coach_daily_recommendations for select
  using (site = (select current_employee_site_id()));
create policy insert_coach_daily_recommendations on public.coach_daily_recommendations for insert
  with check (site = (select current_employee_site_id()));
create policy update_coach_daily_recommendations on public.coach_daily_recommendations for update
  using (site = (select current_employee_site_id()));

create policy select_coach_recommendation_events on public.coach_recommendation_events for select
  using (site = (select current_employee_site_id()));
create policy insert_coach_recommendation_events on public.coach_recommendation_events for insert
  with check (site = (select current_employee_site_id()));

-- Seed des 12 règles V1 (audit §28 pour les 8 prioritaires + §4/§6 pour les
-- 4 complémentaires de familles Relation client / Stock nuancé). message_template_id
-- = rule_id pour toutes (1 clé de conseil = 1 entrée dans la bibliothèque
-- de formulations de nexus-coach-fdj-moteur.js).
insert into public.coach_rules (rule_id, priority, minimum_sample, cooldown_days, message_template_id) values
  ('fdj_activation_chain', 1, null, 1, 'fdj_activation_chain'),
  ('fdj_report_missing', 2, null, 1, 'fdj_report_missing'),
  ('fdj_report_late', 2, 5, 7, 'fdj_report_late'),
  ('fdj_correction_recurrente', 2, 5, 7, 'fdj_correction_recurrente'),
  ('fdj_stock_rupture_risk', 3, null, 1, 'fdj_stock_rupture_risk'),
  ('fdj_stock_reserve_faible', 3, null, 3, 'fdj_stock_reserve_faible'),
  ('fdj_regularite_levier', 4, 10, 14, 'fdj_regularite_levier'),
  ('fdj_palier_sous_represente', 5, 10, 7, 'fdj_palier_sous_represente'),
  ('fdj_jour_faible', 5, 8, 7, 'fdj_jour_faible'),
  ('fdj_jour_fort', 5, 8, 7, 'fdj_jour_fort'),
  ('fdj_relation_client_opportunite', 5, null, 3, 'fdj_relation_client_opportunite'),
  ('fdj_conseil_general', 6, null, 3, 'fdj_conseil_general');
