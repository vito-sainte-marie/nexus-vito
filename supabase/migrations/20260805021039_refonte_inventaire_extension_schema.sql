-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260805021039 · refonte_inventaire_extension_schema
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Refonte NEXUS Inventaire (04/08/2026, audit fonctionnel complet de Frédéric)
-- Choix structurant : ETENDRE le schéma inventaire_* existant (504 comptages et
-- 173 alertes réels déjà en production) plutôt que de le remplacer par le
-- schéma anglais proposé dans l'audit (inventory_sessions, inventory_counts...)
-- — zéro risque de perte de donnée, zéro migration de données réelles.

-- 1) Journal des mouvements structuré (audit §6) — table déjà créée mais
--    jamais câblée (0 ligne) : on la complète avant de la brancher à l'UI.
alter table inventaire_mouvements
  add column if not exists reason_code text,
  add column if not exists proof_url text,
  add column if not exists statut_validation text not null default 'valide',
  add column if not exists valide_par uuid,
  add column if not exists valide_le timestamptz,
  add column if not exists zone_source_id uuid references inventaire_zones(id),
  add column if not exists zone_destination_id uuid references inventaire_zones(id);

alter table inventaire_mouvements
  add constraint inventaire_mouvements_statut_validation_check
  check (statut_validation in ('valide','en_attente','refuse'));

comment on column inventaire_mouvements.reason_code is
  'Motif structuré : livraison, reassort, transfert_recu, retour_recu, correction_validee, casse, produit_abime, perime, retour_fournisseur, transfert_sortant, retrait_interne, consommation_interne, perte_identifiee, destruction (audit §6).';

-- 2) Corrections rétroactives manager (audit §25-28) — nouvelle table.
--    Règle non négociable : la valeur initiale ne disparaît jamais (old_value
--    conservée à côté de new_value, jamais un UPDATE en place sur un comptage).
create table if not exists inventaire_corrections (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  quart_id uuid references inventaire_quarts(id),
  produit_id uuid references inventaire_zone_produit(id),
  correction_type text not null, -- erreur_saisie | mouvement_oublie | stock_retenu
  old_value numeric,
  new_value numeric,
  reason_code text,
  commentaire text,
  operational_date date not null,
  quart text not null, -- matin | soir, redondant avec quart_id pour rester lisible même si le quart_id change
  created_by uuid,
  created_at timestamptz not null default now(),
  propagation_mode text not null default 'session_seule', -- session_seule | cascade
  affected_sessions_count integer not null default 0,
  status text not null default 'brouillon'
    check (status in ('brouillon','appliquee','en_attente_validation','validee','annulee','remplacee'))
);

comment on table inventaire_corrections is
  'Correction rétroactive manager sur un produit/date/quart (audit §25-28). old_value/new_value conservées ensemble en permanence — jamais un écrasement silencieux (règle non négociable du document).';

-- 3) Mode Simulation terrain (audit §23-24) — jamais officiel, jamais
--    d'évaluation employé générée, jamais de contamination de la production.
alter table inventaire_quarts
  add column if not exists is_simulation boolean not null default false,
  add column if not exists represented_employee_id uuid references employees(id),
  add column if not exists entered_by_user_id uuid references employees(id);

comment on column inventaire_quarts.is_simulation is
  'true = session de simulation terrain (audit §23) : le papier reste la référence officielle, cette session ne modifie jamais les stocks officiels ni ne génère d''évaluation employé.';
comment on column inventaire_quarts.represented_employee_id is
  'Employé dont la feuille papier est représentée par le manager en mode simulation — distinct de entered_by_user_id (l''auteur réel de la saisie), voir audit §24.';

-- 4) Profils produit (audit §10-11) — nouvelle table, une ligne par produit
--    suivi (les produits sans ligne ici restent en profil "continu" par défaut,
--    comportement actuel inchangé).
create table if not exists inventaire_regles_produit (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  produit_id uuid not null references inventaire_zone_produit(id),
  profil text not null default 'continu'
    check (profil in ('continu','cycle_journalier','lot_glissant','presse','consommable')),
  cycle_frequence text, -- ex: 'quotidien' pour profil B
  report_veille_autorise boolean not null default true,
  duree_max_vente_jours integer, -- profil C (SDD = 3 jours), profil D (par édition)
  action_echeance text, -- 'retour_fournisseur_obligatoire' | 'destruction' | 'alerte_manager'
  mode_agregation_ventes text not null default 'aucun'
    check (mode_agregation_ventes in ('aucun','cumul_quarts_1_2','cumul_journee')),
  validation_manager_requise boolean not null default false,
  comptage_masque boolean not null default false,
  seuil_minimal numeric, -- profil E (consommables) : seuil d'alerte
  created_at timestamptz not null default now(),
  unique(site, produit_id)
);

comment on table inventaire_regles_produit is
  'Un produit non présent ici garde le comportement historique (profil continu, stock transmis en chaîne) — table additive, jamais de migration forcée des 242 produits existants (audit §10-11).';

-- 5) Lots (profil C - SDD durée de vie glissante à 3 jours, profil D - presse
--    par édition, audit §10 et §12 "deux éditions ne doivent jamais être
--    mélangées").
create table if not exists inventaire_lots (
  id uuid primary key default gen_random_uuid(),
  site text not null default 'vito-sainte-marie',
  produit_id uuid not null references inventaire_zone_produit(id),
  libelle_edition text, -- presse : édition ou date de parution
  quantite_recue numeric not null,
  recu_le timestamptz not null default now(),
  date_debut_vente date not null default current_date,
  date_fin_vente date, -- calculée à la réception via duree_max_vente_jours
  quantite_restante numeric,
  statut text not null default 'en_vente'
    check (statut in ('en_vente','a_retourner','retourne','detruit')),
  quantite_retour numeric,
  retour_valide_le timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table inventaire_lots is
  'Chaque réception crée un lot daté (audit §10, Profil C). Au 3ème jour le retour fournisseur devient obligatoire. Pour la presse (Profil D), libelle_edition empêche de mélanger deux éditions.';

-- 6) Moteur d'anomalies étendu (audit §20) — catégorisation + score de
--    confiance, sans jamais conclure automatiquement à une fraude (le champ
--    reste informatif, l'UI doit toujours afficher un intitulé prudent pour
--    les signaux comportementaux).
alter table inventaire_alertes
  add column if not exists categorie_anomalie text
    check (categorie_anomalie in ('saisie','continuite','mouvement','rapprochement')),
  add column if not exists confiance numeric check (confiance is null or (confiance >= 0 and confiance <= 1));

comment on column inventaire_alertes.categorie_anomalie is
  'Classement large (audit §20) : saisie, continuité, mouvement, rapprochement Decenium. NULL pour les alertes existantes (écart_ouverture/cloture_en_retard restent valides sans catégorie forcée).';

-- Index utiles (tables neuves interrogées par produit/date, comme le reste du schéma).
create index if not exists idx_inventaire_corrections_produit_date on inventaire_corrections(produit_id, operational_date);
create index if not exists idx_inventaire_lots_produit_statut on inventaire_lots(produit_id, statut);
create index if not exists idx_inventaire_regles_produit_id on inventaire_regles_produit(produit_id);
