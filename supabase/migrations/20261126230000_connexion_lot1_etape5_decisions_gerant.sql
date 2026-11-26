-- Connexion lot 1, étape 5 : décisions du gérant (Guardian 7182241504), Test uniquement.
-- 1. Journal conservé 6 mois (180 jours) ; purge automatique quotidienne (pg_cron, si l'extension est présente).
-- 2. Code temporaire valable 24 h : poser_code fixe l'échéance, code_temporaire_expire la contrôle.
-- 3. Alerte « connexion indisponible » : lue par le gérant et les managers, limitée à leur propre site.
-- Les migrations déjà appliquées ne sont pas modifiées. Exécutable par service_role seulement.

-- 1. Rétention : 180 jours.
alter table nexus_connexion.parametres alter column retention_journal_j set default 180;
update nexus_connexion.parametres set retention_journal_j = 180 where id = 1 and retention_journal_j = 90;

do $c$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'nexus-connexion-purge';
    perform cron.schedule('nexus-connexion-purge', '15 3 * * *', 'select nexus_connexion.purger()');
  end if;
end $c$;

-- 2. Code temporaire : 24 h. poser_code pose l'échéance (null hors code temporaire).
create or replace function nexus_connexion.poser_code(p_user_id uuid, p_hash text, p_etat text, p_version int) returns void
language plpgsql volatile security definer set search_path = nexus_connexion, public, pg_temp as
$$
begin
  if p_etat not in ('a_migrer','migre','code_temporaire_requis') then raise exception 'etat invalide'; end if;
  if p_hash is null or p_hash !~ '^\$2[aby]\$[0-9]{2}\$.{53}$' then raise exception 'hash bcrypt attendu'; end if;
  update nexus_connexion.compte
     set code_hash = p_hash, etat = p_etat, version = p_version, maj = now(),
         echeance = case when p_etat = 'code_temporaire_requis' then now() + interval '24 hours' else null end
   where user_id = p_user_id;
  insert into nexus_connexion.journal (user_id, evenement, detail) values (p_user_id, 'code_pose', jsonb_build_object('etat', p_etat, 'version', p_version));
end $$;

-- Vrai si le code temporaire du compte a dépassé son échéance (journalisé). L'Edge Function répond alors par le refus neutre, sans compter d'échec.
create or replace function nexus_connexion.code_temporaire_expire(p_user_id uuid) returns boolean
language plpgsql volatile security definer set search_path = nexus_connexion, pg_temp as
$$
declare c nexus_connexion.compte%rowtype;
begin
  select * into c from nexus_connexion.compte where user_id = p_user_id;
  if not found or c.etat <> 'code_temporaire_requis' or c.echeance is null or c.echeance > now() then return false; end if;
  insert into nexus_connexion.journal (user_id, evenement) values (p_user_id, 'code_temporaire_expire');
  return true;
end $$;

-- 3. Alerte « connexion indisponible » : gérant et managers actifs, jamais un autre rôle.
-- Le journal ne porte pas de site (la panne touche toute la connexion) : chaque lecteur ne reçoit que son propre site.
-- Le gérant reçoit l'action technique ; le manager, la consigne d'attente sans aucune action technique.
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

do $g$
declare f text;
begin
  for f in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'nexus_connexion' loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $g$;
