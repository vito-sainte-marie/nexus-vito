-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803231955 · maj_checklist_securisation_livraison_carburant
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : nouveau checklist pour SOP-05 "Sécurisation livraison carburant"
update mission_catalog
set checklist = '["Couper les pompes au niveau du pupitre","Placer les plots sur la piste","Informer les clients et votre binôme que vous effectuez une réception de carburant","Récupérer l’extincteur et le placer dans la zone de dépotage","Vérifier le bon déroulement de la livraison","Remplir votre registre avec toutes les informations demandées","Signaler immédiatement votre supérieur hiérarchique pour tout incident"]'::jsonb
where mission_id in ('SOP-05','SOP-05-fantome-test');
