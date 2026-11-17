-- Socle de la base JETABLE, partie « NEXUS » (exécutée par le rôle postgres, NON superutilisateur, BYPASSRLS).
-- Tables sites, employees, produits_appel : colonnes, valeurs par défaut, contraintes et politiques copiées du projet Test
-- (lecture du 16/11/2026). Les trois fonctions d'aide sont copiées à l'identique (SECURITY DEFINER, propriétaire postgres).
create table sites (
  site_id text primary key, nom_entreprise text not null, logo_url text, couleur_accent text default '#4FC3D9',
  created_at timestamptz not null default now(), acces_createur_autorise boolean not null default false,
  forfait text not null default 'essential' check (forfait = any (array['essential','professional'])),
  brief_nexus_inclus boolean not null default true, type_commerce text not null default 'station-service', secteurs jsonb,
  timezone text not null);
create table employees (
  id uuid primary key, username text not null unique, nom text not null,
  role text not null check (role = any (array['caissier','pompiste','renfort','manager','gerant','vacataire'])),
  actif boolean not null default true, created_at timestamptz not null default now(), est_createur boolean not null default false,
  site_id text not null default 'vito-sainte-marie' references sites(site_id), compte_test boolean not null default false);
create table produits_appel (
  id uuid primary key default gen_random_uuid(), site text not null default 'vito-sainte-marie', article text not null,
  ajoute_par uuid references employees(id) on delete set null, ajoute_le timestamptz not null default now(), unique (site, article));
revoke select on sites from anon;   -- comme en Test : anon n'a pas la lecture de sites

CREATE OR REPLACE FUNCTION public.current_employee_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select role from employees where id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION public.current_employee_site_id()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select site_id from employees where id = auth.uid();
$function$;
CREATE OR REPLACE FUNCTION public.je_suis_createur()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce((select est_createur from employees where id = auth.uid()), false);
$function$;
grant execute on function current_employee_role(), current_employee_site_id(), je_suis_createur() to public;

alter table sites enable row level security;
alter table employees enable row level security;
alter table produits_appel enable row level security;
create policy select_sites on sites for select to authenticated using ((site_id = (select current_employee_site_id())) or ((select je_suis_createur()) and (acces_createur_autorise = true)));
create policy createur_insert_sites on sites for insert to authenticated with check ((select je_suis_createur()));
create policy createur_update_sites on sites for update to authenticated using ((select je_suis_createur())) with check ((select je_suis_createur()));
create policy createur_delete_sites on sites for delete to authenticated using ((select je_suis_createur()));
create policy select_employees on employees for select using ((id = (select auth.uid())) or (((select current_employee_role()) = any (array['manager','gerant'])) and (site_id = (select current_employee_site_id())))
  or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = employees.site_id and s.acces_createur_autorise = true)));
create policy insert_employees_manager_gerant on employees for insert with check ((current_employee_role() = any (array['manager','gerant'])) and (site_id = current_employee_site_id()));
create policy select_produits_appel on produits_appel for select to authenticated using ((site = (select current_employee_site_id()))
  or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = produits_appel.site and s.acces_createur_autorise = true)));
create policy manager_insert_produits_appel on produits_appel for insert to authenticated with check (((select current_employee_role()) = any (array['manager','gerant'])) and (site = (select current_employee_site_id())));
create policy manager_update_produits_appel on produits_appel for update to authenticated using (((select current_employee_role()) = any (array['manager','gerant'])) and (site = (select current_employee_site_id())))
  with check (((select current_employee_role()) = any (array['manager','gerant'])) and (site = (select current_employee_site_id())));
create policy manager_delete_produits_appel on produits_appel for delete to authenticated using (((select current_employee_role()) = any (array['manager','gerant'])) and (site = (select current_employee_site_id())));

-- Comme en Test : les deux sites de recette existent (seconde vérification de la garde du projet).
insert into sites (site_id, nom_entreprise, timezone) values ('site-fantome-test', 'Site fantôme', 'America/Martinique'),
  ('nexus-station-test', 'Station test', 'America/Martinique');
