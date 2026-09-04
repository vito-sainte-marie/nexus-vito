-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803212712 · scinder_prise_de_poste_pompiste_en_missions_5pts
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : "pour la prise de poste pompiste, tous
-- les petits segments deviennent des missions à 5 pts" — au lieu d'une seule
-- mission SOP-23 à 10 pts avec une checklist de 7 actions (tout ou rien),
-- chaque segment devient sa propre mission autonome à 5 points, validable
-- indépendamment. SOP-23 est désactivée (actif=false), pas supprimée, pour
-- préserver l'historique des complétions passées.

insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, site_id, necessite_produit, ponctuelle, photo_par_action)
values
('CHK-046','Nettoyer la piste et ses abords','Une piste propre en début de service évite les glissades et donne une première image professionnelle aux clients.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'normale',10,true,'checklist',5,'["Nettoyer intégralement la piste et ses abords"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-047','Relevé d’index (prise de poste)','Un relevé fiable en prise de poste sécurise le suivi des ventes carburant sur tout le quart.','Sécurité',ARRAY['pompiste'],'vito-sainte-marie',null,'haute',5,true,'checklist',5,'["Effectuer les relevés d’index"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-048','Comptage gaz et glaçons (prise de poste)','Un comptage en début de quart permet de détecter tout écart avant que la journée ne commence.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Compter le gaz et les glaçons"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-049','Installer les extincteurs à leur emplacement','Des extincteurs correctement positionnés sont indispensables en cas d’incident sur la piste.','Sécurité',ARRAY['pompiste'],'vito-sainte-marie',null,'critique',5,true,'checklist',5,'["Installer les extincteurs à leur emplacement"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-050','Signalisation et zones de sécurité (prise de poste)','Une signalisation claire et des zones dégagées protègent clients et employés dès l’ouverture.','Sécurité',ARRAY['pompiste'],'vito-sainte-marie',null,'critique',5,true,'checklist',5,'["Mettre en place la signalisation et dégager les zones de sécurité"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-051','Vider les poubelles extérieures de la piste','Des poubelles vidées en début de quart évitent les débordements et gardent la piste propre pour la journée.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Vider les poubelles extérieures de la piste"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-052','Nettoyer les pompes','Des pompes propres en prise de poste renvoient une image soignée et facilitent la détection de fuites.','Exploitation',ARRAY['pompiste'],'vito-sainte-marie',null,'normale',10,true,'checklist',5,'["Nettoyer les pompes"]'::jsonb,true,'vito-sainte-marie',false,false,false);

insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, site_id, necessite_produit, ponctuelle, photo_par_action)
select mission_id || '-fantome-test', titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, 'site-fantome-test', necessite_produit, ponctuelle, photo_par_action
from mission_catalog
where mission_id in ('CHK-046','CHK-047','CHK-048','CHK-049','CHK-050','CHK-051','CHK-052') and site_id='vito-sainte-marie';

update mission_catalog set actif=false where mission_id in ('SOP-23','SOP-23-fantome-test');
