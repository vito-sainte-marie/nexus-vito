-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260804002723 · gater_sop26_jaugeage_matin_uniquement
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Complète la restriction "jaugeage carburant réservé au matin quart1"
-- (tâche #155) au niveau du catalogue Missions : sans ça, SOP-26 apparaissait
-- comme "obligatoire" toute la journée, y compris l'après-midi/soir, ce qui
-- va à l'encontre de la demande de Frédéric ("le potentiel doit correspondre
-- aux missions réellement réalisables ce jour-là"). Convention déjà utilisée
-- ailleurs (quartDuMoment() : h<13 = matin) — même seuil ici.
update mission_catalog
set time_window = 'avant-13:00'
where mission_id in ('SOP-26','SOP-26-fantome-test');
