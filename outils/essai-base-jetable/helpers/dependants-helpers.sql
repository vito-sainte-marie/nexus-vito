-- Dépendants des helpers d'identité partagés, et conditions d'exploitation.
-- Catalogue seulement : jouable sur la base jetable ET, en lecture seule, sur Test.
-- Une ligne JSON.
with helpers(nom) as (values ('current_employee_site_id'), ('current_employee_role'), ('je_suis_createur')),
pol as (
  select p.schemaname, p.tablename, p.policyname, p.cmd,
         coalesce(p.qual, '') || ' ' || coalesce(p.with_check, '') as expr
  from pg_policies p where p.schemaname = 'public'
),
fn as (
  select p.oid, p.proname, p.prosecdef, p.prosrc,
         coalesce((select c from unnest(p.proconfig) c where c like 'search_path=%'), 'search_path=<absent>') as sp
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
)
select json_build_object(
  'helpers', (select json_agg(json_build_object(
      'nom', f.proname, 'definer', f.prosecdef, 'search_path', f.sp,
      'execute_anon', has_function_privilege('anon', f.oid, 'execute'),
      'execute_authenticated', has_function_privilege('authenticated', f.oid, 'execute'),
      'lit_employees_sans_schema', f.prosrc ~* '(from|join)\s+employees\M')
      order by f.proname) from fn f where f.proname in (select nom from helpers)),
  'politiques_dependantes', (select count(*) from pol where expr ~ '(current_employee_site_id|current_employee_role|je_suis_createur)\('),
  'politiques_total', (select count(*) from pol),
  'tables_dependantes', (select count(distinct tablename) from pol where expr ~ '(current_employee_site_id|current_employee_role|je_suis_createur)\('),
  'par_helper', (select json_object_agg(h.nom, (select count(*) from pol where expr ~ (h.nom || '\('))) from helpers h),
  'par_module', (select json_object_agg(m, c) from (
      select split_part(tablename, '_', 1) m, count(distinct tablename) c from pol
      where expr ~ '(current_employee_site_id|current_employee_role|je_suis_createur)\(' group by 1 order by 1) x),
  'fonctions_appelant_les_helpers', (select count(*) from fn
      where prosrc ~ '(current_employee_site_id|current_employee_role|je_suis_createur)\(' and proname not in (select nom from helpers)),
  'fonctions_definer_appelant_les_helpers', (select count(*) from fn
      where prosecdef and prosrc ~ '(current_employee_site_id|current_employee_role|je_suis_createur)\(' and proname not in (select nom from helpers)),
  -- Même faiblesse ailleurs : SECURITY DEFINER, pg_temp pas en dernier, et une
  -- relation nommée sans schéma (heuristique : from/join/into/update suivi d'un
  -- nom non qualifié). À relire à la main : ce n'est qu'un repérage.
  'autres_definer_meme_forme', (select json_agg(proname order by proname) from fn
      where prosecdef and sp not like '%pg_temp'
        and proname not in (select nom from helpers)
        and prosrc ~* '(from|join|into|update)\s+(?!public\.|pg_|auth\.|cron\.|storage\.|extensions\.|net\.|vault\.|unnest|jsonb_|json_|generate_series|lateral|\(|v_|p_|new\M|old\M|tmp_)[a-z_]+\s'),
  -- Conditions d'exploitation : il faut exécuter du DDL dans la session.
  'temp_authenticated', has_database_privilege('authenticated', current_database(), 'TEMP'),
  'temp_anon', has_database_privilege('anon', current_database(), 'TEMP'),
  'connexion_directe_authenticated', (select rolcanlogin from pg_roles where rolname = 'authenticated'),
  'connexion_directe_anon', (select rolcanlogin from pg_roles where rolname = 'anon'),
  -- Fonctions appelables par un client qui exécutent du SQL dynamique : seule
  -- voie connue pour faire passer du DDL par l'API. À relire une par une.
  'sql_dynamique_appelable_client', (select json_agg(json_build_object('fonction', proname, 'definer', prosecdef) order by proname) from fn
      where prosrc ~* '\mexecute\M\s+(format|''|\$|v_|p_|[a-z_]+\s*\|\|)'
        and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute')))
) as analyse;
