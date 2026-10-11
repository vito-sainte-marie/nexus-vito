-- ============================================================================
-- FDJ Manager — continuité des stocks Q1/Q2 (arbitrage définitif du
-- 10/10/2026, Frédéric), corrigée après la revue obligatoire du même jour.
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
--    journalisées (fdj_audit_log + fdj_corrections) avec auteur, rôle réel,
--    horodatage, motif et origine 'propagation_q1_q2'. Si la caisse de Q1
--    est confirmée, ses montants théoriques et son écart sont recalculés par
--    fdj_corriger_caisse_manager ; l'écart avant/après figure au journal.
--    Ventes négatives (début Q2 > début Q1 + appro) : non refusées, Q2
--    faisant autorité, mais signalées (stock_incoherent par jeu,
--    nb_stocks_incoherents, alerte_manager).
--
-- 2. fdj_corriger_caisse_manager (revue, point 4) : une caisse VALIDÉE dont
--    la caisse théorique, le montant compté ou l'écart change n'est plus
--    couverte par sa validation. La validation est retirée (statut
--    'confirmee', valide_par/valide_le/resultat_controle à NULL), comme le
--    fait fdj_rouvrir_caisse, et tracée par un événement 'reouverture'
--    (cause 'revision_apres_correction') puis une ligne d'audit
--    'fdj_caisse_certification_revoquee'. Une nouvelle validation est
--    nécessaire. Le montant compté, caisse_reelle_origine et ecart_origine
--    restent préservés. Le rôle journalisé est lu dans employees (plus de
--    'manager' en dur).
--
-- 3. fdj_libelle_ecart_manager (revue, point 1) : vocabulaire manager
--    officiel. Écart = caisse comptée − caisse théorique, signe inchangé :
--      > 0 'Excédent constaté : 2,00 €' ; < 0 'Manquant constaté : 2,00 €' ;
--      = 0 'Caisse conforme' ; NULL 'Non comparable'.
--    Aucun écran ne lit ce texte autrement que pour l'afficher.
--
-- 4. fdj_sync_releve_apres_cash_control (déclencheur, revue point 5) :
--    une version de relevé produite par la propagation Q1/Q2 est typée
--    'recalcul_automatique_chaine' / 'recalcule_automatiquement' au lieu de
--    'regularisation_manager' / 'regularise' ; une version qui accompagne un
--    retrait de certification le porte dans sa signature.
--
-- 5. fdj_manager_modifier_quart : valide_le n'est plus écrasé à chaque
--    enregistrement d'un quart déjà validé (« Préserver la date initiale de
--    validation »). Un retour en brouillon le remet à NULL, comme avant.
--
-- Contrôles d'accès : ceux de fdj_quart_du_manager (session, rôle manager
-- ou gérant, site du quart), inchangés. ACL : authenticated et
-- service_role seulement.
--
-- Prérequis : registre ≥ 20261010150000 (Test 316, Production 306). Aucune
-- donnée existante n'est réécrite par la migration elle-même : elle ne fait
-- que (re)définir des fonctions. Idempotente (create or replace).
--
-- Retour arrière :
--   drop function public.fdj_manager_aligner_fin_quart_precedent(uuid, text);
--   rétablir fdj_manager_modifier_quart depuis 20261010150000 ;
--   rétablir fdj_corriger_caisse_manager et fdj_libelle_ecart_manager depuis
--   20260916220700 (définitions identiques à celles servies le 10/10 sur
--   Test et Production) ;
--   rétablir fdj_sync_releve_apres_cash_control depuis 20260901225945
--   (create or replace : l'ACL existante, ouverte à PUBLIC comme pour toute
--   fonction de déclencheur, est conservée par la migration comme par le
--   retour arrière ; le déclencheur lui-même n'est pas recréé).
--   Les lignes de journal écrites entre-temps restent (historique immuable).
-- ============================================================================

create or replace function public.fdj_libelle_ecart_manager(p_ecart numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p_ecart is null then 'Non comparable'
           when p_ecart = 0     then 'Caisse conforme'
           when p_ecart > 0     then 'Excédent constaté : '
                                     || replace(to_char(abs(p_ecart), 'FM999999990.00'), '.', ',') || ' €'
           else                      'Manquant constaté : '
                                     || replace(to_char(abs(p_ecart), 'FM999999990.00'), '.', ',') || ' €'
         end;
$$;

comment on function public.fdj_libelle_ecart_manager(numeric) is
  'Revue du 10/10/2026 — vocabulaire manager : Caisse conforme / Excédent constaté / Manquant constaté. Écart = compté − théorique ; montant sans signe, le sens est porté par le mot. Ni dette ni retenue.';

-- Déclencheur de relevé (revue, point 5). Repris À L'IDENTIQUE de
-- 20260901225945 (empreinte md5 c6e0bb5b… identique sur Test et Production
-- le 10/10/2026), y compris SECURITY DEFINER et search_path 'public', avec
-- deux ajouts seulement :
--   · origine 'propagation_q1_q2' (GUC nexus.fdj_origine_correction posée par
--     fdj_manager_aligner_fin_quart_precedent) -> version
--     'recalcul_automatique_chaine' / 'recalcule_automatiquement', comme le
--     prévoit nexus-fdj-moteur.js (statutRelevecloture) : un recalcul
--     système n'est pas une régularisation manager ;
--   · certification retirée par la mise à jour (old.valide_le non NULL,
--     new.valide_le NULL) -> signature.certification_retiree = true et
--     message explicite. Le champ `caractere` n'est PAS utilisé : il mesure
--     la continuité de la chaîne de quarts, et aucune revalidation n'écrit de
--     version de relevé qui le rétablirait.
create or replace function public.fdj_sync_releve_apres_cash_control()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
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
  v_propagation boolean := coalesce(current_setting('nexus.fdj_origine_correction', true), '') = 'propagation_q1_q2';
  v_certif_retiree boolean := old.valide_le is not null and new.valide_le is null;
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

  v_type := case when v_correction_employe then 'correction_employe'
                 when v_propagation then 'recalcul_automatique_chaine'
                 else 'regularisation_manager' end;
  v_statut := case when v_correction_employe
    then case when new.ecart is null or new.ecart = 0 then 'conforme' else 'valide_avec_ecart' end
    when v_propagation then 'recalcule_automatiquement'
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
    coalesce(nullif(btrim(v_motif), ''), 'Synchronisation automatique après mise à jour du contrôle FDJ'),
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
      'origine', case when v_propagation then 'propagation_q1_q2' end,
      'certification_retiree', v_certif_retiree,
      'message_confirmation', case
        when v_correction_employe
          then 'Correction de caisse par la caissière après recomptage. La déclaration initiale reste conservée.'
        when v_certif_retiree
          then 'Certification retirée : les résultats ont changé, une nouvelle validation est nécessaire.'
        when v_propagation
          then 'Relevé recalculé après rapprochement du stock final sur le début du quart suivant.'
        else 'Relevé synchronisé automatiquement avec le contrôle FDJ courant.' end
    ),
    coalesce(v_prev.caractere, 'definitif')
  );
  return new;
