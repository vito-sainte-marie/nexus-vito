-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260806183556 · ajouter_comptage_deux_lieux
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

ALTER TABLE inventaire_zone_produit ADD COLUMN IF NOT EXISTS comptage_deux_lieux boolean NOT NULL DEFAULT false;
ALTER TABLE inventaire_comptages ADD COLUMN IF NOT EXISTS quantite_depot numeric;
ALTER TABLE inventaire_comptages ADD COLUMN IF NOT EXISTS quantite_boutique numeric;
