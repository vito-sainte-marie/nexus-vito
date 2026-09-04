-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803232158 · retirer_eclairage_reception_carburant_fermeture_pour_pompiste
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : retirer du rôle pompiste
-- "Contrôle éclairage extérieur (soir)" et "Fermeture station" (restent pour les autres rôles),
-- et supprimer "Réception carburant (citerne)" qui n'était affectée qu'au pompiste
-- (redondante avec SOP-05 "Sécurisation livraison carburant" désormais détaillée) —
-- désactivée plutôt que supprimée pour préserver l'historique.

update mission_catalog
set role_required = array['caissiere','polyvalent','renfort']
where mission_id in ('CHK-018','CHK-018-fantome-test');

update mission_catalog
set role_required = array['caissiere','manager','polyvalent','renfort']
where mission_id in ('CHK-005','CHK-005-fantome-test');

update mission_catalog
set actif = false
where mission_id in ('CHK-010','CHK-010-fantome-test');
