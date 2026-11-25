-- Connexion lot 1, étape 2d : deux lectures pour l'Edge Function `connexion`.
-- compter_succes : combien de connexions réussies sur la fenêtre (toutes passent par l'IP de sortie de l'Edge Function,
-- donc par la même limite Auth). Au-delà du seuil, une ligne 'egress_sature' est journalisée et l'appelant répond « indisponible ».
-- lire_compte : état, version, empreinte du code et alias d'un compte, pour le changement de code et la réinitialisation.
-- Test uniquement. Service_role seul.

create or replace function nexus_connexion.compter_succes(p_fenetre_min int default 5, p_seuil int default 24) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
declare n int;
begin
  select count(*) into n from nexus_connexion.journal
   where evenement = 'succes' and at > now() - make_interval(mins => p_fenetre_min);
  if n >= p_seuil then
    insert into nexus_connexion.journal (evenement, detail) values ('egress_sature', jsonb_build_object('n', n, 'seuil', p_seuil, 'fenetre_min', p_fenetre_min));
  end if;
  return jsonb_build_object('n', n, 'sature', n >= p_seuil);
end $$;

create or replace function nexus_connexion.lire_compte(p_user_id uuid) returns jsonb
language sql stable security definer set search_path = nexus_connexion, public, pg_temp as
$$
  select coalesce((select jsonb_build_object('etat', c.etat, 'version', c.version, 'code_hash', c.code_hash,
                                              'alias', nexus_connexion.alias_de('u:' || c.user_id::text))
                     from nexus_connexion.compte c where c.user_id = p_user_id),
                  jsonb_build_object('etat', null))
$$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
