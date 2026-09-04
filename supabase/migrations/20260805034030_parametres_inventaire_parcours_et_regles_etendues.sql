-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260805034030 · parametres_inventaire_parcours_et_regles_etendues
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Paramètres Inventaire (04/08/2026, demande de Frédéric) : purement
-- additif, aucune donnée existante modifiée. ordre_affichage sur les
-- zones (les catégories et produits l'ont déjà) pour l'onglet "Parcours
-- d'inventaire" ; jours_rotation NULL = tous les jours = comportement
-- actuel inchangé pour les 242 produits déjà en place ; controle_aleatoire
-- et photo_obligatoire pour l'onglet "Règles des produits".

ALTER TABLE inventaire_zones
  ADD COLUMN IF NOT EXISTS ordre_affichage integer NOT NULL DEFAULT 0;

ALTER TABLE inventaire_categories
  ADD COLUMN IF NOT EXISTS jours_rotation integer[] DEFAULT NULL;
COMMENT ON COLUMN inventaire_categories.jours_rotation IS 'Jours ISO (1=lundi..7=dimanche) où cette catégorie doit être comptée. NULL = tous les jours (comportement historique).';

ALTER TABLE inventaire_regles_produit
  ADD COLUMN IF NOT EXISTS controle_aleatoire boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS photo_obligatoire boolean NOT NULL DEFAULT false;
