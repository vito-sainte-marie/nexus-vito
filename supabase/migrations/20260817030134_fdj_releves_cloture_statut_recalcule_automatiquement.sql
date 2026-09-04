-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817030134 · fdj_releves_cloture_statut_recalcule_automatiquement
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table fdj_releves_cloture
  drop constraint if exists fdj_releves_cloture_statut_check;
alter table fdj_releves_cloture
  add constraint fdj_releves_cloture_statut_check
    check (statut in ('conforme', 'valide_avec_ecart', 'regularise', 'recalcule_automatiquement'));
