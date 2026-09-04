-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817021136 · fdj_releves_cloture_trace_controle
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 16/08/2026, demande de Frédéric ("Trace de contrôle FDJ") : à la
-- validation définitive de chaque quart FDJ, puis à chaque régularisation
-- manager ultérieure, NEXUS doit conserver un relevé de clôture IMMUABLE,
-- append-only — jamais une ligne modifiée ou supprimée. Objectif explicite :
-- pouvoir répondre, des mois plus tard, à une contestation ("ce n'est pas
-- moi", "le stock de départ était faux", "l'écart a été modifié après mon
-- départ") sans dépendre de la mémoire des personnes.
--
-- Un quart peut avoir PLUSIEURS lignes ici : version 1 = ce que l'employé a
-- réellement transmis (jamais réécrite), version 2+ = chaque régularisation
-- manager ultérieure (une ligne par régularisation, jamais un écrasement de
-- la précédente). C'est la même philosophie que caisse_reelle_origine/
-- ecart_origine (v2.108) mais étendue à TOUT le contenu du quart (stock,
-- mouvements, ventes), pas seulement la caisse.
--
-- "NEXUS conserve le fait. NEXUS explique ce qui a changé. Le manager
-- décide de l'interprétation." — ce relevé n'est donc jamais un jugement
-- automatique sur l'employé, uniquement un constat daté et signé.
create table fdj_releves_cloture (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid not null references fdj_shifts(id),
  date date not null,
  quart text not null,
  employee_id uuid,

  -- Append-only : chaque événement (validation employé, puis chaque
  -- régularisation manager) pose une nouvelle ligne avec un numéro de
  -- version croissant, jamais réutilisé, jamais réécrit.
  version_num integer not null,
  type_version text not null check (type_version in ('validation_employe', 'regularisation_manager')),
  cree_le timestamptz not null default now(),
  cree_par uuid, -- employee_id (v1) ou manager id (v2+)

  -- Contenu complet du quart AU MOMENT de cet événement — snapshot, jamais
  -- une référence vers des lignes fdj_shift_counts qui pourraient changer
  -- après coup.
  stock_initial_par_jeu jsonb not null default '{}'::jsonb,
  appro_par_jeu jsonb not null default '{}'::jsonb,
  stock_final_par_jeu jsonb not null default '{}'::jsonb,
  ventes_par_jeu jsonb not null default '{}'::jsonb, -- { game_id: {qte, valeur} }
  ventes_grattage_valeur numeric,
  lots_payes_grattage numeric,
  caisse_tirages numeric,
  regularisations numeric default 0,
  caisse_attendue numeric,
  caisse_reelle numeric,
  ecart numeric,

  -- État de la chaîne/donnée au moment précis de CET événement — utile pour
  -- expliquer après coup un écart calculé alors que la chaîne était encore
  -- rompue ou une donnée encore manquante.
  anomalie_chaine jsonb,

  statut text not null check (statut in ('conforme', 'valide_avec_ecart', 'regularise')),

  -- Uniquement rempli pour version_num >= 2 : pourquoi cette régularisation,
  -- et le différentiel explicite avant/après (ex. stock initial CASH 24→23,
  -- écart +5,00€→0,00€) — jamais juste "modifié", toujours "quoi et pourquoi".
  motif_regularisation text,
  diff_vs_precedent jsonb,

  -- "Signature numérique" (16/08/2026, demande de Frédéric) : pas une
  -- signature manuscrite, mais la trace technique de l'action de validation
  -- elle-même — utilisateur authentifié, horodatage, version des données,
  -- session/appareil si disponible, identifiant du quart concerné.
  signature jsonb not null default '{}'::jsonb,

  unique (shift_id, version_num)
);

comment on table fdj_releves_cloture is
  'Relevé de clôture FDJ / Trace de contrôle FDJ — append-only, jamais modifié ni supprimé. Une ligne par événement (validation employé = version 1, chaque régularisation manager = une nouvelle version). Preuve des faits enregistrés, pas un jugement automatique.';

create index idx_fdj_releves_cloture_shift on fdj_releves_cloture(shift_id, version_num);
create index idx_fdj_releves_cloture_employee on fdj_releves_cloture(employee_id, date);
create index idx_fdj_releves_cloture_date on fdj_releves_cloture(site, date);

alter table fdj_releves_cloture enable row level security;

-- Même pattern que fdj_audit_log (append-only) : SELECT + INSERT
-- uniquement, JAMAIS de policy UPDATE ou DELETE — l'immuabilité est donc
-- imposée par la base elle-même, pas seulement par discipline applicative.
create policy select_fdj_releves_cloture on fdj_releves_cloture
  for select using (site = (select current_employee_site_id()));

create policy insert_fdj_releves_cloture on fdj_releves_cloture
  for insert with check (site = (select current_employee_site_id()));
