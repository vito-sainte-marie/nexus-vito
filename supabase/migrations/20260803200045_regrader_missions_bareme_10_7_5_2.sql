-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803200045 · regrader_missions_bareme_10_7_5_2
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- Demande de Frédéric (03/08/2026) : refonte de NEXUS-Missions-v1.html en
-- paliers de points 10/7/5/2. Les points réels en base ne rentraient pas
-- proprement dans ce barème (valeurs à 6 et 20, et rien à 2 — le palier
-- "Actions rapides" aurait été vide au lancement). Choix éditoriaux
-- (soumis à Frédéric, ajustables ensuite) :
--
--  20 → 10 : Prise de poste pompiste (SOP-23) — poids équivalent aux
--            autres missions "essentielles" (Ouverture/Fermeture station),
--            juste une valeur mal calibrée à l'origine.
--   6 → 7  : Drop de caisse (SOP-03), Relevé jaugeage carburant (SOP-26),
--            Ronde de sécurité fermeture (SOP-11) — poids sécurité/argent,
--            plus proches de "prioritaire" que de "régulière".
--   6 → 5  : Rangement et contrôle du dépôt (SOP-15) — tâche de routine.
--   5 → 2  : Renseigner et orienter les clients (CHK-023), Aide ponctuelle
--            en poste (CHK-022), Contrôle éclairage extérieur soir
--            (CHK-018) — actions rapides et simples, pour peupler le
--            palier "Actions rapides" qui était vide.
--
-- Appliqué sur le site réel ET le clone -fantome-test (mêmes mission_id
-- suffixés '-fantome-test').
update mission_catalog set points = 10
where mission_id in ('SOP-23', 'SOP-23-fantome-test');

update mission_catalog set points = 7
where mission_id in ('SOP-03', 'SOP-03-fantome-test', 'SOP-26', 'SOP-26-fantome-test', 'SOP-11', 'SOP-11-fantome-test');

update mission_catalog set points = 5
where mission_id in ('SOP-15', 'SOP-15-fantome-test');

update mission_catalog set points = 2
where mission_id in ('CHK-023', 'CHK-023-fantome-test', 'CHK-022', 'CHK-022-fantome-test', 'CHK-018', 'CHK-018-fantome-test');
