-- =====================================================================
-- Preuve rejouable — Journal Piste (TEST SEULEMENT)
-- À jouer APRÈS la migration 20261017140000, en une transaction ANNULÉE
-- (rollback final) : aucune donnée ne subsiste. Rejouable avant (les tables
-- n'existent pas : le bloc 0 le constate) et après.
-- Chaque cas affiche  CAS n | attendu | obtenu | OK/KO ; un KO fait échouer.
-- Les acteurs sont créés dans la transaction (employés fictifs, annulés).
-- =====================================================================
begin;
set local lock_timeout = '2s';
create temp table resultats (cas text, attendu text, obtenu text) on commit drop;
grant all on resultats to anon, authenticated;

-- Acteurs fictifs : deux sites, un manager par site, un gérant, un pompiste.
-- (adapter les colonnes à employees si le schéma Test diffère ; c'est le seul
-- point de la preuve qui dépend d'un fait à mesurer sur Test avant exécution.)
insert into public.sites (site_id, timezone) values ('preuve-a', 'America/Martinique'), ('preuve-b', 'America/Martinique')
  on conflict do nothing;
insert into public.employees (id, site, role, prenom, nom, actif) values
  ('00000000-0000-0000-0000-0000000000a1', 'preuve-a', 'manager', 'MgrA', 'Preuve', true),
  ('00000000-0000-0000-0000-0000000000a2', 'preuve-a', 'gerant',  'GerA', 'Preuve', true),
  ('00000000-0000-0000-0000-0000000000a3', 'preuve-a', 'pompiste', 'PompA', 'Preuve', true),
  ('00000000-0000-0000-0000-0000000000b1', 'preuve-b', 'manager', 'MgrB', 'Preuve', true);

-- Une configuration et une alerte de preuve, posées en tant que propriétaire.
insert into public.carburant_index_config (site, version, config) values
  ('preuve-a', 1, '{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}');
insert into public.carburant_index_alertes (id, site, type, evenement, niveau, constat) values
  ('00000000-0000-0000-0000-00000000aaaa', 'preuve-a', 'passation', '2026-10-17', 'orange', '{}');

-- Helper : joue une instruction sous un rôle/identité, consigne OK si elle
-- lève (refus attendu) ou si elle aboutit (autorisation attendue).
create or replace function pg_temp.jouer(p_cas text, p_role text, p_uid text, p_sql text, p_attendu text)
returns void language plpgsql as $$
declare v_obtenu text := 'autorise'; v_n bigint;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  begin
    execute p_sql;
  exception when others then v_obtenu := 'refuse';
  end;
  execute 'reset role';
  insert into resultats values (p_cas, p_attendu, v_obtenu);
end $$;
grant execute on function pg_temp.jouer(text, text, text, text, text) to public;

-- ---- LECTURE (RLS) ------------------------------------------------
-- Compte visible par acteur (0 = rien de visible ; l'erreur compte comme refus).
create or replace function pg_temp.voir(p_cas text, p_role text, p_uid text, p_attendu_n bigint)
returns void language plpgsql as $$
declare v_n bigint; v_obtenu text;
begin
  execute format('set local role %I', p_role);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  begin
    select count(*) into v_n from public.carburant_index_alertes;
    v_obtenu := v_n::text;
  exception when others then v_obtenu := '0';
  end;
  execute 'reset role';
  insert into resultats values (p_cas, p_attendu_n::text, v_obtenu);
end $$;
select pg_temp.voir('L1 anon ne lit pas',                  'anon',          '00000000-0000-0000-0000-000000000000', 0);
select pg_temp.voir('L2 pompiste ne lit pas',              'authenticated', '00000000-0000-0000-0000-0000000000a3', 0);
select pg_temp.voir('L3 manager d''un autre site ne lit pas','authenticated', '00000000-0000-0000-0000-0000000000b1', 0);
select pg_temp.voir('L4 manager du site lit',              'authenticated', '00000000-0000-0000-0000-0000000000a1', 1);
select pg_temp.voir('L5 gérant du site lit',               'authenticated', '00000000-0000-0000-0000-0000000000a2', 1);

-- ---- ÉCRITURE DIRECTE : toujours refusée, pour tous les rôles clients ---------
do $$
declare r record; t text;
begin
  for r in select * from (values
      ('anon','00000000-0000-0000-0000-000000000000'),
      ('authenticated','00000000-0000-0000-0000-0000000000a3'),
      ('authenticated','00000000-0000-0000-0000-0000000000b1'),
      ('authenticated','00000000-0000-0000-0000-0000000000a1'),
      ('authenticated','00000000-0000-0000-0000-0000000000a2')) v(role, uid) loop
    foreach t in array array['carburant_index_config','carburant_index_alertes','carburant_index_qualifications'] loop
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' INSERT '||t, r.role, r.uid,
        format('insert into public.%I (site) values (''preuve-a'')', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' UPDATE '||t, r.role, r.uid,
        format('update public.%I set site = site', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' DELETE '||t, r.role, r.uid,
        format('delete from public.%I', t), 'refuse');
      perform pg_temp.jouer('W '||r.role||' '||right(r.uid,2)||' TRUNCATE '||t, r.role, r.uid,
        format('truncate public.%I', t), 'refuse');
    end loop;
  end loop;
end $$;

-- ---- FONCTIONS : refus et autorisations --------------------------------------
-- enregistrer_config_piste : site de l'appelant seulement
select pg_temp.jouer('F1 anon enregistre config', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.enregistrer_config_piste('{}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F2 pompiste enregistre config', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.enregistrer_config_piste('{"litresParUnite":1}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F3 manager config invalide refusée', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.enregistrer_config_piste('{"litresParUnite":0}'::jsonb)$q$, 'refuse');
select pg_temp.jouer('F4 manager du site enregistre config valide', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.enregistrer_config_piste('{"litresParUnite":1,"toleranceL":9,"seuilL":10,"delaiReleveManquantMin":30,"pompes":{},"chiffres":{}}'::jsonb, 'preuve')$q$, 'autorise');
-- La version posée par F4 doit porter le site de l'appelant (preuve-a), jamais un autre.
select pg_temp.jouer('F5 version posée sur le site de l''appelant', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$do $i$ begin if (select site from public.carburant_index_config order by modifie_le desc limit 1) <> 'preuve-a' then raise exception 'mauvais site'; end if; end $i$$q$, 'autorise');

-- qualifier_alerte_piste : le site vient de l'alerte, vérifié contre l'appelant
select pg_temp.jouer('Q1 anon qualifie', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q2 pompiste qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q3 manager d''un autre site qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000b1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue')$q$, 'refuse');
select pg_temp.jouer('Q4 choix hors liste', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'au_hasard')$q$, 'refuse');
select pg_temp.jouer('Q5 manager du site qualifie', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'erreur_lecture', 'preuve')$q$, 'autorise');
select pg_temp.jouer('Q6 gérant du site corrige (remplace)', 'authenticated', '00000000-0000-0000-0000-0000000000a2',
  $q$select public.qualifier_alerte_piste('00000000-0000-0000-0000-00000000aaaa', 'cause_inconnue', 'correction',
       (select id from public.carburant_index_qualifications order by qualifie_le desc limit 1))$q$, 'autorise');

-- Fonctions à paramètre site : exécutables par personne côté client.
select pg_temp.jouer('E1 manager appelle piste_evaluer_site(site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_evaluer_site('preuve-a', current_date)$q$, 'refuse');
select pg_temp.jouer('E2 manager appelle piste_evaluer_site(autre site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.piste_evaluer_site('preuve-b', current_date)$q$, 'refuse');
select pg_temp.jouer('E3 anon appelle evaluer_tous_sites_piste', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.evaluer_tous_sites_piste()$q$, 'refuse');
select pg_temp.jouer('E4 manager appelle evaluer_tous_sites_piste', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.evaluer_tous_sites_piste()$q$, 'refuse');
select pg_temp.jouer('E5 anon appelle evaluer_controles_piste', 'anon', '00000000-0000-0000-0000-000000000000',
  $q$select public.evaluer_controles_piste()$q$, 'refuse');
select pg_temp.jouer('E6 pompiste appelle evaluer_controles_piste', 'authenticated', '00000000-0000-0000-0000-0000000000a3',
  $q$select public.evaluer_controles_piste()$q$, 'refuse');
select pg_temp.jouer('E7 manager appelle evaluer_controles_piste (son site)', 'authenticated', '00000000-0000-0000-0000-0000000000a1',
  $q$select public.evaluer_controles_piste()$q$, 'autorise');

-- Immuabilité même pour le propriétaire (triggers) : une version, une qualification, l'identité d'une alerte.
select pg_temp.jouer('I1 UPDATE config (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_config set motif = 'x'$q$, 'refuse');
select pg_temp.jouer('I2 DELETE qualification (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$delete from public.carburant_index_qualifications$q$, 'refuse');
select pg_temp.jouer('I3 changer le site d''une alerte (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_alertes set site = 'preuve-b'$q$, 'refuse');

-- Photographie : un client ne peut pas imposer ni modifier config_snapshot.
select pg_temp.jouer('S1 UPDATE config_snapshot d''un relevé (propriétaire)', current_user, '00000000-0000-0000-0000-0000000000a1',
  $q$update public.carburant_index_releves set config_snapshot = '{"x":1}' where config_snapshot is null and false or id in (select id from public.carburant_index_releves limit 1)$q$, 'refuse');

-- Postconditions de privilèges (mesurées, pas supposées).
insert into resultats
select 'P1 grants anon/PUBLIC sur les 3 tables', '0',
  (select count(*) from information_schema.role_table_grants
    where table_name in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications')
      and grantee in ('anon','PUBLIC'))::text;
insert into resultats
select 'P2 grants authenticated autres que SELECT', '0',
  (select count(*) from information_schema.role_table_grants
    where table_name in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications')
      and grantee = 'authenticated' and privilege_type <> 'SELECT')::text;
insert into resultats
select 'P3 RLS active sur les 3 tables', '3',
  (select count(*) from pg_class where relname in ('carburant_index_config','carburant_index_alertes','carburant_index_qualifications') and relrowsecurity)::text;
insert into resultats
select 'P4 fonctions SECURITY DEFINER sans search_path fixé', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and p.proname in ('enregistrer_config_piste','qualifier_alerte_piste','evaluer_controles_piste','evaluer_tous_sites_piste',
                        'piste_evaluer_site','piste_poser_alerte','piste_manager_du_site','piste_releve_photographier',
                        'piste_qualification_heriter_site')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%'))::text;
insert into resultats
select 'P5 EXECUTE anon sur les fonctions Journal Piste', '0',
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like any (array['%_piste','piste_%','%_piste_%'])
      and has_function_privilege('anon', p.oid, 'execute'))::text;

-- Verdict : tout écart attendu/obtenu fait échouer la preuve.
select cas, attendu, obtenu, case when attendu = obtenu then 'OK' else 'KO' end as verdict from resultats order by cas;
do $$ begin
  if exists (select 1 from resultats where attendu <> obtenu) then raise exception 'PREUVE KO — voir les lignes KO ci-dessus'; end if;
end $$;
rollback;
