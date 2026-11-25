-- Connexion lot 1, étape 4 : section « Comptes de l'équipe » (fiche 2 validée).
-- 1. auteur_autorise exclut désormais les cibles gérant, manager ou créateur : un gérant ne traite que les comptes d'équipe.
-- 2. equipe_pour(p_par) liste, pour un auteur autorisé, les comptes de son site (ou des sites autorisés au créateur)
--    qui ne sont ni gérant, ni manager, ni créateur. Même plancher et même refus neutre que les autres actions.
-- Test uniquement. Exécutable par service_role seulement.

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
         and cible.role not in ('manager','gerant')
         and coalesce(cible.est_createur, false) is false
         and ( (auteur.role in ('manager','gerant') and auteur.site_id = cible.site_id)
            or (auteur.est_createur is true
                and exists (select 1 from public.sites s where s.site_id = cible.site_id and s.acces_createur_autorise is true)) )
    )
$$;

create or replace function nexus_connexion.equipe_pour(p_par uuid)
returns table (user_id uuid, nom text, site_id text, etat text, a_deverrouiller boolean)
language plpgsql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare auteur public.employees%rowtype;
begin
  select * into auteur from public.employees where id = p_par;
  if not found or auteur.actif is not true
     or not (auteur.role in ('manager','gerant') or auteur.est_createur is true) then
    insert into nexus_connexion.journal (user_id, evenement, detail)
      values (p_par, 'auteur_refuse', jsonb_build_object('action','lister_equipe','par', p_par));
    raise exception 'auteur non autorisé' using errcode = 'insufficient_privilege';
  end if;
  return query
    select e.id, e.nom, e.site_id,
           case when c.a_deverrouiller is true then 'verrouille'
                when c.etat = 'code_temporaire_requis' then 'code_temporaire'
                else 'normal' end,
           coalesce(c.a_deverrouiller, false)
      from public.employees e
      left join nexus_connexion.compte c on c.user_id = e.id
     where e.actif is true
       and nexus_connexion.auteur_autorise(p_par, e.id)
     order by e.nom;
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
