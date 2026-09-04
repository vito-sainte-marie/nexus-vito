-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803194737 · retirer_missions_et_fenetre_ouverture_station
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- Demande de Frédéric (03/08/2026) :
-- 1) "Ouverture station" (CHK-004) ne doit plus être proposée après 6h du
--    matin — utilise la colonne time_window, jusqu'ici jamais exploitée par
--    aucun écran. Convention posée ici : 'avant-HH:MM' = mission visible
--    strictement avant cette heure locale, filtré côté client (NEXUS-Missions-v1.html
--    et NEXUS-Pointage-v1.html, seuls écrans qui affichent des missions
--    récurrentes du jour).
-- 2) Retrait pour tous les employés (désactivation, pas suppression : on ne
--    perd jamais l'historique des complétions passées, qui référencent ces
--    mission_id) de : Clôture de caisse, Réception fournisseur, Contrôle
--    vente FDJ, Relevé Inventaire de Quart.
-- Appliqué sur le site réel ET le site fantôme isolé (clones -fantome-test)
-- pour que le compte de test reflète fidèlement ce que verront les vrais
-- employés.

update mission_catalog set time_window = 'avant-06:00'
where mission_id in ('CHK-004', 'CHK-004-fantome-test');

update mission_catalog set actif = false
where mission_id in (
  'CHK-006', 'CHK-006-fantome-test',
  'CHK-003', 'CHK-003-fantome-test',
  'CHK-019', 'CHK-019-fantome-test',
  'CHK-025', 'CHK-025-fantome-test'
);
