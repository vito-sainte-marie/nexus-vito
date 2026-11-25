-- Connexion lot 1, étape 2c : un refus d'auteur laisse une trace.
-- Avant : insert 'auteur_refuse' puis raise exception => l'exception annulait l'insertion.
-- Maintenant : lever_verrou et reinitialiser_code ne lèvent plus d'exception sur un refus ; elles écrivent le journal
-- (validé avec l'appel) puis rendent un statut jsonb que l'Edge Function traduit en refus.
-- Test uniquement.

drop function if exists nexus_connexion.lever_verrou(uuid, uuid);
drop function if exists nexus_connexion.reinitialiser_code(uuid, text, int, uuid);

create function nexus_connexion.lever_verrou(p_user_id uuid, p_par uuid) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  if not nexus_connexion.auteur_autorise(p_par, p_user_id) then
    insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'auteur_refuse', jsonb_build_object('action','lever_verrou','par', p_par));
    return jsonb_build_object('ok', false, 'motif', 'auteur_refuse');
  end if;
  update nexus_connexion.compte set a_deverrouiller = false, echecs = 0, dernier_echec = null, prochain_essai = null, maj = now() where user_id = p_user_id;
  update nexus_connexion.alerte set traitee_le = now(), traitee_par = p_par where user_id = p_user_id and traitee_le is null;
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'verrou_leve', jsonb_build_object('par', p_par));
  return jsonb_build_object('ok', true);
end $$;

create function nexus_connexion.reinitialiser_code(p_user_id uuid, p_hash text, p_version int, p_par uuid) returns jsonb
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  if not nexus_connexion.auteur_autorise(p_par, p_user_id) then
    insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'auteur_refuse', jsonb_build_object('action','reinitialiser_code','par', p_par));
    return jsonb_build_object('ok', false, 'motif', 'auteur_refuse');
  end if;
  perform nexus_connexion.poser_code(p_user_id, p_hash, 'code_temporaire_requis', p_version);
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'code_reinitialise', jsonb_build_object('par', p_par));
  return jsonb_build_object('ok', true);
end $$;

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
