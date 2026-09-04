-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803232413 · maj_sop09_ajout_nettoyage_final_photo_par_action
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : ajouter "Nettoyage final piste" et
-- "Nettoyage final boutique" au checklist de SOP-09, et exiger une photo
-- pour chaque action (photo_par_action=true, au lieu d'une preuve globale).

update mission_catalog
set checklist = checklist || '["Nettoyage final piste","Nettoyage final boutique"]'::jsonb,
    photo_par_action = true
where mission_id in ('SOP-09','SOP-09-fantome-test');