end;
$function$;

create or replace function public.fdj_corriger_caisse_manager(
  p_shift_id uuid,
  p_motif text,
  p_caisse_reelle numeric default null,
  p_regularisations numeric default null,
  p_commentaire text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid := (select auth.uid());
  v_role  text;
  v_avant public.fdj_cash_controls;
  v_calc  jsonb;
  v_valeurs_avant jsonb;
  v_revoquer boolean;
  v_statut_apres text;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);
  -- Rôle réel de l'auteur (manager ou gérant, garanti par la ligne
  -- précédente), lu en base.
  select e.role into v_role from public.employees e where e.id = v_uid;

  if p_motif is null or length(btrim(p_motif)) < 5 then
    raise exception 'Un motif d''au moins 5 caractères est obligatoire pour une correction managériale.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_avant from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  if v_avant.confirme_le is null then
    return jsonb_build_object(
      'corrige', false,
      'motif', 'caisse_non_confirmee',
      'message', 'Cette caisse n''a pas encore été confirmée par l''employé.'
    );
  end if;

  v_valeurs_avant := jsonb_build_object(
    'ventes_grattage_valeur', v_avant.ventes_grattage_valeur,
    'lots_payes_grattage',    v_avant.lots_payes_grattage,
    'caisse_tirages',         v_avant.caisse_tirages,
    'caisse_grattage',        v_avant.caisse_grattage,
    'regularisations',        v_avant.regularisations,
    'caisse_attendue',        v_avant.caisse_attendue,
    'caisse_reelle',          v_avant.caisse_reelle,
    'ecart',                  v_avant.ecart
  );

  -- Le manager ne saisit pas les comptages par jeu ici : cette commande
  -- corrige les montants de caisse.
  v_calc := public.fdj_calculer_caisse(
    p_shift_id,
    coalesce(p_caisse_reelle,   v_avant.caisse_reelle),
    coalesce(p_regularisations, v_avant.regularisations)
  );

  -- Revue du 10/10/2026, point 4 : une validation ne couvre que les valeurs
  -- qu'elle a vues. Si le résultat change, elle est retirée et tracée.
  v_revoquer := (v_avant.valide_le is not null or v_avant.valide_par is not null)
    and (   (v_calc->>'caisse_attendue')::numeric is distinct from v_avant.caisse_attendue
         or (v_calc->>'caisse_reelle')::numeric   is distinct from v_avant.caisse_reelle
         or (v_calc->>'ecart')::numeric           is distinct from v_avant.ecart);
  v_statut_apres := case when v_revoquer then 'confirmee' else v_avant.statut end;

  -- GUC remises à leur valeur « manager » de façon EXPLICITE : une commande
  -- employé exécutée plus tôt dans la même transaction aurait pu laisser
  -- nexus.fdj_correction_employe à 'true', et le trigger
  -- trg_fdj_sync_releve_apres_cash_control produirait alors une version de
  -- relevé étiquetée 'correction_employe' pour un geste du manager.
  perform set_config('nexus.fdj_correction_employe', 'false', true);
  perform set_config('nexus.fdj_correction_motif', p_motif, true);
  perform set_config('nexus.fdj_correction_commentaire', coalesce(p_commentaire, ''), true);

  update public.fdj_cash_controls
     set ventes_grattage_valeur = (v_calc->>'ventes_grattage_valeur')::numeric,
         lots_payes_grattage    = (v_calc->>'lots_payes_grattage')::numeric,
         caisse_grattage        = (v_calc->>'caisse_grattage')::numeric,
         caisse_tirages         = (v_calc->>'caisse_tirages')::numeric,
         regularisations        = (v_calc->>'regularisations')::numeric,
         caisse_attendue        = (v_calc->>'caisse_attendue')::numeric,
         caisse_reelle          = (v_calc->>'caisse_reelle')::numeric,
         ecart                  = (v_calc->>'ecart')::numeric,
         -- caisse_reelle_origine et ecart_origine restent intacts.
         statut                 = v_statut_apres,
         valide_par             = case when v_revoquer then null else v_avant.valide_par end,
         valide_le              = case when v_revoquer then null else v_avant.valide_le end,
         resultat_controle      = case when v_revoquer then null else v_avant.resultat_controle end,
         version                = v_avant.version + 1,
         nb_corrections         = v_avant.nb_corrections + 1,
         derniere_correction_le = now(),
         updated_at             = now()
   where shift_id = p_shift_id;

  if v_revoquer then
    insert into public.fdj_caisse_evenements (
      site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
      employe_responsable_id, confirmation_initiale_le,
      version_avant, version_apres, nb_corrections_apres,
      statut_avant, statut_apres, ecart_avant, ecart_apres, motif, metadata
    )
    values (
      v_shift.site, v_avant.id, p_shift_id, 'reouverture', v_uid, v_role,
      v_shift.employee_id, v_avant.confirme_le,
      v_avant.version, v_avant.version, v_avant.nb_corrections,
      v_avant.statut, 'confirmee', v_avant.ecart, v_avant.ecart,
      btrim(p_motif),
      jsonb_build_object(
        'cause', 'revision_apres_correction',
        'validation_retiree_de', v_avant.valide_par,
        'validation_retiree_le', v_avant.valide_le,
        'resultat_controle_retire', v_avant.resultat_controle,
        'source', 'fdj_corriger_caisse_manager'
      )
    );

    insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif, metadata)
    values (
      v_shift.site, p_shift_id, 'fdj_cash_control', v_avant.id,
      'fdj_caisse_certification_revoquee', v_uid,
      jsonb_build_object('statut', v_avant.statut, 'valide_par', v_avant.valide_par,
                         'valide_le', v_avant.valide_le, 'resultat_controle', v_avant.resultat_controle,
                         'ecart', v_avant.ecart, 'caisse_attendue', v_avant.caisse_attendue),
      jsonb_build_object('statut', 'confirmee',
                         'ecart', (v_calc->>'ecart')::numeric,
                         'caisse_attendue', (v_calc->>'caisse_attendue')::numeric),
      btrim(p_motif),
      jsonb_build_object('cause', 'revision_apres_correction', 'acteur_role', v_role,
                         'source', 'fdj_corriger_caisse_manager')
    );
  end if;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, valeurs_avant, valeurs_apres,
    ecart_avant, ecart_apres, motif, commentaire, metadata
  )
  values (
    v_shift.site, v_avant.id, p_shift_id, 'correction_manager', v_uid, v_role,
    -- L'auteur de la saisie (le manager) et l'employé opérationnel
    -- concerné restent deux notions distinctes.
    v_shift.employee_id, v_avant.confirme_le,
    v_avant.version, v_avant.version + 1, v_avant.nb_corrections + 1,
    v_avant.statut, v_statut_apres,
    v_valeurs_avant, v_calc,
    v_avant.ecart, (v_calc->>'ecart')::numeric,
    btrim(p_motif), nullif(btrim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object(
      'caisse_etait_validee', v_avant.valide_le is not null,
      'certification_revoquee', v_revoquer,
      'source', 'fdj_corriger_caisse_manager'
    )
  );

  if (v_calc->>'caisse_reelle')::numeric is distinct from v_avant.caisse_reelle then
    insert into public.fdj_corrections (
      site, shift_id, game_id, correction_type, old_value, new_value,
      reason_code, commentaire, created_by
    )
    values (
      v_shift.site, p_shift_id, null, 'caisse_reelle_manager',
      v_avant.caisse_reelle, (v_calc->>'caisse_reelle')::numeric,
      btrim(p_motif), nullif(btrim(coalesce(p_commentaire, '')), ''), v_uid
    );
  end if;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif, metadata)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_avant.id,
    'fdj_caisse_corrigee_par_manager', v_uid,
    v_valeurs_avant, v_calc, btrim(p_motif),
    jsonb_build_object('acteur_role', v_role, 'certification_revoquee', v_revoquer,
                       'source', 'fdj_corriger_caisse_manager')
  );

  return jsonb_build_object(
    'corrige', true,
    'version_precedente', v_avant.version,
    'version', v_avant.version + 1,
    'ecart_avant', v_avant.ecart,
    'ecart', (v_calc->>'ecart')::numeric,
    'caisse_attendue_avant', v_avant.caisse_attendue,
    'caisse_attendue', (v_calc->>'caisse_attendue')::numeric,
    'libelle_ecart', public.fdj_libelle_ecart_manager((v_calc->>'ecart')::numeric),
    'certification_revoquee', v_revoquer,
    'statut', v_statut_apres,
    'caisse_reelle_origine_preservee', v_avant.caisse_reelle_origine,
    'ecart_origine_preserve', v_avant.ecart_origine
  );
