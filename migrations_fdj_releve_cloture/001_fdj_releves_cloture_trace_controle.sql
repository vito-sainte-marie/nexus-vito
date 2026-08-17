-- Migration : fdj_releves_cloture_trace_controle (16/08/2026)
-- Relevé de clôture FDJ / Trace de contrôle FDJ — table append-only.
-- Demande de Frédéric : "à la validation définitive de chaque quart FDJ,
-- une fiche de clôture immuable [...] Situation au moment où l'employé
-- valide, puis, s'il y a intervention ensuite : Situation après
-- régularisation manager."
--
-- Immuabilité imposée par la base elle-même (pas seulement par discipline
-- applicative) : RLS volontairement limitée à SELECT + INSERT ci-dessous —
-- aucune policy UPDATE ni DELETE n'existe sur cette table. Un quart porte
-- PLUSIEURS lignes (version_num croissant), jamais un écrasement.

create table if not exists fdj_releves_cloture (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid not null references fdj_shifts(id),
  date date not null,
  quart text not null,
  employee_id uuid,
  version_num integer not null,
  type_version text not null check (type_version in ('validation_employe', 'regularisation_manager')),
  cree_le timestamptz not null default now(),
  cree_par uuid,

  -- Snapshot complet du quart au moment de CET événement précis.
  stock_initial_par_jeu jsonb not null default '{}'::jsonb,
  appro_par_jeu jsonb not null default '{}'::jsonb,
  stock_final_par_jeu jsonb not null default '{}'::jsonb,
  ventes_par_jeu jsonb not null default '{}'::jsonb,
  ventes_grattage_valeur numeric,
  lots_payes_grattage numeric,
  caisse_tirages numeric,
  regularisations numeric default 0,
  caisse_attendue numeric,
  caisse_reelle numeric,
  ecart numeric,
  anomalie_chaine jsonb,
  statut text not null check (statut in ('conforme', 'valide_avec_ecart', 'regularise')),

  -- Versions >= 2 uniquement (régularisation manager).
  motif_regularisation text,
  diff_vs_precedent jsonb,

  -- Signature numérique — "pas une signature manuscrite compliquée [...]
  -- la trace d'action" (Frédéric).
  signature jsonb not null default '{}'::jsonb,

  unique (shift_id, version_num)
);

alter table fdj_releves_cloture enable row level security;

create policy select_fdj_releves_cloture on fdj_releves_cloture
  for select using (site = current_employee_site_id());

create policy insert_fdj_releves_cloture on fdj_releves_cloture
  for insert with check (site = current_employee_site_id());

-- Volontairement aucune policy UPDATE ni DELETE : l'immuabilité est donc
-- imposée par Postgres lui-même, pas seulement par discipline applicative.
