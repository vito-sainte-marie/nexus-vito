-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810160120 · create_fdj_site_settings
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- fdj_site_settings (10/08/2026, audit "Paramétrage FDJ" — fondations)
-- Une ligne par site : les réglages FDJ qui variaient jusqu'ici en constantes
-- JS (donc identiques quel que soit le site, et modifiables seulement par le
-- développeur) deviennent des colonnes lues en base. Pas encore d'écran
-- manager pour les éditer (étape suivante de l'audit) : modification par SQL
-- pour l'instant, documentée dans le Dictionnaire de données.
create table public.fdj_site_settings (
  site text primary key,

  -- Profil d'organisation du stock (audit §4/§8) — informationnel pour
  -- l'instant (aucun écran ni règle moteur ne le lit encore), posé ici pour
  -- ne pas avoir à re-designer le schéma à l'étape suivante.
  profil_stock text not null default 'reserve_centrale'
    check (profil_stock in ('reserve_centrale','direct_caisse','multi_caisse','avance')),

  -- Quarts (audit §13). L'horaire de bascule quart 1 -> quart 2 reste
  -- d'abord lu depuis station_config.horaires.quart2.normal (partagé avec
  -- Inventaire) ; cette colonne ne sert que de repli FDJ si station_config
  -- est vide, remplaçant l'ancienne constante JS HORAIRE_DEFAUT_DEBUT_QUART2.
  nombre_quarts integer not null default 2,
  horaire_bascule_quart2_repli text not null default '12:40',

  -- Contrôle de caisse (audit §14) — posés ici pour la suite (étape
  -- "construire Parametres FDJ" + "test de configuration"), pas encore
  -- consommés par un calcul de statut_caisse automatique aujourd'hui.
  seuil_caisse_vert numeric not null default 0,
  seuil_caisse_rouge numeric not null default 5,
  validation_manager_obligatoire boolean not null default true,

  -- Pilotage (audit §15) — remplace l'ancienne constante JS SEUIL_MIN_QUARTS
  -- (NEXUS-FDJ-Analyse-v1.html, dupliquée à 2 endroits).
  seuil_min_quarts_moyenne integer not null default 3,

  -- Coach FDJ (audit §17) — remplace les 4 constantes JS de
  -- nexus-coach-fdj-moteur.js (SEUIL_RISQUE_RECURRENT, SEUIL_AXE_EQUIPE,
  -- SEUIL_PROGRES_BASE, SEUIL_PROGRES_BAISSE).
  coach_actif boolean not null default true,
  coach_seuil_risque_recurrent integer not null default 3,
  coach_seuil_axe_equipe integer not null default 3,
  coach_seuil_progres_base integer not null default 3,
  coach_seuil_progres_baisse numeric not null default 0.5,

  updated_at timestamptz not null default now(),
  updated_by uuid references public.employees(id) on delete set null
);

comment on table public.fdj_site_settings is
  'Paramétrage FDJ par site (audit "Paramétrage autonome & multi-site", 10/08/2026) — remplace les constantes jusque-là codées en dur dans le JS (SEUIL_MIN_QUARTS, seuils Coach, horaire de repli quart 2). Une ligne absente = valeurs par défaut (mêmes valeurs que les anciennes constantes, donc aucun changement de comportement à la création de cette table). Pas encore d''écran manager pour l''éditer : prochaine étape de l''audit.';

alter table public.fdj_site_settings enable row level security;

-- Lecture : tout utilisateur authentifié du site (même politique que
-- fdj_games/fdj_locations — paramétrage, pas donnée opérationnelle sensible).
create policy "fdj_site_settings_select_authenticated"
  on public.fdj_site_settings for select
  to authenticated
  using (true);

-- Écriture réservée au rôle service (back-office / futur écran manager,
-- géré via la clé service_role comme les autres tables de configuration
-- sensibles de NEXUS).
create policy "fdj_site_settings_write_service_role"
  on public.fdj_site_settings for all
  to service_role
  using (true)
  with check (true);

insert into public.fdj_site_settings (site) values ('vito-sainte-marie');
