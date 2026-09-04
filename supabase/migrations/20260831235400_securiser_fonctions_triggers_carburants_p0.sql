-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831235400 · securiser_fonctions_triggers_carburants_p0
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

revoke execute on function public.nexus_journaliser_anomalie_reception_mesuree() from anon, authenticated;
revoke execute on function public.nexus_preserver_releve_ouverture_lors_reception() from anon, authenticated;
