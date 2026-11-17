-- Socle de la base JETABLE, partie « plateforme » (exécutée par supabase_admin, superutilisateur, comme sur Supabase).
-- Reproduit le catalogue réel du projet Test relu le 16/11/2026 (lecture seule) : rôles, auth.uid() à l'identique,
-- schéma auth détenu par supabase_auth_admin, et privilèges par défaut de Supabase sur le schéma public.
-- Écarts connus avec Test : PostgreSQL 16 ici, 17.6 en Test ; déclencheurs de la table sites non reproduits
-- (nexus_acces_createur_immuable, nexus_site_supprimable, nexus_valider_fuseau_site), sans effet sur les tables T2.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'postgres') then
    create role postgres login createrole createdb bypassrls; end if;   -- comme sur Supabase : NON superutilisateur, contourne la RLS
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin noinherit; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin noinherit bypassrls; end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then create role supabase_auth_admin nologin noinherit createrole; end if;
end $$;
create extension if not exists pgcrypto;
-- Comme en Test : la base appartient au rôle postgres (relu le 16/11/2026 : propriétaire postgres, droit CREATE).
do $$ begin execute format('alter database %I owner to postgres', current_database()); end $$;
grant anon, authenticated, service_role to postgres;
grant all on schema public to postgres;
grant usage on schema public to anon, authenticated, service_role;

create schema if not exists auth authorization supabase_auth_admin;
create or replace function auth.uid() returns uuid language sql stable as $function$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$function$;
alter function auth.uid() owner to supabase_auth_admin;
-- auth.users réduit aux colonnes lues par les scripts de comptes de recette (Test : email, banned_until, deleted_at).
create table if not exists auth.users (id uuid primary key, email varchar, banned_until timestamptz, deleted_at timestamptz);
alter table auth.users owner to supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
grant select, insert, update, delete on auth.users to postgres;
grant execute on function auth.uid() to public;

-- Privilèges par défaut de Supabase sur public, pour les objets créés par postgres (relus en Test : ALL sur tables,
-- EXECUTE sur fonctions, usage et lecture sur séquences, pour anon, authenticated et service_role).
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;

-- Comme en Test : postgres peut lire l'identifiant système (garde du projet Test).
grant execute on function pg_control_system() to postgres;

-- Comme en Test : historique des migrations Supabase (lu par les preuves avant et après).
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);
grant usage on schema supabase_migrations to postgres;
grant select on supabase_migrations.schema_migrations to postgres;
