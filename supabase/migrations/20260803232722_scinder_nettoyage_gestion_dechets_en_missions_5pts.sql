-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803232722 · scinder_nettoyage_gestion_dechets_en_missions_5pts
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : retirer "Nettoyer et désinfecter les
-- sanitaires" et "Nettoyer surfaces, sols, vitrines et frigos en boutique"
-- du checklist de SOP-09, puis "chaque action vaut 5 pts" — même logique
-- que la scission de SOP-23 : chaque action restante devient sa propre
-- mission à 5 points, plutôt qu'une seule mission tout-ou-rien. SOP-09
-- désactivée (pas supprimée) pour préserver l'historique.

insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, site_id, necessite_produit, ponctuelle, photo_par_action)
values
('CHK-053','Balayer et nettoyer la piste','Une piste balayée régulièrement limite les débris et l’image négligée pour les clients.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Balayer et nettoyer la piste"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-054','Enlever les déchets de la piste et des abords','Des abords propres évitent l’accumulation de déchets visibles par les clients.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Enlever les déchets de la piste et des abords"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-055','Ranger les produits d’entretien dans le local prévu','Un rangement systématique évite les pertes et les risques liés aux produits d’entretien laissés à vue.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Ranger les produits d’entretien dans le local prévu"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-056','Vider les poubelles','Des poubelles vidées régulièrement évitent les débordements et les mauvaises odeurs.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Vider les poubelles"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-057','Respecter le tri sélectif','Le tri sélectif fait partie des obligations réglementaires et de l’image de la station.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Respecter le tri sélectif"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-058','Plier et stocker les cartons à l’endroit prévu','Des cartons pliés et stockés au bon endroit dégagent l’espace et évitent les risques d’incendie.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Plier et stocker les cartons à l’endroit prévu"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-059','Nettoyage final piste','Un dernier passage sur la piste garantit une image propre en fin de service.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Nettoyage final piste"]'::jsonb,true,'vito-sainte-marie',false,false,false),
('CHK-060','Nettoyage final boutique','Un dernier passage en boutique garantit une image propre en fin de service.','Exploitation',ARRAY['caissiere','manager','polyvalent','pompiste','renfort'],'vito-sainte-marie',null,'normale',5,true,'checklist',5,'["Nettoyage final boutique"]'::jsonb,true,'vito-sainte-marie',false,false,false);

insert into mission_catalog (mission_id, titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, site_id, necessite_produit, ponctuelle, photo_par_action)
select mission_id || '-fantome-test', titre, pourquoi, famille, role_required, site, time_window, priority, estimated_duration_min, proof_required, validation_type, points, checklist, actif, 'site-fantome-test', necessite_produit, ponctuelle, photo_par_action
from mission_catalog
where mission_id in ('CHK-053','CHK-054','CHK-055','CHK-056','CHK-057','CHK-058','CHK-059','CHK-060') and site_id='vito-sainte-marie';

update mission_catalog set actif=false where mission_id in ('SOP-09','SOP-09-fantome-test');
