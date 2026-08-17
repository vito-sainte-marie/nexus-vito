-- Migration : fdj_shifts_releve_cloture_statut (16/08/2026)
-- Sécurisation structurelle demandée par Frédéric, point 4 : "Éviter
-- qu'un quart puisse être validé sans son relevé de clôture. Idéalement
-- regrouper la clôture dans une RPC/Edge Function transactionnelle ou
-- prévoir un mécanisme pending/error/retry."
--
-- Choix retenu : mécanisme pending/error/retry plutôt qu'une RPC
-- transactionnelle unique. Les CALCULS de clôture (écart, statut, diff,
-- caractère) restent des fonctions pures dans nexus-fdj-moteur.js, seule
-- source de vérité (Article 11) — les déplacer dans une fonction Postgres
-- dupliquerait cette logique dans deux langages. À la place : la
-- validation d'un quart (comptages, rapports, caisse, statut du quart)
-- reste séparée de l'écriture du relevé de clôture, mais cette dernière
-- est désormais TRACÉE explicitement sur fdj_shifts — un quart validé
-- dont le relevé a échoué n'est jamais silencieux, il devient visible et
-- réparable côté manager (voir NEXUS-FDJ-Manager-v1.html, panneau
-- "Relevés de clôture à régulariser" + reessayerReleveClotureManquant()).

alter table fdj_shifts
  add column if not exists releve_cloture_statut text not null default 'en_attente'
    check (releve_cloture_statut in ('en_attente', 'ok', 'erreur'));

comment on column fdj_shifts.releve_cloture_statut is
  'Suivi de l''écriture du relevé de clôture (fdj_releves_cloture) associé à ce quart. '
  '''en_attente'' : quart pas encore validé (ou en cours de validation). '
  '''ok'' : au moins une version du relevé existe bien pour ce quart. '
  '''erreur'' : le quart est validé mais l''écriture du relevé a échoué — nécessite une reprise manager (retry).';
