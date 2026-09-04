-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260903130746 · station_config_planning_onglet_prefixe
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Convention de nommage des onglets du classeur de planning (03/09/2026).
-- Le classeur « Planning Energy 2026 » contient un onglet par site ET par
-- mois : SMU09 pour Sainte-Marie Usine en septembre, SMU10 en octobre. Le
-- préfixe désigne le site, les deux chiffres le mois. NEXUS dérive donc le
-- nom de l'onglet du mois affiché, sans que personne ait à le ressaisir.
alter table public.station_config
  add column if not exists planning_onglet_prefixe text;

comment on column public.station_config.planning_onglet_prefixe is
'Préfixe des onglets de planning dans le classeur Google (ex. "SMU"). L''onglet lu est <prefixe><mois sur 2 chiffres> : SMU09, SMU10… Le classeur mélangeant plusieurs sites, ce préfixe est ce qui garantit qu''on lit la bonne équipe — il n''est jamais deviné.';
