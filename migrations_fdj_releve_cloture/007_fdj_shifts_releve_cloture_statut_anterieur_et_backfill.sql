-- Migration : fdj_shifts_releve_cloture_statut_anterieur_et_backfill (17/08/2026)
-- Correctif demandé par Frédéric le 17/08/2026, suite directe de la
-- sécurisation structurelle du 16/08/2026 (voir 005_fdj_shifts_releve_
-- cloture_statut.sql).
--
-- Le panneau manager "Relevés de clôture à régulariser"
-- (chargerShiftsReleveEnErreur, NEXUS-FDJ-Manager-v1.html) listait TOUT
-- quart validé dont releve_cloture_statut != 'ok' — ce qui incluait, à
-- tort, les quarts clôturés AVANT que la fonctionnalité "Trace de
-- contrôle FDJ" n'existe. Ces quarts n'ont jamais eu de relevé à écrire :
-- ce n'est pas une erreur à réparer, c'est un vide de conception
-- antérieur à la fonctionnalité. Les confondre avec un vrai échec
-- d'écriture aurait rendu le panneau inutilisable (des dizaines de faux
-- positifs, un pour chaque quart validé avant le 16/08/2026).
--
-- Ajout d'une 4e valeur 'anterieur' : quart validé sans relevé, mais
-- validé avant que le tout premier relevé de clôture n'ait jamais été
-- écrit sur ce site — donc structurellement hors périmètre, jamais un
-- signal d'alerte pour le manager.

alter table fdj_shifts
  drop constraint if exists fdj_shifts_releve_cloture_statut_check;
alter table fdj_shifts
  add constraint fdj_shifts_releve_cloture_statut_check
    check (releve_cloture_statut in ('en_attente', 'ok', 'erreur', 'anterieur'));

comment on column fdj_shifts.releve_cloture_statut is
  'Suivi de l''écriture du relevé de clôture (fdj_releves_cloture) associé à ce quart. '
  '''en_attente'' : quart pas encore validé (ou en cours de validation). '
  '''ok'' : au moins une version du relevé existe bien pour ce quart. '
  '''erreur'' : le quart est validé mais l''écriture du relevé a échoué — nécessite une reprise manager (retry). '
  '''anterieur'' : quart validé avant l''existence de la fonctionnalité Trace de contrôle FDJ — aucun relevé n''a jamais été tenté, ce n''est jamais un incident.';

-- Backfill 1 : un relevé existe déjà pour ce quart -> ok (rattrape aussi
-- les quarts régularisés par un manager AVANT le correctif du 17/08/2026
-- sur enregistrerEdition, qui n'écrivait pas encore ce statut).
update fdj_shifts s set releve_cloture_statut = 'ok'
where statut = 'valide'
  and releve_cloture_statut <> 'ok'
  and exists (select 1 from fdj_releves_cloture r where r.shift_id = s.id);

-- Backfill 2 : aucun relevé, et le quart a été validé avant l'écriture du
-- tout premier relevé jamais posé sur ce site -> antérieur à la
-- fonctionnalité, jamais une erreur. Un valide_le absent est traité comme
-- "très ancien" (les quarts sans date de validation connue précèdent tous
-- les mécanismes récents).
update fdj_shifts s set releve_cloture_statut = 'anterieur'
where statut = 'valide'
  and releve_cloture_statut = 'en_attente'
  and not exists (select 1 from fdj_releves_cloture r where r.shift_id = s.id)
  and coalesce(s.valide_le, '2000-01-01'::timestamptz) < (select min(cree_le) from fdj_releves_cloture);

-- Backfill 3 : ce qui reste à 'en_attente' est, par élimination, un quart
-- validé APRÈS l'existence de la fonctionnalité mais sans aucun relevé —
-- un vrai échec d'écriture historique, à afficher pour réparation.
update fdj_shifts s set releve_cloture_statut = 'erreur'
where statut = 'valide'
  and releve_cloture_statut = 'en_attente'
  and not exists (select 1 from fdj_releves_cloture r where r.shift_id = s.id);

-- Résultat appliqué le 17/08/2026 sur le site pilote (Vito Sainte-Marie
-- Usine) : 15 quarts reclassés 'anterieur', 4 déjà 'ok' confirmés, 0
-- 'erreur' résiduelle — le panneau manager repart à zéro faux positif.
