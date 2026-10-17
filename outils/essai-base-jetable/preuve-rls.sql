-- Essai de faisabilité (17/10/2026) : la base jetable sait-elle PROUVER des
-- autorisations ET des refus, avec des identités distinctes ?
--
-- Exécuté UNIQUEMENT sur la base locale jetable, après la reconstruction.
-- Une seule transaction, terminée par ROLLBACK : même jetable, rien ne reste.
-- Objet éprouvé : carburant_index_releves (migration 20261016230000), ses
-- politiques RLS, et les fonctions SECURITY DEFINER d'identité du baseline.
-- Données synthétiques, préfixe « essai- » : aucune donnée réelle.
\set ON_ERROR_STOP 1
\set VERBOSITY verbose

begin;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public;
grant all on sequence journal_n_seq to public;

create function pg_temp.note(p_cas text, p_attendu text, p_obtenu text) returns void language sql as $$
  insert into pg_temp.journal(cas, attendu, obtenu, ok) values (p_cas, p_attendu, p_obtenu, p_attendu = p_obtenu);
$$;
grant execute on function pg_temp.note(text, text, text) to public;

-- Endosser une identité comme le fait PostgREST : rôle + claims du JWT.
create function pg_temp.comme(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end $$;
grant execute on function pg_temp.comme(text, uuid) to public;

-- Semis synthétique, sous le propriétaire des tables.
insert into sites(site_id, nom_entreprise, timezone) values ('essai-site-a', 'Essai A', 'America/Martinique'), ('essai-site-b', 'Essai B', 'America/Martinique');
insert into employees(id, username, nom, role, site_id) values
  ('00000000-0000-4000-8000-0000000000a1', 'essai-pompiste-a', 'Essai Pompiste A', 'pompiste', 'essai-site-a'),
  ('00000000-0000-4000-8000-0000000000a2', 'essai-manager-a',  'Essai Manager A',  'manager',  'essai-site-a'),
  ('00000000-0000-4000-8000-0000000000b2', 'essai-manager-b',  'Essai Manager B',  'manager',  'essai-site-b');
insert into carburant_index_releves(site, date, moment, auteur) values
  ('essai-site-a', current_date, 'fin_q1', '00000000-0000-4000-8000-0000000000a2'),
  ('essai-site-b', current_date, 'fin_q1', '00000000-0000-4000-8000-0000000000b2');

-- 1. Anonyme : aucune ligne lisible (refus par droit ou par RLS).
select pg_temp.comme('anon', null);
do $$ declare v int; begin
  select count(*) into v from carburant_index_releves where site like 'essai-%';
  perform pg_temp.note('1 anon lit les relevés', 'refus', case when v = 0 then 'refus' else 'lit ' || v end);
exception when insufficient_privilege then
  perform pg_temp.note('1 anon lit les relevés', 'refus', 'refus');
end $$;
reset role;

-- 2. Fonction SECURITY DEFINER d'identité, sous trois identités.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000a1');
select pg_temp.note('2a current_employee_site_id, pompiste A', 'essai-site-a', coalesce(current_employee_site_id(), 'null'));
reset role;
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000b2');
select pg_temp.note('2b current_employee_site_id, manager B', 'essai-site-b', coalesce(current_employee_site_id(), 'null'));
reset role;
select pg_temp.comme('anon', null);
do $$ begin
  perform pg_temp.note('2c current_employee_site_id, anon', 'null', coalesce(current_employee_site_id(), 'null'));
exception when insufficient_privilege then
  perform pg_temp.note('2c current_employee_site_id, anon', 'null', 'refus d''exécution');
end $$;
reset role;

-- 3. Autorisation : le pompiste A voit le relevé de son site, et lui seul.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000a1');
do $$ begin
  perform pg_temp.note('3 pompiste A lit', 'essai-site-a',
    (select coalesce(string_agg(site, ',' order by site), 'rien') from carburant_index_releves where site like 'essai-%'));
exception when insufficient_privilege then
  perform pg_temp.note('3 pompiste A lit', 'essai-site-a', 'refus de droit');
end $$;
reset role;

-- 4. Refus inter-site : le manager B ne voit pas le site A.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000b2');
do $$ begin
  perform pg_temp.note('4 manager B lit', 'essai-site-b',
    (select coalesce(string_agg(site, ',' order by site), 'rien') from carburant_index_releves where site like 'essai-%'));
exception when insufficient_privilege then
  perform pg_temp.note('4 manager B lit', 'essai-site-b', 'refus de droit');
end $$;
reset role;

-- 5. Refus d'écriture inter-site : le manager A ne crée rien sur le site B.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000a2');
do $$ begin
  insert into carburant_index_releves(site, date, moment, auteur)
    values ('essai-site-b', current_date, 'fin_q2', '00000000-0000-4000-8000-0000000000a2');
  perform pg_temp.note('5 manager A écrit sur le site B', 'refus', 'accepté');
exception when insufficient_privilege or check_violation then
  perform pg_temp.note('5 manager A écrit sur le site B', 'refus', 'refus');
end $$;
reset role;

-- 6. Autorisation d'écriture : le manager A crée un relevé sur son site.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000a2');
do $$ begin
  insert into carburant_index_releves(site, date, moment, auteur)
    values ('essai-site-a', current_date, 'fin_q2', '00000000-0000-4000-8000-0000000000a2');
  perform pg_temp.note('6 manager A écrit sur son site', 'accepté', 'accepté');
exception when others then
  perform pg_temp.note('6 manager A écrit sur son site', 'accepté', 'refus ' || sqlstate);
end $$;
reset role;

-- 7. Refus de modification inter-site : le pompiste A ne touche pas au site B.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000a1');
do $$ declare v int; begin
  update carburant_index_releves set statut = 'final' where site = 'essai-site-b';
  get diagnostics v = row_count;
  perform pg_temp.note('7 pompiste A modifie le site B', '0 ligne', v || ' ligne');
exception when insufficient_privilege then
  perform pg_temp.note('7 pompiste A modifie le site B', '0 ligne', '0 ligne');
end $$;
reset role;

-- 8. Refus de suppression : aucune politique DELETE, même sur son site.
select pg_temp.comme('authenticated', '00000000-0000-4000-8000-0000000000a2');
do $$ declare v int; begin
  delete from carburant_index_releves where site = 'essai-site-a';
  get diagnostics v = row_count;
  perform pg_temp.note('8 manager A supprime sur son site', '0 ligne', v || ' ligne');
exception when insufficient_privilege then
  perform pg_temp.note('8 manager A supprime sur son site', '0 ligne', '0 ligne');
end $$;
reset role;

-- Contre-témoin : sans RLS (propriétaire), les deux relevés existent bien.
-- Sans lui, les refus ci-dessus pourraient venir d'une table vide.
select pg_temp.note('9 contre-témoin propriétaire', '3',
  (select count(*)::text from carburant_index_releves where site like 'essai-%'));

select n, cas, attendu, obtenu, case when ok then 'OK' else 'ÉCHEC' end as verdict from journal order by n;
select 'PREUVE RLS MENÉE À TERME : ' || count(*) filter (where ok) || ' / ' || count(*) as bilan from journal;
rollback;
