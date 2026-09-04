-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260801144434 · add_google_sheet_id_station_config
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table station_config
  add column if not exists google_sheet_id text;

comment on column station_config.google_sheet_id is
  'Identifiant du Google Sheet de recettes journalières pour ce site (partie de l''URL entre /d/ et /edit). Null = synchronisation Google Sheets désactivée pour ce site — utilisé par la fonction google-sheets-sync et par NEXUS-Verify-v1.html.';
