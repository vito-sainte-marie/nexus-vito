-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260824123103 · ajouter_fuseau_horaire_station_config
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table station_config add column if not exists fuseau_horaire text not null default 'America/Martinique';
comment on column station_config.fuseau_horaire is 'Fuseau IANA de la station (ex. America/Martinique), utilisé pour convertir les horaires de quart (station_config.horaires) en instants UTC réels et pour l''affichage des heures de jaugeage carburant. Paramétrable depuis NEXUS-Parametres-Station-v1.html. Ajouté v2.232, 24/08/2026 -- corrige un fuseau Europe/Paris codé en dur qui décalait de plusieurs heures les fenêtres de quart carburant et l''heure affichée pour une station en Martinique.';
