alter table station_config
  add column if not exists google_sheet_id text;

comment on column station_config.google_sheet_id is
  'Identifiant du Google Sheet de recettes journalières pour ce site (partie de l''URL entre /d/ et /edit). Null = synchronisation Google Sheets désactivée pour ce site — utilisé par la fonction google-sheets-sync et par NEXUS-Verify-v1.html.';
