-- ============================================================================
-- FDJ Manager — continuité des stocks Q1/Q2 (arbitrage définitif du
-- 10/10/2026, Frédéric).
--
-- 1. fdj_manager_aligner_fin_quart_precedent(p_shift_id, p_motif)
--    Le stock initial d'un quart fait autorité sur le stock final du quart
--    qui le précède. Appelée après un enregistrement du quart p_shift_id
--    (le « Q2 »), elle rapproche la fin du quart précédent (le « Q1 ») :
--      · fin Q1 absente, début Q2 présent  -> fin Q1 renseignée ;
--      · fin Q1 enregistrée, différente     -> fin Q1 corrigée, MOTIF EXIGÉ.
--    Les valeurs viennent de la base, jamais du navigateur : la commande ne
--    peut qu'aligner Q1 sur Q2, pas écrire un stock arbitraire. Q2 n'est
--    jamais réécrit.
--    Pour chaque jeu touché : ventes recalculées (stock initial + appro −
--    stock final, au prix de fdj_games), ancienne et nouvelle valeur
--    journalisées (fdj_audit_log + fdj_corrections) avec auteur, horodatage
--    et motif. Si la caisse de Q1 est confirmée, ses montants théoriques
--    et son écart sont recalculés par fdj_corriger_caisse_manager, qui
--    préserve caisse_reelle, caisse_reelle_origine, ecart_origine,
--    valide_le et valide_par. Rien n'est certifié.
--
-- 2. fdj_manager_modifier_quart : valide_le n'est plus écrasé à chaque
--    enregistrement d'un quart déjà validé (« Préserver la date initiale de
--    validation »). Un retour en brouillon le remet à NULL, comme avant.
--
-- Contrôles d'accès : ceux de fdj_quart_du_manager (session, rôle manager
-- ou gérant, site du quart), inchangés. ACL : authenticated et
-- service_role seulement.
--
-- Retour arrière : drop function public.fdj_manager_aligner_fin_quart_precedent(uuid, text);
-- puis rétablir fdj_manager_modifier_quart depuis 20261010150000.
-- ============================================================================

