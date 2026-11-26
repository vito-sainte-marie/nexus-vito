-- Connexion lot 1, étape 5b : correction de l'alerte « connexion indisponible » (Guardian 7182436721), Test uniquement.
-- La migration 20261126230000 (déjà appliquée, non modifiée) disait « limitée à leur propre site ». C'était inexact :
-- le journal ne porte aucun site, la panne touche toute la connexion. Le nombre est global, lu par le gérant et les
-- managers actifs, sans donnée de compte. Le site_id de la réponse est celui du lecteur (Guardian 7182546312) : il est conservé.
-- Ajout de « premier » : première réponse « indisponible » de l'heure écoulée (heure de début affichée dans la carte).
-- Exécutable par service_role seulement.

create or replace function nexus_connexion.alerte_indisponible_pour(p_par uuid) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare auteur public.employees%rowtype; n int; premier timestamptz; dernier timestamptz;
begin
  select * into auteur from public.employees where id = p_par;
  if not found or auteur.actif is not true or auteur.role not in ('gerant','manager') then
    insert into nexus_connexion.journal (user_id, evenement, detail)
      values (p_par, 'auteur_refuse', jsonb_build_object('action','alerte_indisponible','par', p_par));
    return jsonb_build_object('ok', false, 'motif', 'auteur_refuse');
  end if;
  -- Nombre global sur l'heure écoulée : le journal n'a pas de site, aucun compte dans la réponse.
  select count(*), min(at), max(at) into n, premier, dernier from nexus_connexion.journal
   where evenement = 'indisponible' and at > now() - interval '1 hour';
  return jsonb_build_object('ok', true, 'site_id', auteur.site_id, 'role', auteur.role,
    'active', n > 0, 'nombre_1h', n, 'premier', premier, 'dernier', dernier,
    'action', case when auteur.role = 'gerant' then 'verifier_service' else 'prevenir_gerant' end);
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
