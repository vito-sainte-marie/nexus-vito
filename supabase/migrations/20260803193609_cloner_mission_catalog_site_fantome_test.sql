-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803193609 · cloner_mission_catalog_site_fantome_test
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- Le compte fantôme (employee_id 32ef8323-9209-4d75-8eac-1e9fc7c47ead, site_id
-- 'site-fantome-test', créé pour tester sans jamais toucher aux données réelles)
-- ne voyait aucune mission : mission_catalog n'avait jamais été cloné pour ce
-- site lors de son isolation initiale (contrairement à sites, station_config,
-- inventaire_zones/categories/zone_produit).
--
-- mission_id est une clé primaire GLOBALE (pas scopée par site), donc on ne
-- peut pas dupliquer les lignes réelles telles quelles : on dérive un nouvel
-- identifiant par un suffixe ('-fantome-test') plutôt qu'un préfixe, pour
-- préserver la logique existante m.mission_id.startsWith('MISSION-') utilisée
-- dans NEXUS-Missions-v1.html (certains mission_id réels commencent déjà par
-- "MISSION-").
insert into mission_catalog (
  mission_id, titre, pourquoi, famille, role_required, site, time_window,
  priority, estimated_duration_min, proof_required, validation_type, points,
  checklist, actif, impact_attendu_eur, site_id, necessite_produit, ponctuelle,
  photo_par_action
)
select
  mission_id || '-fantome-test', titre, pourquoi, famille, role_required,
  'site-fantome-test', time_window, priority, estimated_duration_min,
  proof_required, validation_type, points, checklist, actif,
  impact_attendu_eur, 'site-fantome-test', necessite_produit, ponctuelle,
  photo_par_action
from mission_catalog
where site_id = 'vito-sainte-marie';
