-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260817030204 · fdj_shifts_releve_cloture_statut
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table fdj_shifts
  add column if not exists releve_cloture_statut text not null default 'en_attente'
    check (releve_cloture_statut in ('en_attente', 'ok', 'erreur'));

comment on column fdj_shifts.releve_cloture_statut is
  'Suivi de l''écriture du relevé de clôture (fdj_releves_cloture) associé à ce quart. '
  '''en_attente'' : quart pas encore validé (ou en cours de validation). '
  '''ok'' : au moins une version du relevé existe bien pour ce quart. '
  '''erreur'' : le quart est validé mais l''écriture du relevé a échoué — nécessite une reprise manager (retry).';
