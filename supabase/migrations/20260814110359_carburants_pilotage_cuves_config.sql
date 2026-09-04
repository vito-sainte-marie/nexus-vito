-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260814110359 · carburants_pilotage_cuves_config
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table station_config add column if not exists cuves_carburants jsonb;
comment on column station_config.cuves_carburants is 'Config par carburant (go/sp95/gnr) : {actif, label, cuves:[{id,label,capacite}]}. NULL = pas encore configuré (repli sur les valeurs par défaut codées côté client). 13/08/2026, audit Carburants Pilotage de Frédéric.';

update station_config
set cuves_carburants = '{
  "go": {"actif": true, "label": "Gasoil (GO)", "cuves": [
    {"id": "cuve1", "label": "Cuve 1", "capacite": 20000},
    {"id": "cuve2", "label": "Cuve 2", "capacite": 10000}
  ]},
  "sp95": {"actif": true, "label": "Sans plomb (SP95)", "cuves": [
    {"id": "unique", "label": "Cuve unique", "capacite": 30000}
  ]},
  "gnr": {"actif": true, "label": "Gasoil non routier (GNR)", "cuves": [
    {"id": "unique", "label": "Cuve unique", "capacite": 30000}
  ]}
}'::jsonb
where site = 'vito-sainte-marie';
