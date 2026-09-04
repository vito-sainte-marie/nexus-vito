-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803231425 · retirer_impaye_pompiste_supprimer_signalisation_maj_ronde_securite
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) :
-- 1) "Gestion d'un impayé" ne concerne plus le pompiste (retiré de role_required, reste pour manager)
-- 2) "Signalisation et zones de sécurité (prise de poste)" (CHK-050, créée hier pour le pompiste) est supprimée du parcours — désactivée, pas supprimée, pour préserver l'historique
-- 3) "Ronde de sécurité (fermeture)" (SOP-11) : nouveau checklist dicté par Frédéric

update mission_catalog
set role_required = array['manager']
where mission_id in ('CHK-016','CHK-016-fantome-test');

update mission_catalog
set actif = false
where mission_id in ('CHK-050','CHK-050-fantome-test');

update mission_catalog
set checklist = '["Vérifier les portes et le rideau métallique","Vérifier les barres et cadenas sur les cages à gaz et glaçons","Vérifier que les lumières extérieures de la boutique sont bien allumées","Effectuer une ronde complète du site","Vérifier que tous les TPE sont en charge","Vérifier qu’aucune clé ne quitte le site sans autorisation","Signaler tout comportement suspect"]'::jsonb
where mission_id in ('SOP-11','SOP-11-fantome-test');
