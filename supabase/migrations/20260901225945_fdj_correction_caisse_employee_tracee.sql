-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260901225945 · fdj_correction_caisse_employee_tracee
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.fdj_releves_cloture
  drop constraint if exists fdj_releves_cloture_type_version_check;
alter table public.fdj_releves_cloture
  add constraint fdj_releves_cloture_type_version_check
  check (type_version = any (array['validation_employe'::text, 'correction_employe'::text, 'regularisation_manager'::text, 'recalcul_automatique_chaine'::text]));

create or replace function public.fdj_sync_releve_apres_cash_control()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_shift record;
  v_prev record;
  v_employee record;
  v_si jsonb;
  v_ap jsonb;
  v_sf jsonb;
  v_ventes jsonb;
  v_lots numeric;
  v_tirages numeric;
  v_version integer;
  v_correction_employe boolean := coalesce(current_setting('nexus.fdj_correction_employe', true), 'false') = 'true';
  v_motif text := nullif(current_setting('nexus.fdj_correction_motif', true), '');
  v_commentaire text := nullif(current_setting('nexus.fdj_correction_commentaire', true), '');
  v_type text;
  v_statut text;
begin
  select * into v_shift from fdj_shifts where id = new.shift_id;
  if not found or v_shift.statut <> 'valide' then return new; end if;

  select * into v_prev from fdj_releves_cloture
  where shift_id = new.shift_id order by version_num desc limit 1;
  if not found then return new; end if;

  if v_prev.ecart is not distinct from new.ecart
     and v_prev.caisse_attendue is not distinct from new.caisse_attendue
     and v_prev.caisse_reelle is not distinct from new.caisse_reelle
     and v_prev.ventes_grattage_valeur is not distinct from new.ventes_grattage_valeur
     and v_prev.regularisations is not distinct from new.regularisations then
    return new;
  end if;

  select coalesce(jsonb_object_agg(game_id, stock_initial), '{}'::jsonb),
         coalesce(jsonb_object_agg(game_id, appro), '{}'::jsonb),
         coalesce(jsonb_object_agg(game_id, stock_final), '{}'::jsonb),
         coalesce(jsonb_object_agg(game_id, jsonb_build_object('qte', ventes_qte, 'valeur', ventes_valeur)), '{}'::jsonb)
  into v_si, v_ap, v_sf, v_ventes
  from fdj_shift_counts where shift_id = new.shift_id;

  select max(lots_payes_grattage) filter (where type_rapport='journalier'),
         max(caisse_tirages) filter (where type_rapport='temps_reel')
  into v_lots, v_tirages from fdj_reports where shift_id = new.shift_id;

  select coalesce(max(version_num),0) + 1 into v_version
  from fdj_releves_cloture where shift_id = new.shift_id;
  select id, nom, role into v_employee from employees where id = auth.uid();

  v_type := case when v_correction_employe then 'correction_employe' else 'regularisation_manager' end;
  v_statut := case when v_correction_employe
    then case when new.ecart is null or new.ecart = 0 then 'conforme' else 'valide_avec_ecart' end
    else 'regularise' end;

  insert into fdj_releves_cloture(
    site, shift_id, date, quart, employee_id, version_num, type_version, cree_par,
    stock_initial_par_jeu, appro_par_jeu, stock_final_par_jeu, ventes_par_jeu,
    ventes_grattage_valeur, lots_payes_grattage, caisse_tirages, regularisations,
    caisse_attendue, caisse_reelle, ecart, anomalie_chaine, statut,
    motif_regularisation, diff_vs_precedent, signature, caractere
  ) values (
    v_shift.site, v_shift.id, v_shift.date, v_shift.quart, v_shift.employee_id,
    v_version, v_type, auth.uid(),
    v_si, v_ap, v_sf, v_ventes,
    new.ventes_grattage_valeur, v_lots, v_tirages, new.regularisations,
    new.caisse_attendue, new.caisse_reelle, new.ecart,
    coalesce(v_prev.anomalie_chaine, '{}'::jsonb), v_statut,
    case when v_correction_employe then v_motif else 'Synchronisation automatique après mise à jour du contrôle FDJ' end,
    jsonb_build_object(
      'ecart', jsonb_build_object('avant', v_prev.ecart, 'apres', new.ecart),
      'caisse_attendue', jsonb_build_object('avant', v_prev.caisse_attendue, 'apres', new.caisse_attendue),
      'caisse_reelle', jsonb_build_object('avant', v_prev.caisse_reelle, 'apres', new.caisse_reelle),
      'motif', v_motif, 'commentaire', v_commentaire
    ),
    jsonb_build_object(
      'utilisateur_id', auth.uid(),
      'nom', coalesce(v_employee.nom, 'NEXUS'),
      'role', case when v_correction_employe then 'employe' else coalesce(v_employee.role, 'system') end,
      'date_heure', now(), 'version_donnees', v_version, 'quart_id', v_shift.id,
      'message_confirmation', case when v_correction_employe
        then 'Correction de caisse par la caissière après recomptage. La déclaration initiale reste conservée.'
        else 'Relevé synchronisé automatiquement avec le contrôle FDJ courant.' end
    ),
    coalesce(v_prev.caractere, 'definitif')
  );
  return new;
