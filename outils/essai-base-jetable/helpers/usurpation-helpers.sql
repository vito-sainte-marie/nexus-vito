-- Analyse de sécurité des helpers d'identité partagés (arbitrage du 17/10/2026,
-- décision 4). Base jetable UNIQUEMENT. Une transaction, ROLLBACK final.
--
-- Question : un rôle client qui peut exécuter du SQL arbitraire dans sa session
-- peut-il fausser current_employee_site_id(), current_employee_role() et
-- je_suis_createur() en créant une table temporaire « employees » ?
-- Ces helpers sont SECURITY DEFINER, search_path=public, et lisent « employees »
-- sans schéma : pg_temp est alors cherché AVANT public pour les relations.
--
-- La preuve mesure l'effet sur une vraie politique RLS (select_employees), pas
-- seulement la valeur rendue par le helper.
\set ON_ERROR_STOP 1
begin;
create temp table constat (n serial, cas text, attendu text, obtenu text) on commit drop;
grant all on constat to public;
grant all on sequence constat_n_seq to public;

insert into sites(site_id, nom_entreprise, timezone) values
  ('usurp-a', 'Usurpation A', 'America/Martinique'), ('usurp-b', 'Usurpation B', 'America/Martinique');
insert into employees(id, username, nom, role, site_id) values
  ('00000000-0000-4000-8000-00000000c0a1', 'usurp-pompiste-a', 'Usurp Pompiste A', 'pompiste', 'usurp-a'),
  ('00000000-0000-4000-8000-00000000c0b1', 'usurp-manager-b',  'Usurp Manager B',  'manager',  'usurp-b'),
  ('00000000-0000-4000-8000-00000000c0b2', 'usurp-pompiste-b', 'Usurp Pompiste B', 'pompiste', 'usurp-b');

-- Le pompiste A, authentifié, comme PostgREST le pose.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000c0a1","role":"authenticated"}', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000c0a1', true);

insert into pg_temp.constat(cas, attendu, obtenu) values
  ('1 site vu par le helper, sans usurpation', 'usurp-a', coalesce(public.current_employee_site_id(), 'null')),
  ('2 rôle vu par le helper, sans usurpation', 'pompiste', coalesce(public.current_employee_role(), 'null')),
  ('3 employés du site B lisibles, sans usurpation', '0',
     (select count(*)::text from public.employees where site_id = 'usurp-b'));

-- L'usurpation : une table temporaire qui porte le même nom.
do $$ begin
  create temp table employees (id uuid, site_id text, role text, est_createur boolean);
  insert into pg_temp.constat(cas, attendu, obtenu) values ('4 table temporaire « employees » créable', 'refus', 'acceptée');
exception when insufficient_privilege then
  insert into pg_temp.constat(cas, attendu, obtenu) values ('4 table temporaire « employees » créable', 'refus', 'refus');
end $$;

do $$ begin
  if to_regclass('pg_temp.employees') is not null then
    insert into pg_temp.employees values ('00000000-0000-4000-8000-00000000c0a1', 'usurp-b', 'manager', true);
  end if;
end $$;

insert into pg_temp.constat(cas, attendu, obtenu) values
  ('5 site vu par le helper, après usurpation', 'usurp-a', coalesce(public.current_employee_site_id(), 'null')),
  ('6 rôle vu par le helper, après usurpation', 'pompiste', coalesce(public.current_employee_role(), 'null')),
  ('7 je_suis_createur, après usurpation', 'false', coalesce(public.je_suis_createur()::text, 'null')),
  ('8 employés du site B lisibles (politique RLS réelle), après usurpation', '0',
     (select count(*)::text from public.employees where site_id = 'usurp-b'));

reset role;
select n, cas, attendu, obtenu, case when attendu = obtenu then 'tenu' else 'USURPÉ' end as verdict from constat order by n;
select 'HELPERS : ' || count(*) filter (where attendu <> obtenu) || ' écart(s) sur ' || count(*) as bilan from constat;
rollback;
