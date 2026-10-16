-- Épreuve de public.poste_le_plus_frequent sur nexus-test (migration 20261016120000).
-- UNE transaction terminée par ROLLBACK : rien n'est persisté.
-- Identités réelles de Test : A (caissier), B (pompiste), manager-test, angelique (vacataire).
\set ON_ERROR_STOP 1
\set a '868d0b92-bf65-4c99-be43-656911919afd'
\set b '755a2dc5-3390-4a29-a865-847cbebc1133'
\set m '28810f30-8182-4126-920f-051a4c7cb596'
\set v '784268c6-a440-476d-aaa5-67d30250bc2e'
\set pro '7d3b0a51-0000-4a00-9000-000000000001'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
\i :chemin_migration

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public;
grant all on sequence journal_n_seq to public;

create function pg_temp.comme(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_uid is null then json_build_object('role', p_role)::text
         else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  execute format('set local role %I', p_role);
end $$;
create function pg_temp.note(p_cas text, p_attendu text, p_obtenu text) returns void language sql as $$
  insert into pg_temp.journal(cas, attendu, obtenu, ok) values (p_cas, p_attendu, p_obtenu, p_attendu = p_obtenu);
$$;
grant execute on function pg_temp.note(text, text, text) to public;
create function pg_temp.lire(p_cible uuid) returns text language sql as $$
  select coalesce(poste, '-') || '|' || retenus || '|' || eligibles || '|' || etat
    from public.poste_le_plus_frequent(p_cible);
$$;
grant execute on function pg_temp.lire(uuid) to public;

-- Départ propre : on vide les quarts de A, B, vacataire (annulé avec le reste).
reset role;
-- Les quarts existants (référencés par pointages) sont reculés hors fenêtre de 90 jours.
alter table public.shifts disable trigger user;
update public.shifts set heure_debut = heure_debut - interval '400 days'
 where employee_id in (:'a'::uuid, :'b'::uuid, :'v'::uuid);
update public.shifts set statut = 'clos_sans_pointage', cloture_source = 'test', cloture_le = now()
 where employee_id in (:'a'::uuid, :'b'::uuid, :'v'::uuid) and statut = 'en_cours';
\o /dev/null
create function pg_temp.q(p_emp uuid, p_jours int, p_role text, p_statut text default 'clos_sans_pointage',
                          p_conf text default 'employe', p_site text default 'nexus-station-test') returns void language sql as $$
  insert into public.shifts(employee_id, site, site_id, role, role_prevu, quart, heure_debut, statut, confirmed_by,
                            cloture_source, cloture_le)
  values (p_emp, p_site, p_site, p_role, p_role, 'matin', now() - make_interval(days => p_jours, mins => (select count(*) from public.shifts)::int),
          p_statut, p_conf,
          case when p_statut = 'en_cours' then null else 'test' end,
          case when p_statut = 'en_cours' then null else now() end);
$$;

-- A : 4 prises de poste -> insuffisant (4 < 5).
select pg_temp.q(:'a'::uuid, d, 'caissiere') from generate_series(1, 4) d;
select pg_temp.comme('authenticated', :'a'::uuid);
select pg_temp.note('1 quatre prises : historique insuffisant', '-|0|4|historique_insuffisant', pg_temp.lire(null));
reset role;
-- 5e prise : dominant.
select pg_temp.q(:'a'::uuid, 5, 'caissiere');
select pg_temp.comme('authenticated', :'a'::uuid);
select pg_temp.note('2 cinq prises : dominant', 'caissiere|5|5|dominant', pg_temp.lire(null));
reset role;
-- Mélange 5 caissiere + 2 pompiste => 5 sur 7.
select pg_temp.q(:'a'::uuid, d, 'pompiste') from generate_series(6, 7) d;
select pg_temp.comme('authenticated', :'a'::uuid);
select pg_temp.note('3 mélange : n sur N', 'caissiere|5|7|dominant', pg_temp.lire(:'a'::uuid));
reset role;
-- Exclusions : legacy, test, hors 90 jours, auto, fantôme, rôle polyvalent/manager, en_cours confirmé inclus.
update public.shifts set statut = statut where false;
select pg_temp.q(:'a'::uuid, 8, 'pompiste', 'clos_sans_pointage', 'auto');
select pg_temp.q(:'a'::uuid, 120, 'pompiste');
select pg_temp.q(:'a'::uuid, 9, 'polyvalent');
select pg_temp.q(:'a'::uuid, 10, 'manager');
select pg_temp.q(:'a'::uuid, 11, 'pompiste', 'legacy');
select pg_temp.q(:'a'::uuid, 12, 'pompiste', 'test');
select pg_temp.q(:'a'::uuid, 13, 'pompiste', 'clos_sans_pointage', 'employe', 'site-fantome-test');
select pg_temp.comme('authenticated', :'a'::uuid);
select pg_temp.note('4 exclusions sans effet', 'caissiere|5|7|dominant', pg_temp.lire(null));
reset role;
-- Quart en_cours confirmé : compté.
select pg_temp.q(:'a'::uuid, 0, 'pompiste', 'en_cours');
select pg_temp.comme('authenticated', :'a'::uuid);
select pg_temp.note('5 en_cours confirmé compté', 'caissiere|5|8|dominant', pg_temp.lire(null));
reset role;
-- Doublon technique (même heure_debut, même rôle) compté une fois.
insert into public.shifts(employee_id, site, site_id, role, role_prevu, quart, heure_debut, statut, confirmed_by, cloture_source, cloture_le)
  select employee_id, site, site_id, role, role_prevu, quart, heure_debut, 'clos_sans_pointage', confirmed_by, 'test', now()
    from public.shifts where employee_id = :'a'::uuid and statut = 'en_cours' limit 1;
select pg_temp.comme('authenticated', :'a'::uuid);
select pg_temp.note('6 doublon technique exclu', 'caissiere|5|8|dominant', pg_temp.lire(null));
reset role;
-- Égalité en tête : B 3 caissiere + 3 pompiste.
select pg_temp.q(:'b'::uuid, d, case when d <= 3 then 'caissiere' else 'pompiste' end) from generate_series(1, 6) d;
select pg_temp.comme('authenticated', :'b'::uuid);
select pg_temp.note('7 égalité : aucune dominante', '-|3|6|aucune_dominante', pg_temp.lire(null));
-- Isolation : B (employé) ne peut pas lire A.
do $$ begin
  perform * from public.poste_le_plus_frequent('868d0b92-bf65-4c99-be43-656911919afd');
  perform pg_temp.note('8 employé vise un collègue', '42501', 'aucune erreur');
exception when others then
  perform pg_temp.note('8 employé vise un collègue', '42501', sqlstate);
end $$;
reset role;
-- Manager du même site lit A, lui-même : non applicable.
select pg_temp.comme('authenticated', :'m'::uuid);
select pg_temp.note('9 manager lit A (même site)', 'caissiere|5|8|dominant', pg_temp.lire(:'a'::uuid));
select pg_temp.note('10 manager : non applicable', '-|0|0|non_applicable', pg_temp.lire(null));
-- Manager vers une fiche d'un autre site : refus.
do $$ begin
  perform * from public.poste_le_plus_frequent('7d3b0a51-0000-4a00-9000-000000000001');
  perform pg_temp.note('11 manager vise un autre site', '42501', 'aucune erreur');
exception when others then
  perform pg_temp.note('11 manager vise un autre site', '42501', sqlstate);
end $$;
reset role;
-- Vacataire sans historique.
select pg_temp.comme('authenticated', :'v'::uuid);
select pg_temp.note('12 sans historique', '-|0|0|historique_insuffisant', pg_temp.lire(null));
reset role;
-- anon : refusé (droit d'exécution fermé) ; sans jeton : 42501.
select pg_temp.comme('anon', null);
do $$ begin
  perform * from public.poste_le_plus_frequent(null);
  perform pg_temp.note('13 anon', '42501', 'aucune erreur');
exception when others then
  perform pg_temp.note('13 anon', '42501', sqlstate);
end $$;
reset role;
-- Aucune écriture : lecture seule (volatilité STABLE, pas de SECURITY DEFINER).
select pg_temp.note('14 stable et invoker', 's|false',
  (select provolatile::text || '|' || prosecdef::text from pg_proc where oid = 'public.poste_le_plus_frequent(uuid)'::regprocedure));

reset role;
\o
select n, cas, attendu, obtenu, case when ok then 'OK' else 'ÉCHEC' end from journal order by n;
select count(*) filter (where ok) || ' / ' || count(*) as bilan from journal;
rollback;
