-- Retour arrière des étapes 4 et 4b (Test uniquement) : equipe_pour retirée, auteur_autorise rétablie
-- telle que définie par l'étape 2b. À lancer avant de redéployer la fonction connexion sans lister_equipe.
drop function if exists nexus_connexion.equipe_pour(uuid);

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

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
