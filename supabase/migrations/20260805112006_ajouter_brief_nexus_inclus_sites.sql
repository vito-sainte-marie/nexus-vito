-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260805112006 · ajouter_brief_nexus_inclus_sites
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

ALTER TABLE sites ADD COLUMN IF NOT EXISTS brief_nexus_inclus boolean NOT NULL DEFAULT true;
