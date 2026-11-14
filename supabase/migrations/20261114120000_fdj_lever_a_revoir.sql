-- FDJ Manager : lever la marque « à revoir » d'un quart.
--
-- Pourquoi. fdj_manager_marquer_a_revoir pose a_revoir = true sur le quart
-- suivant une correction rétroactive de stock initial déjà confirmé. Rien ne
-- remettait jamais la marque à false : le quart du 14/11 (quart 1) avait son
-- stock initial aligné, son alerte de continuité résolue, l'accueil disait
-- « Chaîne continue », et la ligne restait « à revoir » pour toujours.
--
-- Commande. fdj_manager_lever_a_revoir(p_shift_id, p_motif) :
--   * manager ou gérant du même site (garde fdj_quart_du_manager) ;
--   * motif de levée obligatoire ;
--   * refuse tant qu'une alerte continuite_stock_a_verifier ou
--     chaine_interrompue reste ouverte sur le quart ;
--   * ne fait rien si le quart n'est pas à revoir ;
--   * journalise dans fdj_audit_log l'ancien motif, la date de pose, l'auteur
--     et le motif de levée.
--
-- Ordre de déploiement : migration puis code. Code seul : PGRST202.
--
-- Retour arrière : drop function public.fdj_manager_lever_a_revoir(uuid, text);
--   puis `delete from supabase_migrations.schema_migrations where version =
--   '20261114120000';` si la ligne de registre a été posée.

create or replace function public.fdj_manager_lever_a_revoir(p_shift_id uuid, p_motif text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_ouvertes integer;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  if p_motif is null or char_length(btrim(p_motif)) < 5 then
    raise exception 'Motif de levée manquant (5 caractères au moins).'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_shift.a_revoir is not true then
    return false;
  end if;

  select count(*) into v_ouvertes
    from public.fdj_alertes a
   where a.shift_id = p_shift_id
     and a.type in ('continuite_stock_a_verifier', 'chaine_interrompue')
     and a.resolue_le is null;

  if v_ouvertes > 0 then
    raise exception 'Une alerte de continuité reste ouverte sur ce quart : levée refusée.'
      using errcode = 'check_violation';
  end if;

  update public.fdj_shifts
     set a_revoir = false, a_revoir_motif = null, a_revoir_depuis_le = null
   where id = p_shift_id;

  insert into public.fdj_audit_log
    (site, shift_id, entite_type, entite_id, action, acteur_id, motif, ancienne_valeur, nouvelle_valeur)
  values
    (v_shift.site, p_shift_id, 'fdj_shift', p_shift_id, 'a_revoir_leve', (select auth.uid()), btrim(p_motif),
     jsonb_build_object('a_revoir', true, 'a_revoir_motif', v_shift.a_revoir_motif,
                        'a_revoir_depuis_le', v_shift.a_revoir_depuis_le),
     jsonb_build_object('a_revoir', false));

  return true;
end;
$$;

revoke all on function public.fdj_manager_lever_a_revoir(uuid, text) from public;
revoke all on function public.fdj_manager_lever_a_revoir(uuid, text) from anon;
grant execute on function public.fdj_manager_lever_a_revoir(uuid, text) to authenticated;
grant execute on function public.fdj_manager_lever_a_revoir(uuid, text) to service_role;

comment on function public.fdj_manager_lever_a_revoir(uuid, text) is
  'Lève la marque « à revoir » d''un quart FDJ (manager du site), refusée si une alerte de continuité est ouverte ; journalisée.';
