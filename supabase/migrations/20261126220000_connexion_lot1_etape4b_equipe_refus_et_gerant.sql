-- Connexion lot 1, étape 4b (revue Guardian 7166616731), Test uniquement.
-- 1. auteur_autorise : manager -> cibles hors manager, gerant, créateur ; gerant -> cibles hors gerant et créateur
--    (les managers de son site sont inclus) ; créateur -> règle de l'étape 4 inchangée (hors manager, gerant, créateur).
-- 2. equipe_pour renvoie du jsonb {ok, equipe | motif} au lieu de lever une exception : le refus est journalisé
--    et reste au journal (même défaut que l'étape 2c : un raise exception annule l'insertion).
-- Exécutable par service_role seulement.

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
         and coalesce(cible.est_createur, false) is false
         and ( (auteur.role = 'gerant'  and auteur.site_id = cible.site_id and cible.role <> 'gerant')
            or (auteur.role = 'manager' and auteur.site_id = cible.site_id and cible.role not in ('manager','gerant'))
            or (auteur.est_createur is true and cible.role not in ('manager','gerant')
                and exists (select 1 from public.sites s where s.site_id = cible.site_id and s.acces_createur_autorise is true)) )
    )
$$;

drop function if exists nexus_connexion.equipe_pour(uuid);
create function nexus_connexion.equipe_pour(p_par uuid) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare auteur public.employees%rowtype; lignes jsonb;
begin
  select * into auteur from public.employees where id = p_par;
  if not found or auteur.actif is not true
     or not (auteur.role in ('manager','gerant') or auteur.est_createur is true) then
    insert into nexus_connexion.journal (user_id, evenement, detail)
      values (p_par, 'auteur_refuse', jsonb_build_object('action','lister_equipe','par', p_par));
    return jsonb_build_object('ok', false, 'motif', 'auteur_refuse');
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', e.id, 'nom', e.nom, 'site_id', e.site_id,
           'etat', case when c.a_deverrouiller is true then 'verrouille'
                        when c.etat = 'code_temporaire_requis' then 'code_temporaire' else 'normal' end,
           'a_deverrouiller', coalesce(c.a_deverrouiller, false)) order by e.nom), '[]'::jsonb)
    into lignes
    from public.employees e
    left join nexus_connexion.compte c on c.user_id = e.id
   where e.actif is true and nexus_connexion.auteur_autorise(p_par, e.id);
  return jsonb_build_object('ok', true, 'equipe', lignes);
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
