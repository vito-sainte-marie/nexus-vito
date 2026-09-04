-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803235825 · ajouter_statut_validation_mission_completions
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Demande de Frédéric (03/08/2026) : nouveau système de score avec
-- "points en attente de validation" / "points validés". Décision : seules
-- les missions à preuve photo (mission_catalog.proof_required=true)
-- passent par une validation manager ; les autres restent créditées
-- immédiatement, comme aujourd'hui.
--
-- Backfill : tout l'historique existant est marqué 'valide' (on ne va pas
-- demander aux managers de rejuger a posteriori des mois de complétions
-- passées — seules les complétions à venir suivent la nouvelle règle).

alter table mission_completions
  add column if not exists statut_validation text not null default 'valide',
  add column if not exists valide_par uuid,
  add column if not exists valide_le timestamptz;

update mission_completions set statut_validation = 'valide' where statut_validation is null;

alter table mission_completions
  add constraint mission_completions_statut_validation_check
  check (statut_validation in ('valide','en_attente'));
