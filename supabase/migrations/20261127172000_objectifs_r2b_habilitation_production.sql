-- R2b : première habilitation des objectifs, PRODUCTION SEULEMENT.
--
-- Migration Production seule, avec son propre GO. Elle n'a pas besoin de passer
-- sur Test : sur Test, les droits sont posés par la recette de Guardian.
-- Elle ne doit pas être appliquée avant R1, R2, la garde de rôle (20261127170500)
-- et A4-1b.
--
-- CE QU'ELLE FAIT. Accorde le droit « valider » (qui implique proposer et lire)
-- aux comptes ACTIFS de la station vito-sainte-marie dont le rôle est manager ou
-- gerant, ou qui ont est_createur. C'est le même critère que la garde de rôle de
-- accorder_droit_objectif : personne ne reçoit ici ce que la RPC refuserait.
--
-- SÉLECTION PAR CRITÈRE. Aucun identifiant, aucun nom, aucun courriel n'est écrit
-- dans ce fichier. La liste des comptes se lit en base au moment de l'application.
--
-- TRACE « MIGRATION ». accorde_par reste NUL. Toute habilitation posée par la RPC
-- accorder_droit_objectif porte auth.uid() dans accorde_par ; une ligne dont
-- accorde_par est nul n'a donc été posée que par une migration. C'est la marque
-- qui permet au retour arrière de retirer exactement ces lignes.
--
-- IDEMPOTENCE. on conflict do nothing : une ligne déjà présente (accordée par la
-- RPC, ou révoquée volontairement) n'est ni écrasée ni ressuscitée. Rejouée, la
-- migration ne pose rien de plus.
--
-- ROLLBACK : supabase/retours/20261127172000_retour_objectifs_r2b_habilitation_production.sql

insert into public.objectif_habilitation (site, employe_id, droit, accorde_par)
select e.site_id, e.id, 'valider', null
from public.employees e
where e.site_id = 'vito-sainte-marie'
  and e.actif = true
  and (e.role in ('manager', 'gerant') or coalesce(e.est_createur, false))
on conflict (site, employe_id, droit) do nothing;