end;
$function$;

create or replace function public.fdj_corriger_caisse_employe(
  p_shift_id uuid,
  p_nouvelle_caisse numeric,
  p_motif text,
  p_commentaire text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_shift record;
  v_cash record;
  v_nouvel_ecart numeric;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  if p_nouvelle_caisse is null or p_nouvelle_caisse < 0 then raise exception 'Montant de caisse invalide'; end if;
  if p_motif not in ('erreur_comptage', 'erreur_monnaie', 'autre') then raise exception 'Motif obligatoire ou invalide'; end if;

  select * into v_shift from fdj_shifts where id = p_shift_id for update;
  if not found or v_shift.statut <> 'valide' then raise exception 'Le quart doit être clôturé'; end if;
  if v_shift.employee_id is distinct from auth.uid() then raise exception 'Seule la caissière de ce quart peut corriger sa caisse'; end if;

  select * into v_cash from fdj_cash_controls where shift_id = p_shift_id for update;
  if not found then raise exception 'Contrôle de caisse introuvable'; end if;
  if v_cash.caisse_reelle is not distinct from round(p_nouvelle_caisse, 2) then raise exception 'Le montant est inchangé'; end if;

  v_nouvel_ecart := round((p_nouvelle_caisse - v_cash.caisse_attendue)::numeric, 2);
  perform set_config('nexus.fdj_correction_employe', 'true', true);
  perform set_config('nexus.fdj_correction_motif', p_motif, true);
  perform set_config('nexus.fdj_correction_commentaire', coalesce(p_commentaire, ''), true);

  update fdj_cash_controls
  set caisse_reelle = round(p_nouvelle_caisse, 2), ecart = v_nouvel_ecart,
      motif_ecart = p_motif, motif_ecart_texte = nullif(trim(p_commentaire), ''),
      statut = 'provisoire', updated_at = now()
  where id = v_cash.id;

  insert into fdj_corrections(site, shift_id, correction_type, old_value, new_value, reason_code, commentaire, created_by)
  values (v_shift.site, p_shift_id, 'caisse_reelle_employe', v_cash.caisse_reelle, round(p_nouvelle_caisse, 2), p_motif, nullif(trim(p_commentaire), ''), auth.uid());

  insert into fdj_audit_log(site, shift_id, entite_type, entite_id, action, ancienne_valeur, nouvelle_valeur, acteur_id, motif)
  values (v_shift.site, p_shift_id, 'fdj_cash_control', v_cash.id, 'fdj_caisse_corrigee_par_employee',
    jsonb_build_object('caisse_reelle', v_cash.caisse_reelle, 'ecart', v_cash.ecart),
    jsonb_build_object('caisse_reelle', round(p_nouvelle_caisse, 2), 'ecart', v_nouvel_ecart, 'commentaire', nullif(trim(p_commentaire), '')),
    auth.uid(), p_motif);

  return jsonb_build_object('caisse_reelle', round(p_nouvelle_caisse, 2), 'ecart', v_nouvel_ecart);
end;
$function$;

revoke all on function public.fdj_corriger_caisse_employe(uuid,numeric,text,text) from public;
grant execute on function public.fdj_corriger_caisse_employe(uuid,numeric,text,text) to authenticated;
