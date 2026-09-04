-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260902184726 · ajouter_source_planning_officiel
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Source officielle du planning — distincte du Google Sheet de recettes Verify.
alter table public.station_config
  add column if not exists planning_source text not null default 'nexus'
    check (planning_source in ('nexus','google_sheets')),
  add column if not exists planning_google_sheet_id text,
  add column if not exists planning_google_sheet_url text;

comment on column public.station_config.planning_source is
  'Source officielle présentée au manager et aux employés : nexus ou google_sheets.';
comment on column public.station_config.planning_google_sheet_id is
  'Identifiant du classeur de planning. Ne pas confondre avec google_sheet_id, réservé aux recettes Verify.';
comment on column public.station_config.planning_google_sheet_url is
  'Lien de consultation du planning officiel Google Sheets, visible uniquement aux utilisateurs authentifiés du même site via la RLS de station_config.';
