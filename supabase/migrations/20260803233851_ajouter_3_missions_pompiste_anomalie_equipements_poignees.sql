-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803233851 · ajouter_3_missions_pompiste_anomalie_equipements_poignees
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : 3 nouvelles missions pompiste.

insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, site_id, necessite_produit, ponctuelle, photo_par_action)
values
('CHK-061','Signaler une anomalie technique','Une panne identifiée et signalée rapidement évite qu’elle ne s’aggrave et accélère sa prise en charge.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'haute',5,true,'checklist',7,'["Identifier précisément une panne ou un dysfonctionnement et créer un signalement exploitable avec photo"]'::jsonb,true,'vito-sainte-marie',false,false,true),
('CHK-062','Contrôle des équipements de service','Un gonfleur et un aspirateur fonctionnels sont un service attendu par les clients et une source de satisfaction.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'haute',5,true,'checklist',7,'["Vérifier le gonfleur et/ou l’aspirateur avec photo"]'::jsonb,true,'vito-sainte-marie',false,false,true),
('CHK-063','Nettoyer les poignées et écrans des pompes','Des poignées et écrans propres améliorent l’hygiène perçue par les clients, sans interrompre la distribution.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'normale',5,false,'checklist',5,'["Nettoyer les zones de contact (écrans, pistolets) sans gêner la distribution"]'::jsonb,true,'vito-sainte-marie',false,false,false);

insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, site_id, necessite_produit, ponctuelle, photo_par_action)
select mission_id || '-fantome-test', titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, 'site-fantome-test', necessite_produit, ponctuelle, photo_par_action
from mission_catalog
where mission_id in ('CHK-061','CHK-062','CHK-063') and site_id='vito-sainte-marie';
