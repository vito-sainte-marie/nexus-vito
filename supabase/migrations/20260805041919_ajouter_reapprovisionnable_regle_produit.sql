-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260805041919 · ajouter_reapprovisionnable_regle_produit
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- "Produit réapprovisionnable" (05/08/2026, exemple viennoiserie donné
-- par Frédéric) : informatif pour l'instant, ne restreint encore rien côté
-- employé (les mouvements de réassort restent possibles pour tout
-- produit) — mais mérite d'être une vraie colonne persistée, pas une
-- coche qui s'oublie à chaque ouverture du formulaire.
ALTER TABLE inventaire_regles_produit
  ADD COLUMN IF NOT EXISTS reapprovisionnable boolean NOT NULL DEFAULT true;
