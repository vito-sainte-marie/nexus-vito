-- Connexion, lot 1, étape 1 (Guardian #160, phase B). Supprime l'oracle et l'identifiant interne de la RPC anonyme.
-- Avant : nexus_identifiant_de_connexion(prénom) renvoyait le username (ou NULL) à tout visiteur anonyme.
-- Après : elle renvoie TOUJOURS un alias opaque de même forme (existant, inconnu, ambigu) ; seul l'alias de l'existant
-- correspond à un e-mail Auth. L'écran de connexion ne change pas (même RPC, même signature, même construction d'e-mail).
-- Les e-mails Auth des comptes liés sont réécrits en <alias>@vito-nexus.local ; l'ancien état est gardé dans un schéma privé.
-- Retour arrière : outils/recette/connexion_lot1/99_retour_arriere.sql. Idempotente.

create extension if not exists pgcrypto;
create schema if not exists nexus_connexion;
revoke all on schema nexus_connexion from public, anon, authenticated;

create table if not exists nexus_connexion.secret (id int primary key default 1 check (id = 1), cle bytea not null);
insert into nexus_connexion.secret (id, cle) values (1, gen_random_bytes(32)) on conflict (id) do nothing;

create table if not exists nexus_connexion.sauvegarde_auth (
  user_id uuid primary key, email_avant text not null, identity_email_avant text, alias text not null, fait_le timestamptz not null default now());
revoke all on all tables in schema nexus_connexion from public, anon, authenticated;

-- alias d'un compte (user_id) : HMAC-SHA256 tronqué, 32 hex.
create or replace function nexus_connexion.alias_de(p_valeur text) returns text
language sql stable security definer set search_path = nexus_connexion, extensions, public, pg_temp as
$$ select substr(encode(hmac(convert_to(p_valeur, 'utf8'), (select cle from nexus_connexion.secret where id = 1), 'sha256'), 'hex'), 1, 32) $$;
revoke all on function nexus_connexion.alias_de(text) from public, anon, authenticated;
grant usage on schema nexus_connexion to service_role;
grant execute on function nexus_connexion.alias_de(text) to service_role;

-- helper de création de compte : à utiliser côté service_role pour fixer l'e-mail Auth d'un nouveau compte.
create or replace function public.nexus_connexion_email_de(p_user_id uuid) returns text
language sql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$ select nexus_connexion.alias_de('u:' || p_user_id::text) || '@vito-nexus.local' $$;
revoke all on function public.nexus_connexion_email_de(uuid) from public, anon, authenticated;
grant execute on function public.nexus_connexion_email_de(uuid) to service_role;

-- RPC anonyme : même nom, même signature, même type de retour (text). Un seul calcul HMAC et une seule agrégation, dans tous les cas.
create or replace function public.nexus_identifiant_de_connexion(p_prenom text) returns text
language sql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$
  with m as (
    select count(*) n, min(e.id::text) id
    from public.employees e
    where (e.actif = true or e.compte_test = true)
      and lower(btrim(e.nom)) = lower(btrim(coalesce(p_prenom, '')))
  )
  select nexus_connexion.alias_de(case when n = 1 then 'u:' || id else 'x:' || lower(btrim(coalesce(p_prenom, ''))) end) from m
$$;
revoke all on function public.nexus_identifiant_de_connexion(text) from public;
grant execute on function public.nexus_identifiant_de_connexion(text) to anon, authenticated, service_role;

-- Réécriture des e-mails Auth des comptes liés à un employé (id identique), avec sauvegarde.
insert into nexus_connexion.sauvegarde_auth (user_id, email_avant, identity_email_avant, alias)
select u.id, u.email, (select i.identity_data->>'email' from auth.identities i where i.user_id = u.id and i.provider = 'email' limit 1),
       nexus_connexion.alias_de('u:' || u.id::text)
from auth.users u join public.employees e on e.id = u.id
where u.email like '%@vito-nexus.local'
on conflict (user_id) do nothing;

update auth.users u set email = s.alias || '@vito-nexus.local', updated_at = now()
from nexus_connexion.sauvegarde_auth s where s.user_id = u.id and u.email = s.email_avant;
update auth.identities i set identity_data = jsonb_set(i.identity_data, '{email}', to_jsonb(s.alias || '@vito-nexus.local')), updated_at = now()
from nexus_connexion.sauvegarde_auth s where s.user_id = i.user_id and i.provider = 'email' and i.identity_data->>'email' = s.identity_email_avant;

do $v$ begin
  if exists (select 1 from auth.users u join public.employees e on e.id = u.id where u.email !~ '^[0-9a-f]{32}@vito-nexus\.local$') then
    raise exception 'connexion lot 1 : un compte lié a gardé un e-mail non opaque';
  end if;
end $v$;