end;
$$;

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
  v_role        text;
  v_date_prec   date;
  v_quart_prec  text;
  v_ligne       record;
  v_corrections jsonb := '[]'::jsonb;
  v_n_corr      int := 0;
  v_n_rens      int := 0;
  v_n_incoh     int := 0;
  v_motif       text;
  v_qte         numeric;
  v_cash        public.fdj_cash_controls;
  v_caisse      jsonb := null;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);
  select e.role into v_role from public.employees e where e.id = v_uid;

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
    -- Revue, point 3 : Q2 fait autorité même quand il rend les ventes de Q1
    -- négatives (début Q2 > début Q1 + appro). Rien n'est refusé, mais le
    -- stock est signalé incohérent et le manager alerté.
    if v_qte < 0 then v_n_incoh := v_n_incoh + 1; end if;
    v_corrections := v_corrections || jsonb_build_object(
      'game_id', v_ligne.game_id,
      'ancienne_valeur', v_ligne.ancien,
      'nouvelle_valeur', v_ligne.nouveau,
      'correction_valeur_enregistree', v_ligne.ancien is not null,
      'ventes_avant', jsonb_build_object('qte', v_ligne.ventes_qte, 'valeur', v_ligne.ventes_valeur),
      'ventes_apres', jsonb_build_object('qte', v_qte, 'valeur', v_qte * v_ligne.prix),
      'stock_incoherent', coalesce(v_qte < 0, false)
    );
  end loop;

  if v_n_corr + v_n_rens = 0 then
    return jsonb_build_object('aligne', false, 'motif', 'deja_continu', 'shift_precedent_id', v_prec.id);
  end if;

  -- Un renseignement d'une fin absente n'exige pas de motif saisi : le
  -- journal porte alors ce motif système, explicitement marqué comme tel
  -- (metadata.motif_systeme).
  v_motif := coalesce(nullif(btrim(coalesce(p_motif, '')), ''),
                      'Fin de quart renseignée depuis le début du quart suivant');

  insert into public.fdj_corrections (site, shift_id, game_id, correction_type, old_value, new_value, reason_code, commentaire, created_by)
  select v_shift.site, v_prec.id, (c->>'game_id')::uuid, 'stock_final_aligne_quart_suivant',
         (c->>'ancienne_valeur')::numeric, (c->>'nouvelle_valeur')::numeric, v_motif,
         'Origine propagation_q1_q2 — début du quart suivant ' || p_shift_id::text, v_uid
    from jsonb_array_elements(v_corrections) c;

  -- Recalcul financier de Q1 : seulement si sa caisse existe et a été
  -- confirmée (avant confirmation, le calcul se fait à la confirmation).
  select * into v_cash from public.fdj_cash_controls c where c.shift_id = v_prec.id;
  if found and v_cash.confirme_le is not null then
    -- L'origine est transmise au déclencheur de relevé, puis effacée pour
    -- ne pas colorer une correction manuelle ultérieure de la transaction.
    perform set_config('nexus.fdj_origine_correction', 'propagation_q1_q2', true);
    v_caisse := public.fdj_corriger_caisse_manager(v_prec.id, v_motif, null, null, null);
    perform set_config('nexus.fdj_origine_correction', '', true);
  end if;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif, metadata)
  values (
    v_shift.site, v_prec.id, 'fdj_shift_counts', v_prec.id,
    'alignement_fin_sur_quart_suivant', v_uid,
    (select jsonb_object_agg(c->>'game_id', c->'ancienne_valeur') from jsonb_array_elements(v_corrections) c),
    (select jsonb_object_agg(c->>'game_id', c->'nouvelle_valeur') from jsonb_array_elements(v_corrections) c),
    v_motif,
    jsonb_build_object('origine', 'propagation_q1_q2',
                       'acteur_role', v_role,
                       'motif_systeme', p_motif is null or btrim(p_motif) = '',
                       'shift_suivant_id', p_shift_id, 'corrections', v_corrections,
                       'nb_corrections', v_n_corr, 'nb_renseignements', v_n_rens,
                       'nb_stocks_incoherents', v_n_incoh,
                       'caisse', case when v_caisse is null then null else jsonb_build_object(
                         'ecart_avant', v_caisse->'ecart_avant', 'ecart_apres', v_caisse->'ecart',
                         'caisse_attendue_avant', v_caisse->'caisse_attendue_avant',
                         'caisse_attendue_apres', v_caisse->'caisse_attendue',
                         'certification_revoquee', v_caisse->'certification_revoquee') end,
                       'source', 'fdj_manager_aligner_fin_quart_precedent')
  );

  return jsonb_build_object(
    'aligne', true,
    'shift_precedent_id', v_prec.id,
    'nb_corrections', v_n_corr,
    'nb_renseignements', v_n_rens,
    'alerte_manager', v_n_corr > 0 or v_n_incoh > 0,
    'nb_stocks_incoherents', v_n_incoh,
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

revoke all on function public.fdj_libelle_ecart_manager(numeric) from public;
revoke all on function public.fdj_libelle_ecart_manager(numeric) from anon;
grant execute on function public.fdj_libelle_ecart_manager(numeric) to authenticated;
grant execute on function public.fdj_libelle_ecart_manager(numeric) to service_role;

revoke all on function public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text) from public;
revoke all on function public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text) from anon;
grant execute on function public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text) to authenticated;
grant execute on function public.fdj_corriger_caisse_manager(uuid, text, numeric, numeric, text) to service_role;

revoke all on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) from public;
revoke all on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) from anon;
grant execute on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) to authenticated;
grant execute on function public.fdj_manager_aligner_fin_quart_precedent(uuid, text) to service_role;

revoke all on function public.fdj_manager_modifier_quart(uuid, date, text, text) from public;
revoke all on function public.fdj_manager_modifier_quart(uuid, date, text, text) from anon;
grant execute on function public.fdj_manager_modifier_quart(uuid, date, text, text) to authenticated;
grant execute on function public.fdj_manager_modifier_quart(uuid, date, text, text) to service_role;
