-- Préflight de la remise à zéro Paye d'octobre 2026 — LECTURE SEULE.
--
-- Décision : docs/handoff/lots/NEXUS-HEURES-VERIFY-PAYE-1-20261009/decision-1.md
-- Dossier  : docs/plans/2026-10-10-remise-a-zero-paye-octobre.md
--
-- Ce script ne modifie rien : il ouvre une transaction `read only` et la
-- referme par `rollback`. Il échoue (code de sortie non nul) si l'état
-- mesuré le 10/10/2026 a changé, c'est-à-dire si une remise à zéro en base
-- aurait désormais quelque chose à toucher.
--
-- Exécution — ON_ERROR_STOP est obligatoire : sans lui, un `raise exception`
-- défile et psql sort quand même en 0.
--
--   psql "$URL" -X -v ON_ERROR_STOP=1 -f docs/plans/2026-10-10-remise-a-zero-paye-octobre-preflight.sql
--
-- Le rôle `nexus_prod_readonly` n'a PAS le droit SELECT sur
-- nexus_paye_items ni sur nexus_paye_periodes (mesuré le 10/10, 12:01Z) :
-- ce script exige un rôle qui les lit. Un refus de permission fait échouer
-- le script, il ne rend jamais « 0 ».

\set ON_ERROR_STOP on
begin read only;

do $$
declare
  n_auto      integer;
  n_periodes  integer;
  n_pointages integer;
begin
  -- 1. Cible de la décision Q3 : retards et heures supplémentaires en base,
  --    période d'effet >= 2026-10-01. Mesuré : 0.
  select count(*) into n_auto
    from public.nexus_paye_items
   where periode >= date '2026-10-01'
     and type_item in ('retard', 'retard_incoherent', 'heure_supplementaire');
  if n_auto <> 0 then
    raise exception 'STOP : % ligne(s) retard/heure_supplementaire >= 2026-10 en base. Chaque ligne est une décision manager (cree_par renseigné) : périmètre à rechiffrer, rien à exécuter.', n_auto;
  end if;

  -- 2. Condition 5 : aucun mois validé ou transmis. Mesuré : 0 période.
  select count(*) into n_periodes
    from public.nexus_paye_periodes
   where statut in ('verifie', 'transmis');
  if n_periodes <> 0 then
    raise exception 'STOP : % période(s) Paye validée(s) ou transmise(s) — Q2 doit être tranchée avant toute suite.', n_periodes;
  end if;

  -- 3. Source des retards du moteur servi : pointages. Dernier pointage le
  --    2026-08-30. Mesuré : 0 en octobre.
  select count(*) into n_pointages
    from public.pointages
   where date >= '2026-10-01';
  if n_pointages <> 0 then
    raise exception 'STOP : % pointage(s) en octobre — le moteur servi en déduirait des retards.', n_pointages;
  end if;

  raise notice 'PRÉFLIGHT VERT : 0 ligne à remettre à zéro, 0 période validée, 0 pointage d''octobre.';
end $$;

-- Témoins à recopier dans le journal (aucun n'est une condition) :
select periode, type_item, origine, statut, count(*) as lignes
  from public.nexus_paye_items
 group by 1, 2, 3, 4
 order by 1, 2, 3, 4;

select statut, count(*) as services, count(*) filter (where heure_fin is null) as sans_fin
  from public.shifts
 where heure_debut >= '2026-10-01'
 group by 1
 order by 1;

rollback;
