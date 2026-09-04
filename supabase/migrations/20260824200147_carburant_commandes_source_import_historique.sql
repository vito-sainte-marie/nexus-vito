-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824200147 · carburant_commandes_source_import_historique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

ALTER TABLE carburant_commandes DROP CONSTRAINT carburant_commandes_source_check;
ALTER TABLE carburant_commandes ADD CONSTRAINT carburant_commandes_source_check
  CHECK (source = ANY (ARRAY['nexus'::text, 'hors_nexus'::text, 'import_historique'::text]));
