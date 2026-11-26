-- Retour arrière de l'étape 5b : rétablir alerte_indisponible_pour de 20261126230000 (sans premier).
-- Test seulement. Ne touche à aucun compte ni au journal.
create or replace function nexus_connexion.alerte_indisponible_pour(p_par uuid) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare auteur public.employees%rowtype; n int; dernier timestamptz;
begin
  select * into auteur from public.employees where id = p_par;
  if not found or auteur.actif is not true or auteur.role not in ('gerant','manager') then
    insert into nexus_connexion.journal (user_id, evenement, detail)
      values (p_par, 'auteur_refuse', jsonb_build_object('action','alerte_indisponible','par', p_par));
    return jsonb_build_object('ok', false, 'motif', 'auteur_refuse');
  end if;
  select count(*), max(at) into n, dernier from nexus_connexion.journal
   where evenement = 'indisponible' and at > now() - interval '1 hour';
  return jsonb_build_object('ok', true, 'site_id', auteur.site_id, 'role', auteur.role,
    'active', n > 0, 'nombre_1h', n, 'dernier', dernier,
    'action', case when auteur.role = 'gerant' then 'verifier_service' else 'prevenir_gerant' end);
end $$;
