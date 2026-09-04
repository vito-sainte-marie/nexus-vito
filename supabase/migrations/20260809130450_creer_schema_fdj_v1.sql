-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260809130450 · creer_schema_fdj_v1
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- NEXUS FDJ — schéma complet (09/08/2026, construit avec Frédéric à partir
-- de NEXUS_FDJ_Audit_Complet_Developpeur.pdf et du fichier réel
-- "CAISSE JOURNIALIERE FDJ 2026.xlsx", feuilles CONTROLE CAISSE / SUIVI
-- HEBDO FDJ / ECART DE CAISSE).
--
-- Principe directeur (même discipline qu'Inventaire et Verify) : NEXUS FDJ
-- ne devient jamais un système métier FDJ bis — il récupère le minimum de
-- données (comptage grattage, valeurs de rapport tirages, caisse réelle),
-- reconstruit le rapprochement, et ne calcule JAMAIS un écart saisi à la
-- main (toujours réel - attendu). Toutes les tables suivent la convention
-- déjà en place sur inventaire_* : site en RLS via current_employee_site_id(),
-- jamais de DELETE, corrections/audit toujours additifs.
--
-- Schéma complet V1+V2 posé dès maintenant (décision de Frédéric,
-- 09/08/2026) pour ne pas avoir à migrer plus tard : V1 utilise
-- fdj_games/fdj_locations/fdj_shifts/fdj_shift_counts/fdj_reports/
-- fdj_cash_controls/fdj_corrections/fdj_audit_log ; fdj_booklets/
-- fdj_stock_movements/fdj_discrepancies/fdj_recall_alerts/
-- fdj_imported_history posent la structure V2/V3 sans écran pour l'instant.
-- ============================================================

-- ------------------------------------------------------------
-- fdj_games — catalogue des jeux (grattage). Un jeu inactif reste visible
-- dans l'historique mais disparaît des écrans de comptage.
-- ------------------------------------------------------------
create table public.fdj_games (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  nom text not null,
  prix numeric not null,
  fdj_reference text,              -- code jeu FDJ (ex: "14805"), vu sur les réceptions colis
  tickets_par_carnet integer,      -- optionnel, renseigné quand connu (V2 carnet)
  jeu_sensible boolean not null default false,
  scanner_active boolean not null default false,     -- V2
  suivi_serie_active boolean not null default false, -- V2
  actif boolean not null default true,
  ordre_affichage integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.fdj_games is 'Catalogue des jeux de grattage FDJ, par site — paramétrable (Paramètres FDJ), jamais codé en dur dans les écrans.';

-- ------------------------------------------------------------
-- fdj_locations — où vit le stock (Bureau, Caisse 1, Caisse 2, Réserve...).
-- Configurable : NEXUS FDJ ne suppose jamais un seul mode d'organisation.
-- ------------------------------------------------------------
create table public.fdj_locations (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  nom text not null,
  type text not null default 'autre' check (type in ('bureau','caisse','reserve','autre')),
  actif boolean not null default true,
  ordre_affichage integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.fdj_locations is 'Emplacements de stock FDJ (bureau, caisses, réserve) — répond à "où est ce carnet ?" (audit §5-6).';

-- ------------------------------------------------------------
-- fdj_shifts — un quart FDJ (date + quart + vendeur), pivot de tout le
-- contrôle quotidien. Mutable pendant la saisie (statut brouillon), verrouillé
-- une fois validé — toute modification après validation passe par
-- fdj_corrections, jamais par un UPDATE silencieux.
-- ------------------------------------------------------------
create table public.fdj_shifts (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  date date not null,
  quart text not null check (quart in ('1','2')),
  employee_id uuid references public.employees(id),
  statut text not null default 'brouillon' check (statut in ('brouillon','valide')),
  ouvert_le timestamptz,
  valide_le timestamptz,
  created_at timestamptz not null default now(),
  unique (site, date, quart)
);
comment on table public.fdj_shifts is 'Un quart FDJ = une feuille CONTROLE CAISSE réelle (date, quart, vendeur). unique(site,date,quart) : un seul quart FDJ par créneau, comme la feuille papier actuelle.';

-- ------------------------------------------------------------
-- fdj_shift_counts — comptage grattage par jeu pour un quart, reproduit
-- exactement les colonnes de CONTROLE CAISSE (Stock initial/Appro/Stock
-- final/Ventes/Valeur). Ventes et valeur ne sont JAMAIS saisies : toujours
-- calculées côté écran à partir de stock_initial + appro - stock_final et
-- du prix du jeu — reproduites ici en colonnes pour l'historique/l'export,
-- jamais comme source de vérité.
-- ------------------------------------------------------------
create table public.fdj_shift_counts (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid not null references public.fdj_shifts(id),
  game_id uuid not null references public.fdj_games(id),
  stock_initial numeric,
  appro numeric not null default 0,
  stock_final numeric,
  ventes_qte numeric,     -- calculé : stock_initial + appro - stock_final
  ventes_valeur numeric,  -- calculé : ventes_qte * prix du jeu
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, game_id)
);
comment on table public.fdj_shift_counts is 'Une ligne par jeu et par quart — reproduit la feuille CONTROLE CAISSE réelle. ventes_qte/ventes_valeur toujours recalculés, jamais saisis à la main.';

-- ------------------------------------------------------------
-- fdj_reports — valeurs indispensables tirées des rapports FDJ officiels
-- (RAPPORT JOURNALIER = lots payés grattage, RAPPORT JOURNALIER TEMPS REEL
-- = caisse tirages). Jamais recopier le rapport entier (audit §17) : juste
-- les montants nécessaires au rapprochement + le justificatif (photo/PDF).
-- ------------------------------------------------------------
create table public.fdj_reports (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid not null references public.fdj_shifts(id),
  type_rapport text not null check (type_rapport in ('journalier','temps_reel')),
  lots_payes_grattage numeric,  -- rempli sur le rapport 'journalier'
  caisse_tirages numeric,       -- rempli sur le rapport 'temps_reel'
  justificatif_url text,
  saisi_par uuid references public.employees(id),
  created_at timestamptz not null default now(),
  unique (shift_id, type_rapport)
);
comment on table public.fdj_reports is 'Valeurs minimales extraites des deux rapports FDJ réels (journalier / temps réel) + justificatif joint, jamais une recopie complète du rapport.';

-- ------------------------------------------------------------
-- fdj_cash_controls — le rapprochement du quart : caisse attendue (calculée),
-- caisse réelle (comptée), écart (toujours calculé = réel - attendu, jamais
-- saisi). Une seule ligne par quart.
-- ------------------------------------------------------------
create table public.fdj_cash_controls (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid not null references public.fdj_shifts(id) unique,
  ventes_grattage_valeur numeric,   -- somme des ventes_valeur du quart
  lots_payes_grattage numeric,      -- repris de fdj_reports (journalier)
  caisse_grattage numeric,          -- calculé : ventes_grattage_valeur - lots_payes_grattage
  caisse_tirages numeric,           -- repris de fdj_reports (temps_reel)
  regularisations numeric not null default 0,
  caisse_attendue numeric,          -- calculé : caisse_grattage + caisse_tirages + regularisations
  caisse_reelle numeric,            -- compté par l'employé
  ecart numeric,                    -- calculé : caisse_reelle - caisse_attendue
  motif_ecart text,
  statut text not null default 'provisoire' check (statut in
    ('provisoire','a_controler','en_attente','expliquee','regularise','valide_avec_ecart','conforme')),
  valide_par uuid references public.employees(id),
  valide_le timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fdj_cash_controls is 'Rapprochement caisse FDJ du quart. ecart = caisse_reelle - caisse_attendue, toujours calculé côté écran, jamais saisi (audit §19). statut=provisoire tant que non validé par un manager — jamais utilisé par Ma Progression tant que provisoire.';

-- ------------------------------------------------------------
-- fdj_stock_movements — mouvements de stock (réception, transfert bureau↔
-- caisse, retour, blocage, activation, correction). V2 (carnet individuel
-- optionnel via booklet_id), mais la structure sert dès V1 pour les
-- réapprovisionnements bureau→caisse en quantité.
-- ------------------------------------------------------------
create table public.fdj_stock_movements (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  game_id uuid not null references public.fdj_games(id),
  type_mouvement text not null check (type_mouvement in
    ('reception','transfert','retour','blocage','activation','correction')),
  quantite numeric not null,
  location_source_id uuid references public.fdj_locations(id),
  location_destination_id uuid references public.fdj_locations(id),
  booklet_id uuid, -- références fdj_booklets, V2
  employee_id uuid references public.employees(id),
  justification text,
  created_at timestamptz not null default now()
);
comment on table public.fdj_stock_movements is 'Boîte noire des mouvements de stock FDJ (audit §14) — un réappro Bureau→Caisse ne change jamais le stock total du site, seulement l''emplacement.';

-- ------------------------------------------------------------
-- fdj_booklets — carnet individuel (V2, numéro de série / code-barres).
-- Posée maintenant pour ne pas redesigner fdj_stock_movements.booklet_id
-- plus tard ; aucun écran V1 ne l'utilise encore.
-- ------------------------------------------------------------
create table public.fdj_booklets (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  game_id uuid not null references public.fdj_games(id),
  serial_number text,
  booklet_number text,
  barcode_value text,
  current_location_id uuid references public.fdj_locations(id),
  activation_status text not null default 'recu' check (activation_status in
    ('recu','stock_bureau','confie_caisse','non_active','active','ouvert','termine','bloque','a_retourner','retourne')),
  received_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.fdj_booklets is 'Carnet individuel (V2) — cycle de vie complet audit §13. Non utilisé par les écrans V1 (comptage par quantité/jeu/emplacement uniquement).';

-- ------------------------------------------------------------
-- fdj_discrepancies — suivi de résolution d'un écart dans le temps
-- (distinct de fdj_cash_controls.ecart qui reste le calcul du jour) :
-- utile quand un écart nécessite plusieurs échanges avant d'être expliqué.
-- ------------------------------------------------------------
create table public.fdj_discrepancies (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  cash_control_id uuid not null references public.fdj_cash_controls(id),
  valeur_initiale numeric,
  regularisations numeric not null default 0,
  valeur_finale numeric,
  cause text,
  statut text not null default 'provisoire' check (statut in
    ('provisoire','a_controler','en_attente','expliquee','regularise','valide_avec_ecart','conforme')),
  manager_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.fdj_discrepancies is 'Historique des écarts (audit §21) — permet un suivi date/quart/employé/cause/statut/manager séparé du calcul brut du jour.';

-- ------------------------------------------------------------
-- fdj_corrections — correction manager rétroactive ("Corriger une journée
-- FDJ", audit §25-28) : ancienne valeur toujours conservée, jamais un
-- écrasement silencieux — même principe que inventaire_corrections.
-- ------------------------------------------------------------
create table public.fdj_corrections (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid references public.fdj_shifts(id),
  game_id uuid references public.fdj_games(id),
  correction_type text not null,
  old_value numeric,
  new_value numeric,
  reason_code text,
  commentaire text,
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);
comment on table public.fdj_corrections is 'Correction rétroactive manager sur un quart FDJ — old_value/new_value conservées ensemble, jamais un écrasement silencieux (même règle que inventaire_corrections).';

-- ------------------------------------------------------------
-- fdj_recall_alerts — alerte jeu/série retiré ou bloqué par FDJ (V2).
-- ------------------------------------------------------------
create table public.fdj_recall_alerts (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  game_id uuid references public.fdj_games(id),
  serial_range text,
  date_alerte date not null default current_date,
  motif text,
  instruction_fdj text,
  justificatif_url text,
  statut text not null default 'ouverte' check (statut in ('ouverte','traitee','classee')),
  created_by uuid references public.employees(id),
  created_at timestamptz not null default now()
);
comment on table public.fdj_recall_alerts is 'Gestion des retraits FDJ (audit §11) — V2, structure posée dès maintenant.';

-- ------------------------------------------------------------
-- fdj_imported_history — lignes issues de l'import de l'historique Excel
-- (CAISSE JOURNIALIERE FDJ 2026.xlsx), toujours marquées comme telles.
-- ------------------------------------------------------------
create table public.fdj_imported_history (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  date date not null,
  quart text,
  game_id uuid references public.fdj_games(id),
  data jsonb not null,
  source_label text not null default 'Historique importé',
  imported_at timestamptz not null default now()
);
comment on table public.fdj_imported_history is 'Lignes reprises du fichier Excel historique — toujours marquées "Historique importé" (même convention que le reste de NEXUS), jamais confondues avec une saisie NEXUS native.';

-- ------------------------------------------------------------
-- fdj_audit_log — journal immuable (audit §57 principe "traçabilité"),
-- même structure que inventaire_audit_log.
-- ------------------------------------------------------------
create table public.fdj_audit_log (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  shift_id uuid references public.fdj_shifts(id),
  entite_type text not null,
  entite_id uuid,
  action text not null,
  ancienne_valeur jsonb,
  nouvelle_valeur jsonb,
  acteur_id uuid references public.employees(id),
  date_action timestamptz not null default now(),
  motif text,
  metadata jsonb
);
comment on table public.fdj_audit_log is 'Journal immuable FDJ — aucune donnée ancienne écrasée silencieusement (même principe que inventaire_audit_log).';

-- ------------------------------------------------------------
-- RLS — même convention que inventaire_* : site = current_employee_site_id(),
-- jamais de DELETE.
-- ------------------------------------------------------------
alter table public.fdj_games enable row level security;
alter table public.fdj_locations enable row level security;
alter table public.fdj_shifts enable row level security;
alter table public.fdj_shift_counts enable row level security;
alter table public.fdj_reports enable row level security;
alter table public.fdj_cash_controls enable row level security;
alter table public.fdj_stock_movements enable row level security;
alter table public.fdj_booklets enable row level security;
alter table public.fdj_discrepancies enable row level security;
alter table public.fdj_corrections enable row level security;
alter table public.fdj_recall_alerts enable row level security;
alter table public.fdj_imported_history enable row level security;
alter table public.fdj_audit_log enable row level security;

create policy select_fdj_games on public.fdj_games for select using (site = (select current_employee_site_id()));
create policy insert_fdj_games on public.fdj_games for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_games on public.fdj_games for update using (site = (select current_employee_site_id()));

create policy select_fdj_locations on public.fdj_locations for select using (site = (select current_employee_site_id()));
create policy insert_fdj_locations on public.fdj_locations for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_locations on public.fdj_locations for update using (site = (select current_employee_site_id()));

create policy select_fdj_shifts on public.fdj_shifts for select using (site = (select current_employee_site_id()));
create policy insert_fdj_shifts on public.fdj_shifts for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_shifts on public.fdj_shifts for update using (site = (select current_employee_site_id()));

create policy select_fdj_shift_counts on public.fdj_shift_counts for select using (site = (select current_employee_site_id()));
create policy insert_fdj_shift_counts on public.fdj_shift_counts for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_shift_counts on public.fdj_shift_counts for update using (site = (select current_employee_site_id()));

create policy select_fdj_reports on public.fdj_reports for select using (site = (select current_employee_site_id()));
create policy insert_fdj_reports on public.fdj_reports for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_reports on public.fdj_reports for update using (site = (select current_employee_site_id()));

create policy select_fdj_cash_controls on public.fdj_cash_controls for select using (site = (select current_employee_site_id()));
create policy insert_fdj_cash_controls on public.fdj_cash_controls for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_cash_controls on public.fdj_cash_controls for update using (site = (select current_employee_site_id()));

create policy select_fdj_stock_movements on public.fdj_stock_movements for select using (site = (select current_employee_site_id()));
create policy insert_fdj_stock_movements on public.fdj_stock_movements for insert with check (site = (select current_employee_site_id()));

create policy select_fdj_booklets on public.fdj_booklets for select using (site = (select current_employee_site_id()));
create policy insert_fdj_booklets on public.fdj_booklets for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_booklets on public.fdj_booklets for update using (site = (select current_employee_site_id()));

create policy select_fdj_discrepancies on public.fdj_discrepancies for select using (site = (select current_employee_site_id()));
create policy insert_fdj_discrepancies on public.fdj_discrepancies for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_discrepancies on public.fdj_discrepancies for update using (site = (select current_employee_site_id()));

create policy select_fdj_corrections on public.fdj_corrections for select using (site = (select current_employee_site_id()));
create policy insert_fdj_corrections on public.fdj_corrections for insert with check (site = (select current_employee_site_id()));

create policy select_fdj_recall_alerts on public.fdj_recall_alerts for select using (site = (select current_employee_site_id()));
create policy insert_fdj_recall_alerts on public.fdj_recall_alerts for insert with check (site = (select current_employee_site_id()));
create policy update_fdj_recall_alerts on public.fdj_recall_alerts for update using (site = (select current_employee_site_id()));

create policy select_fdj_imported_history on public.fdj_imported_history for select using (site = (select current_employee_site_id()));
create policy insert_fdj_imported_history on public.fdj_imported_history for insert with check (site = (select current_employee_site_id()));

create policy select_fdj_audit_log on public.fdj_audit_log for select using (site = (select current_employee_site_id()));
create policy insert_fdj_audit_log on public.fdj_audit_log for insert with check (site = (select current_employee_site_id()));
