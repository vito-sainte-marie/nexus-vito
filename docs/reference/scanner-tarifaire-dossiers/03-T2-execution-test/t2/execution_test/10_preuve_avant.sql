-- Preuve AVANT migrations T2, projet Supabase Test. LECTURE SEULE : une seule requête SELECT, aucune écriture.
-- Résultat à conserver tel quel (JSON) dans preuves/avant_<date>.json.
with empreinte_hors_t2 as (
  select md5(string_agg(x, '|' order by x)) v, count(*) n from (
    select 'class:' || c.oid::regclass::text || ':' || c.relkind::text || ':' || coalesce(c.relacl::text, '') || ':' || c.relrowsecurity::text || c.relforcerowsecurity::text
      from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname not like 'tarif\_%' and c.relname not like 'v\_tarif\_%'
    union all select 'proc:' || p.oid::regprocedure::text || ':' || md5(p.prosrc) || ':' || coalesce(p.proacl::text, '') || ':' || p.prosecdef::text
      from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname not like 'tarif\_%'
    union all select 'pol:' || polrelid::regclass::text || ':' || polname || ':' || polpermissive::text || ':' || coalesce(pg_get_expr(polqual, polrelid), '') || ':' || coalesce(pg_get_expr(polwithcheck, polrelid), '')
      from pg_policy where polrelid::regclass::text not like 'tarif\_%'
    union all select 'trg:' || tgrelid::regclass::text || ':' || tgname from pg_trigger where not tgisinternal and tgrelid::regclass::text not like 'tarif\_%'
    union all select 'con:' || conrelid::regclass::text || ':' || conname from pg_constraint where connamespace = 'public'::regnamespace and conrelid::regclass::text not like 'tarif\_%'
    union all select 'defacl:' || coalesce(defaclacl::text, '') from pg_default_acl
  ) e(x)
)
select json_build_object(
  'moment', 'avant',
  'horodatage', now(),
  'identifiant_systeme', (select system_identifier::text from pg_control_system()),
  'est_projet_test', (select system_identifier from pg_control_system()) = 7678069749886157684,
  'version_postgres', current_setting('server_version'),
  'derniere_migration', (select version || ' ' || name from supabase_migrations.schema_migrations order by version desc limit 1),
  'nb_migrations', (select count(*) from supabase_migrations.schema_migrations),
  'objets_tarif_existants', (select count(*) from pg_class where relname like 'tarif\_%' or relname like 'v\_tarif\_%')
                           + (select count(*) from pg_proc where proname like 'tarif\_%'),
  'sites_recette', (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')),
  'comptes', json_build_object('employees', (select count(*) from public.employees), 'gerants', (select count(*) from public.employees where role = 'gerant'),
                               'produits_appel', (select count(*) from public.produits_appel)),
  'empreinte_hors_t2', (select v from empreinte_hors_t2), 'objets_hors_t2', (select n from empreinte_hors_t2)
) as preuve;
