-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821034313 · inventaire_categories_regles_heritees
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 20/08/2026, demande de Frédéric : "règle de catégorie par défaut +
-- exceptions produit" (Sprint 1 du nouveau chantier Inventaire "Site →
-- Catégorie → Produit"). Ajout additif pur (aucune colonne existante
-- touchée, aucun produit ni catégorie existant n'est affecté tant que
-- regle_active reste false) — mêmes champs que inventaire_regles_produit,
-- tous nullables ici : NULL = "pas de valeur définie pour cette catégorie",
-- comportement historique inchangé. regle_active est l'interrupteur
-- explicite ("Règle commune pour la catégorie ☑ Activée") qui décide si
-- ces colonnes sont consultées par la cascade de résolution
-- (regleEffectiveProduit, nexus-inventaire-moteur.js) — jamais déduit de la
-- simple présence d'une valeur, pour éviter toute ambiguïté si un manager
-- désactive puis réactive la règle sans avoir tout reréglé.
alter table inventaire_categories
  add column regle_active boolean not null default false,
  add column profil text,
  add column cycle_frequence text,
  add column report_veille_autorise boolean,
  add column duree_max_vente_jours integer,
  add column action_echeance text,
  add column mode_agregation_ventes text,
  add column validation_manager_requise boolean,
  add column comptage_masque boolean,
  add column seuil_minimal numeric,
  add column controle_aleatoire boolean,
  add column photo_obligatoire boolean,
  add column quarts_comptage text[],
  add column reapprovisionnable boolean,
  add column frequence_controle text,
  add column delai_max_jours_sans_controle integer;

alter table inventaire_categories
  add constraint inventaire_categories_profil_check
    check (profil is null or profil = any (array['continu','cycle_journalier','lot_glissant','presse','consommable','production_journaliere'])),
  add constraint inventaire_categories_frequence_controle_check
    check (frequence_controle is null or frequence_controle = any (array['critique','standard','faible_rotation'])),
  add constraint inventaire_categories_mode_agregation_ventes_check
    check (mode_agregation_ventes is null or mode_agregation_ventes = any (array['aucun','cumul_quarts_1_2','cumul_journee']));

comment on column inventaire_categories.regle_active is 'Interrupteur explicite : true = les colonnes de règle ci-dessous s''appliquent par défaut à tous les produits de la catégorie sans ligne inventaire_regles_produit propre. false = catégorie purement organisationnelle (comportement historique), même si des colonnes de règle portent une valeur résiduelle.';
