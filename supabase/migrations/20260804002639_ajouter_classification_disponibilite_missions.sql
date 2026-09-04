-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260804002639 · ajouter_classification_disponibilite_missions
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026, retour détaillé sur l'interface employé) :
-- distinguer missions obligatoires / disponibles selon besoin / conditionnelles
-- (situationnelles), pour ne plus afficher "22 missions obligatoires" alors
-- que la plupart ne sont pas de vraies obligations du jour.
--
-- Défaut 'disponible' pour toute mission non listée explicitement ci-dessous.
-- Classification (voir résumé transparent envoyé à Frédéric) :
--   obligatoire   = doit être fait à chaque service concerné (ouverture,
--                   fermeture, ronde sécurité, prise de poste pompiste,
--                   contrôle extincteurs, DLC point chaud, brief équipe...)
--   conditionnelle = ne s'applique que si une situation réelle survient
--                   (livraison carburant, anomalie technique, impayé,
--                   renfort demandé ailleurs, seuil de caisse atteint...)

alter table mission_catalog
  add column if not exists disponibilite text not null default 'disponible';

alter table mission_catalog
  add constraint mission_catalog_disponibilite_check
  check (disponibilite in ('obligatoire','disponible','conditionnelle'));

update mission_catalog
set disponibilite = 'obligatoire'
where regexp_replace(mission_id, '-fantome-test$', '') in (
  'CHK-004','CHK-005','CHK-008','CHK-013',
  'CHK-046','CHK-047','CHK-048','CHK-049','CHK-051','CHK-052',
  'CHK-059','CHK-060','CHK-011','SOP-11','SOP-26','SOP-24'
);

update mission_catalog
set disponibilite = 'conditionnelle'
where regexp_replace(mission_id, '-fantome-test$', '') in (
  'CHK-061','SOP-05','CHK-016','SOP-03','CHK-022','CHK-015',
  'CHK-027','CHK-028','caisse-justifier-ecart','qualite-controle-tenue-employe'
);
