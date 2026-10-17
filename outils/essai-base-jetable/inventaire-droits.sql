-- Inventaire des droits du schéma public, une ligne par fait, triable et
-- comparable avec comm(1). Catalogue seulement, aucune donnée lue.
-- Joué avant et après une migration candidate : la différence est la surface
-- de permissions que cette migration ouvre ou ferme.
--
-- Formats :
--   EXECUTE|<fonction(args)>|<rôle>|<DEFINER ou INVOKER>|<search_path>
--   TABLE|<table>|<rôle>|<privilège>
--   RLS|<table>|<active ou inactive>
--   POLITIQUE|<table>.<politique>|<commande>|<rôles>
--   CRON|<nom>|<utilisateur>|<planification>|<active>
--   SCHEMA|<schéma>|<rôle>|USAGE
-- Rôles examinés : anon, authenticated, service_role, nexus_ci_recette s'il existe.
\pset tuples_only on
\pset format unaligned
with roles as (
  select rolname from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'nexus_ci_recette')
), fonctions as (
  select p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as nom,
         case when p.prosecdef then 'DEFINER' else 'INVOKER' end as mode,
         coalesce((select c from unnest(p.proconfig) c where c like 'search_path=%'), 'search_path=<absent>') as sp
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind in ('f', 'p')
), lignes as (
  select 'EXECUTE|' || f.nom || '|' || r.rolname || '|' || f.mode || '|' || f.sp as l
  from fonctions f cross join roles r
  where has_function_privilege(r.rolname, f.oid, 'execute')
  union all
  select 'TABLE|' || c.relname || '|' || r.rolname || '|' || pr.p
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  cross join roles r
  cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) pr(p)
  where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
    and has_table_privilege(r.rolname, c.oid, pr.p)
  union all
  select 'RLS|' || c.relname || '|' || case when c.relrowsecurity then 'active' else 'inactive' end
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
  union all
  select 'POLITIQUE|' || tablename || '.' || policyname || '|' || cmd || '|' || array_to_string(roles, ',')
  from pg_policies where schemaname = 'public'
  union all
  select 'SCHEMA|' || s.nspname || '|' || r.rolname || '|USAGE'
  from pg_namespace s cross join roles r
  where s.nspname in ('public', 'cron', 'net', 'storage', 'auth', 'extensions')
    and has_schema_privilege(r.rolname, s.oid, 'usage')
)
select l from lignes
union all
select 'CRON|' || jobname || '|' || username || '|' || schedule || '|' || active
from cron.job where to_regclass('cron.job') is not null
order by 1;
