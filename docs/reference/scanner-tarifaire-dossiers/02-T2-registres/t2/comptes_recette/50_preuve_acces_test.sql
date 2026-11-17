-- Preuve d'accès T2 dans le projet Supabase Test (PROJET, NON EXÉCUTÉ, GO distinct requis).
-- Préalables : les quatre migrations appliquées dans l'ordre, les deux gérants de recette créés et actifs (script 40).
-- Personnes : gérant actif de vito-sainte-marie (recette-t2-gerant-sm), gérant actif de site-fantome-test
-- (recette-t2-gerant-fantome), plus un manager et un gérant désactivé ÉPHÉMÈRES, créés dans la même transaction.
-- AUCUNE ÉCRITURE CONSERVÉE : le bloc se termine TOUJOURS par une erreur volontaire « PREUVE_T2_TERMINEE », qui annule
-- toute la transaction (lignes de test et personnes éphémères) et porte le résultat dans son message.
-- GARDE PROJET TEST (obligatoire, en tête de transaction). Identité vérifiée : l'identifiant système du cluster
-- PostgreSQL, fixé à sa création et propre au projet Supabase Test udljdqxerrbbbajxubfn (relu le 16/11/2026).
-- Toute autre base, Production comprise, est refusée avant la moindre écriture. Seconde vérification : sites de recette.
do $garde$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
end $garde$;
do $preuve$
declare
  v_sm uuid := (select id from public.employees where username = 'recette-t2-gerant-sm' and actif and compte_test and site_id = 'vito-sainte-marie');
  v_fa uuid := (select id from public.employees where username = 'recette-t2-gerant-fantome' and actif and compte_test and site_id = 'site-fantome-test');
  v_m  uuid := 'e7000000-0000-4000-8000-000000000001';
  v_d  uuid := 'e7000000-0000-4000-8000-000000000002';
  v_prix uuid;
  v_ok int := 0; v_ko int := 0; v_detail text := '';
  c record; v_res text;
begin
  if v_sm is null or v_fa is null then raise exception 'preuve_prealable : gérants de recette absents ou inactifs (script 40)'; end if;
  if to_regclass('public.tarif_familles') is null or not exists (select 1 from pg_policies where policyname = 'compte_actif_obligatoire') then
    raise exception 'preuve_prealable : les quatre migrations T2 doivent être appliquées, 20261118100300 en dernier';
  end if;
  insert into public.employees (id, username, nom, role, actif, est_createur, site_id, compte_test) values
    (v_m, 'recette-t2-ephemere-manager', 'RecetteT2EphemereManager', 'manager', true, false, 'vito-sainte-marie', true),
    (v_d, 'recette-t2-ephemere-desactive', 'RecetteT2EphemereDesactive', 'gerant', true, false, 'vito-sainte-marie', true);

  for c in select * from (values
    (1,  'gérant actif SM crée une famille',               v_sm, 'insert into tarif_familles (site, famille_code, libelle) values (''vito-sainte-marie'', ''preuve_t2'', ''Preuve T2'')', 'ACCES'),
    (2,  'gérant actif SM lit sa famille',                  v_sm, 'select 1 / count(*) from tarif_familles where famille_code = ''preuve_t2''', 'ACCES'),
    (3,  'gérant actif SM décide un prix',                  v_sm, 'insert into tarif_prix_decides (site, article, nature, prix_ttc) values (''vito-sainte-marie'', ''Article preuve T2'', ''changement'', 2.00)', 'ACCES'),
    (4,  'manager SM lit les familles',                     v_m,  'select 1 / count(*) from tarif_familles where famille_code = ''preuve_t2''', 'ACCES'),
    (5,  'manager SM ne crée pas de famille',               v_m,  'insert into tarif_familles (site, famille_code, libelle) values (''vito-sainte-marie'', ''preuve_t2_m'', ''X'')', 'BLOQUE'),
    (6,  'manager SM propose une candidature',              v_m,  'insert into tarif_exceptions (site, article, type, statut, motif) values (''vito-sainte-marie'', ''Article preuve T2'', ''produit_appel'', ''candidate'', ''preuve'')', 'ACCES'),
    (7,  'manager SM ne valide pas d''exception',           v_m,  'insert into tarif_exceptions (site, article, type, statut, motif) values (''vito-sainte-marie'', ''Article preuve T2 bis'', ''produit_appel'', ''validee'', ''preuve'')', 'BLOQUE'),
    (8,  'manager SM déclare la saisie du prix',            v_m,  'insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) select ''vito-sainte-marie'', id, ''saisie_declaree'', current_date from tarif_prix_decides where article = ''Article preuve T2'' returning 1 / 1', 'ACCES'),
    (9,  'gérant site fantôme ne voit pas SM',              v_fa, 'select 1 / count(*) from tarif_familles where site = ''vito-sainte-marie''', 'BLOQUE'),
    (10, 'gérant site fantôme n''écrit pas sur SM',         v_fa, 'insert into tarif_familles (site, famille_code, libelle) values (''vito-sainte-marie'', ''preuve_t2_f'', ''X'')', 'BLOQUE'),
    (11, 'gérant site fantôme écrit sur son site',          v_fa, 'insert into tarif_familles (site, famille_code, libelle) values (''site-fantome-test'', ''preuve_t2'', ''Preuve T2 fantôme'')', 'ACCES'),
    (12, 'gérant SM ne voit pas le site fantôme',           v_sm, 'select 1 / count(*) from tarif_familles where site = ''site-fantome-test''', 'BLOQUE'),
    (13, 'gérant désactivé SM ne lit plus',                 v_d,  'select 1 / count(*) from tarif_familles where famille_code = ''preuve_t2''', 'BLOQUE'),
    (14, 'gérant désactivé SM n''écrit plus',               v_d,  'insert into tarif_reglages (site, parametre, valeur) values (''vito-sainte-marie'', ''a6_montant_minimal'', 5)', 'BLOQUE'),
    (15, 'gérant désactivé SM ne lit pas la vue des exceptions', v_d, 'select 1 / count(*) from v_tarif_exceptions_effectives', 'BLOQUE')
  ) as t(n, libelle, qui, requete, attendu) order by n loop
    if c.n = 13 then update public.employees set actif = false where id = v_d; end if;   -- désactivation juste avant les cas 13 à 15
    begin
      perform set_config('request.jwt.claim.sub', c.qui::text, true);
      execute 'set local role authenticated';
      begin
        if c.requete like 'insert%' and c.requete not like '%returning%' then execute c.requete || ' returning 1' into v_res; else execute c.requete into v_res; end if;
        v_res := case when v_res is null then 'BLOQUE' else 'ACCES' end;
      exception when others then v_res := 'BLOQUE';
      end;
      execute 'reset role';
    end;
    if v_res = c.attendu then v_ok := v_ok + 1; else v_ko := v_ko + 1; v_detail := v_detail || ' | ECHEC ' || c.n || ' ' || c.libelle || ' : ' || v_res; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);
  execute 'set local role anon';
  begin perform 1 / count(*) from tarif_familles; v_ko := v_ko + 1; v_detail := v_detail || ' | ECHEC 16 anon lit les registres';
  exception when others then v_ok := v_ok + 1; end;
  execute 'reset role';
  raise exception 'PREUVE_T2_TERMINEE (aucune écriture conservée) : OK % / ECHEC % %', v_ok, v_ko, v_detail;
end $preuve$;