create or replace function public.fdj_manager_aligner_fin_quart_precedent(
  p_shift_id uuid,
  p_motif text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift       public.fdj_shifts;
  v_prec        public.fdj_shifts;
  v_uid         uuid := (select auth.uid());
  v_date_prec   date;
  v_quart_prec  text;
  v_ligne       record;
  v_corrections jsonb := '[]'::jsonb;
  v_n_corr      int := 0;
  v_n_rens      int := 0;
  v_motif       text;
  v_qte         numeric;
  v_cash        public.fdj_cash_controls;
  v_caisse      jsonb := null;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);

  if v_shift.quart = '2' then
    v_date_prec := v_shift.date; v_quart_prec := '1';
  else
    v_date_prec := v_shift.date - 1; v_quart_prec := '2';
  end if;

  select * into v_prec from public.fdj_shifts s
   where s.site = v_shift.site and s.date = v_date_prec and s.quart = v_quart_prec;
  if not found then
    return jsonb_build_object('aligne', false, 'motif', 'pas_de_quart_precedent');
  end if;
  -- Même contrôle d'accès sur le quart qui sera écrit.
  perform public.fdj_quart_du_manager(v_prec.id);

  -- Une correction de valeur enregistrée exige un motif ; un simple
  -- renseignement d'une fin absente n'en exige pas.
  if exists (
    select 1
      from public.fdj_shift_counts q2
      join public.fdj_shift_counts q1 on q1.shift_id = v_prec.id and q1.game_id = q2.game_id
     where q2.shift_id = p_shift_id
       and q2.stock_initial is not null
       and q1.stock_final is not null
       and q1.stock_final <> q2.stock_initial
  ) and (p_motif is null or length(btrim(p_motif)) < 5) then
    raise exception 'Corriger un stock final déjà enregistré exige un motif d''au moins 5 caractères.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in
    select q1.id, q1.game_id, q1.stock_initial, q1.appro, q1.stock_final as ancien,
           q1.ventes_qte, q1.ventes_valeur, q2.stock_initial as nouveau, g.prix
      from public.fdj_shift_counts q2
      join public.fdj_shift_counts q1 on q1.shift_id = v_prec.id and q1.game_id = q2.game_id
      join public.fdj_games g on g.id = q1.game_id and g.site = v_shift.site
     where q2.shift_id = p_shift_id
       and q2.stock_initial is not null
       and q1.stock_final is distinct from q2.stock_initial
     for update of q1
  loop
    v_qte := case when v_ligne.stock_initial is null then null
                  else v_ligne.stock_initial + coalesce(v_ligne.appro, 0) - v_ligne.nouveau end;
    update public.fdj_shift_counts
       set stock_final   = v_ligne.nouveau,
           ventes_qte    = v_qte,
           ventes_valeur = v_qte * v_ligne.prix,
           updated_at    = now()
     where id = v_ligne.id;

    if v_ligne.ancien is null then v_n_rens := v_n_rens + 1; else v_n_corr := v_n_corr + 1; end if;
    v_corrections := v_corrections || jsonb_build_object(
      'game_id', v_ligne.game_id,
      'ancienne_valeur', v_ligne.ancien,
      'nouvelle_valeur', v_ligne.nouveau,
      'correction_valeur_enregistree', v_ligne.ancien is not null,
      'ventes_avant', jsonb_build_object('qte', v_ligne.ventes_qte, 'valeur', v_ligne.ventes_valeur),
      'ventes_apres', jsonb_build_object('qte', v_qte, 'valeur', v_qte * v_ligne.prix)
    );
  end loop;

  if v_n_corr + v_n_rens = 0 then
    return jsonb_build_object('aligne', false, 'motif', 'deja_continu', 'shift_precedent_id', v_prec.id);
  end if;

  v_motif := coalesce(nullif(btrim(coalesce(p_motif, '')), ''),
                      'Fin de quart renseignée depuis le début du quart suivant');

  insert into public.fdj_corrections (site, shift_id, game_id, correction_type, old_value, new_value, reason_code, commentaire, created_by)
  select v_shift.site, v_prec.id, (c->>'game_id')::uuid, 'stock_final_aligne_quart_suivant',
         (c->>'ancienne_valeur')::numeric, (c->>'nouvelle_valeur')::numeric, v_motif,
         'Début du quart suivant ' || p_shift_id::text, v_uid
    from jsonb_array_elements(v_corrections) c;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif, metadata)
  values (
    v_shift.site, v_prec.id, 'fdj_shift_counts', v_prec.id,
    'alignement_fin_sur_quart_suivant', v_uid,
    (select jsonb_object_agg(c->>'game_id', c->'ancienne_valeur') from jsonb_array_elements(v_corrections) c),
    (select jsonb_object_agg(c->>'game_id', c->'nouvelle_valeur') from jsonb_array_elements(v_corrections) c),
    v_motif,
    jsonb_build_object('shift_suivant_id', p_shift_id, 'corrections', v_corrections,
                       'nb_corrections', v_n_corr, 'nb_renseignements', v_n_rens,
                       'source', 'fdj_manager_aligner_fin_quart_precedent')
  );

  -- Recalcul financier de Q1 : seulement si sa caisse existe et a été
  -- confirmée (avant confirmation, le calcul se fait à la confirmation).
  select * into v_cash from public.fdj_cash_controls c where c.shift_id = v_prec.id;
  if found and v_cash.confirme_le is not null then
    v_caisse := public.fdj_corriger_caisse_manager(v_prec.id, v_motif, null, null, null);
  end if;

  return jsonb_build_object(
    'aligne', true,
    'shift_precedent_id', v_prec.id,
    'nb_corrections', v_n_corr,
    'nb_renseignements', v_n_rens,
    'alerte_manager', v_n_corr > 0,
    'corrections', v_corrections,
    'caisse', v_caisse
  );
end;
$$;

create or replace function public.fdj_manager_modifier_quart(
  p_shift_id uuid,
  p_date date,
  p_quart text,
  p_statut text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
begin
  perform public.fdj_quart_du_manager(p_shift_id);
  if p_date is null or p_quart is null or p_statut is null then
    raise exception 'Date, quart et statut sont requis.'
      using errcode = 'invalid_parameter_value';
  end if;

  update public.fdj_shifts
     set date = p_date, quart = p_quart, statut = p_statut,
         -- 10/10/2026 : la date initiale de validation est préservée.
         valide_le = case when p_statut = 'valide' then coalesce(valide_le, now()) end
   where id = p_shift_id
  returning * into v_shift;
  return to_jsonb(v_shift);
end;
$$;

revoke all on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) from public;
revoke all on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) from anon;
grant execute on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) to authenticated;
grant execute on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) to service_role;

revoke all on function public.fdj_manager_modifier_quart(uuid, date, text, text) from public;
revoke all on function public.fdj_manager_modifier_quart(uuid, date, text, text) from anon;
grant execute on function public.fdj_manager_modifier_quart(uuid, date, text, text) to authenticated;
grant execute on function public.fdj_manager_modifier_quart(uuid, date, text, text) to service_role;
