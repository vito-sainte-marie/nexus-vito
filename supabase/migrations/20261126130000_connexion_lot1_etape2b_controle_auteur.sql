-- Connexion lot 1, étape 2b : contrôle de l'auteur dans la base elle-même.
-- lever_verrou et la réinitialisation de code ne se fient plus à l'Edge Function pour savoir qui a le droit :
-- l'auteur p_par doit être manager ou gérant ACTIF de la station du compte visé, ou créateur actif
-- si la station du compte a acces_createur_autorise (même règle que dates_courtes_gestion / nexus_site_autorise,
-- réécrite avec un identifiant explicite car auth.uid() est NULL quand l'Edge Function appelle en service_role).
-- Test uniquement.

create or replace function nexus_connexion.auteur_autorise(p_par uuid, p_cible uuid) returns boolean
language sql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$
  select p_par is not null and p_cible is not null and p_par <> p_cible
    and exists (
      select 1
        from public.employees cible
        join public.employees auteur on true
       where cible.id = p_cible and auteur.id = p_par
         and auteur.actif is true
         and ( (auteur.role in ('manager','gerant') and auteur.site_id = cible.site_id)
            or (auteur.est_createur is true
                and exists (select 1 from public.sites s where s.site_id = cible.site_id and s.acces_createur_autorise is true)) )
    )
$$;

create or replace function nexus_connexion.lever_verrou(p_user_id uuid, p_par uuid) returns void
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  if not nexus_connexion.auteur_autorise(p_par, p_user_id) then
    insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'auteur_refuse', jsonb_build_object('action','lever_verrou','par', p_par));
    raise exception 'auteur non autorisé' using errcode = 'insufficient_privilege';
  end if;
  update nexus_connexion.compte set a_deverrouiller = false, echecs = 0, dernier_echec = null, prochain_essai = null, maj = now() where user_id = p_user_id;
  update nexus_connexion.alerte set traitee_le = now(), traitee_par = p_par where user_id = p_user_id and traitee_le is null;
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'verrou_leve', jsonb_build_object('par', p_par));
end $$;

-- Réinitialisation pilotée par un manager : pose un code temporaire (hash calculé hors Postgres) à changer à la prochaine connexion.
-- poser_code reste réservé aux chemins où l'Edge Function vient de vérifier le code du titulaire lui-même.
create or replace function nexus_connexion.reinitialiser_code(p_user_id uuid, p_hash text, p_version int, p_par uuid) returns void
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  if not nexus_connexion.auteur_autorise(p_par, p_user_id) then
    insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'auteur_refuse', jsonb_build_object('action','reinitialiser_code','par', p_par));
    raise exception 'auteur non autorisé' using errcode = 'insufficient_privilege';
  end if;
  perform nexus_connexion.poser_code(p_user_id, p_hash, 'code_temporaire_requis', p_version);
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'code_reinitialise', jsonb_build_object('par', p_par));
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
