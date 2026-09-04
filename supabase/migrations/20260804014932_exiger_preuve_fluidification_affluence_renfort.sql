-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260804014932 · exiger_preuve_fluidification_affluence_renfort
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Règle "les missions majeures nécessitent une validation manager ou une
-- preuve" (03/08/2026, demande de Frédéric) : CHK-065 (10 pts) était la
-- seule des 6 missions majeures renfort sans preuve requise.
update mission_catalog
set proof_required = true
where mission_id in ('CHK-065', 'CHK-065-fantome-test');
