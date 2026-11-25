-- Connexion lot 1, étape 2f : trace et contrôle des incohérences entre la base privée et Auth.
-- journaliser_incoherence : appelée par l'Edge Function quand une compensation Auth échoue elle-même.
-- comptes_incoherents : liste (sans corriger) les comptes dont la dernière 'incoherence_auth' n'est suivie d'aucun succès ni d'aucune réinitialisation.
-- Test uniquement. Service_role seul.

create or replace function nexus_connexion.journaliser_incoherence(p_user_id uuid, p_chemin text, p_etape text) returns void
language sql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
  insert into nexus_connexion.journal (user_id, evenement, detail)
  values (p_user_id, 'incoherence_auth', jsonb_build_object('chemin', p_chemin, 'etape', p_etape));
$$;

create or replace function nexus_connexion.comptes_incoherents() returns table (user_id uuid, depuis timestamptz, chemin text, etape text)
language sql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$
  select j.user_id, j.at, j.detail->>'chemin', j.detail->>'etape'
    from nexus_connexion.journal j
   where j.evenement = 'incoherence_auth'
     and j.at = (select max(x.at) from nexus_connexion.journal x where x.user_id = j.user_id and x.evenement = 'incoherence_auth')
     and not exists (select 1 from nexus_connexion.journal s
                      where s.user_id = j.user_id and s.at > j.at and s.evenement in ('succes', 'code_reinitialise', 'code_pose'))
$$;

-- Injection de panne pour la recette (Test seulement, à retirer avant tout GO Production) :
-- une ligne {user_id, etape} par panne voulue ; etape = 'auth' | 'base' | 'compensation'. Vide en temps normal.
create table if not exists nexus_connexion.panne_injectee (user_id uuid not null, etape text not null check (etape in ('auth','base','compensation')), primary key (user_id, etape));
alter table nexus_connexion.panne_injectee enable row level security;
revoke all on nexus_connexion.panne_injectee from public, anon, authenticated;
grant select, insert, delete on nexus_connexion.panne_injectee to service_role;

create or replace function nexus_connexion.panne_pour(p_user_id uuid, p_etape text) returns boolean
language sql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$ select exists (select 1 from nexus_connexion.panne_injectee where user_id = p_user_id and etape = p_etape) $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
