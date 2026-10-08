-- ============================================================================
-- Versements de régularisation : les cinq règles d'APPROVED_WITH_CONDITIONS
-- (mandat consolidé §2, B3)
-- ============================================================================
-- 20261008120000 (P2) laissait passer trois cas que les règles refusent :
--   R1  un écart FDJ passait pour « validé » dès que resultat_controle était
--       renseigné, y compris `a_revoir` et `non_comparable`, que
--       fdj_valider_caisse enregistre SANS valide_le ni valide_par. La clôture
--       FDJ repose désormais sur la validation prononcée, pour l'origine comme
--       pour le tiroir récepteur. Un écart soldé est refusé par son propre
--       code [ECART_SOLDE] au lieu d'un [PLAFOND_DEPASSE] trompeur. Aucun
--       écart d'origine n'a d'état « annulé » : une validation retirée (renvoi
--       `a_revoir`, recalcul) le rend provisoire, donc [ECART_NON_CLOTURE].
--   R2  la restitution allait toujours au verseur, sans voie pour un tiers.
--       Un tiers est désormais nommé, et l'autorisation du payeur est écrite
--       et conservée ([TIERS_NON_DESIGNE], [AUTORISATION_TIERS_REQUISE]).
--   R5  l'antériorité ne comparait que les jours : le quart 1 d'un jour
--       recevait le versement d'un écart du quart 2 du même jour. La
--       comparaison porte sur (jour, quart) ; le même quart reste permis ; un
--       quart antérieur l'est seulement par une correction de datation
--       documentée, conservée dans `correction_datation`. Les restitutions
--       suivent la même chronologie, sans exception.
-- R3 (transfert depuis le tiroir crédité, plafonné) et R4 (aucune opération
-- dans un quart validé) étaient déjà tenus par P2 et le restent.
-- ecart_regularisation_etat expose en plus `statut_regularisation`
-- (OUVERT, PARTIELLEMENT_REGULARISE, SOLDE).
--
-- Signatures : les deux RPC gagnent des paramètres finaux À DÉFAUT ; les
-- appels existants à dix arguments restent valides. L'ancienne signature est
-- supprimée pour qu'aucune surcharge n'ouvre une voie sans les règles.
--
-- Retour arrière : rejouer les définitions de 20261008120000 (sections 3 à 7
-- et 8 pour les droits), supprimer les deux nouvelles signatures et les
-- colonnes correction_datation, beneficiaire_tiers, autorisation_tiers.
-- Épreuve : outils/epreuve-versements-regularisation-20261008/executer.sh
-- (scénarios R1, R2, R5 et leurs contre-témoins).
-- ============================================================================

alter table public.ecarts_versements_regularisation
  add column correction_datation text,
  add constraint evr_correction_datation check (correction_datation is null or length(btrim(correction_datation)) >= 5);
comment on column public.ecarts_versements_regularisation.correction_datation is
  'Justification écrite quand le quart récepteur précède l''écart (règle 5) ; nulle sinon (20261008130000).';

alter table public.ecarts_restitutions_trop_percu
  add column beneficiaire_tiers text,
  add column autorisation_tiers text,
  add constraint ertp_tiers_autorise check (
       (beneficiaire_tiers is null and autorisation_tiers is null)
    or (length(btrim(beneficiaire_tiers)) >= 2 and length(btrim(coalesce(autorisation_tiers, ''))) >= 5));
comment on column public.ecarts_restitutions_trop_percu.beneficiaire_tiers is
  'Tiers qui reçoit la restitution à la place du payeur réel (employee_id) ; nul quand le payeur la reçoit (règle 2, 20261008130000).';

create or replace function public._ecarts_regul_origine(
  p_audit_id uuid, p_caisse text, p_fdj_cash_control_id uuid, p_verrouiller boolean,
  out site text, out module_origine text, out employee_id uuid, out nb_responsables integer,
  out date_ecart date, out quart_ecart text, out ecart_effectif numeric, out cloture boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a    public.audits_caisse;
  v_ids  text[];
  v_f    record;
begin
  if (p_audit_id is null) = (p_fdj_cash_control_id is null) then
    raise exception 'Désigner exactement une origine : un audit Verify avec sa caisse, ou un contrôle FDJ.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_audit_id is not null then
    if p_caisse is null or p_caisse not in ('piste', 'boutique') then
      raise exception 'Caisse d''origine inconnue : %', coalesce(p_caisse, '(vide)')
        using errcode = 'invalid_parameter_value';
    end if;
    if p_verrouiller then
      select * into v_a from public.audits_caisse a where a.id = p_audit_id for update;
    else
      select * into v_a from public.audits_caisse a where a.id = p_audit_id;
    end if;
    if not found then
      raise exception 'Audit introuvable.' using errcode = 'no_data_found';
    end if;
    site := v_a.site;
    module_origine := 'verify';
    date_ecart := v_a.date;
    quart_ecart := v_a.quart;
    if p_caisse = 'piste' then
      select array_agg(x) into v_ids
        from jsonb_array_elements_text(case when jsonb_typeof(v_a.employes_piste) = 'array' then v_a.employes_piste else '[]'::jsonb end) x
       where nullif(btrim(x), '') is not null;
      ecart_effectif := coalesce(v_a.ecart_piste_valide, v_a.ecart_piste);
      cloture := v_a.valide_le_piste is not null;
    else
      select array_agg(x) into v_ids
        from jsonb_array_elements_text(case when jsonb_typeof(v_a.employes_boutique) = 'array' then v_a.employes_boutique else '[]'::jsonb end) x
       where nullif(btrim(x), '') is not null;
      ecart_effectif := coalesce(v_a.ecart_boutique_valide, v_a.ecart_boutique);
      cloture := v_a.valide_le_boutique is not null;
    end if;
    nb_responsables := coalesce(array_length(v_ids, 1), 0);
    if nb_responsables = 1 then
      employee_id := v_ids[1]::uuid;
    end if;
  else
    if p_verrouiller then
      select c.site, c.ecart, c.valide_le, c.valide_par, s.employee_id, s.date, s.quart into v_f
        from public.fdj_cash_controls c join public.fdj_shifts s on s.id = c.shift_id
       where c.id = p_fdj_cash_control_id
         for update of c;
    else
      select c.site, c.ecart, c.valide_le, c.valide_par, s.employee_id, s.date, s.quart into v_f
        from public.fdj_cash_controls c join public.fdj_shifts s on s.id = c.shift_id
       where c.id = p_fdj_cash_control_id;
    end if;
    if not found then
      raise exception 'Contrôle FDJ introuvable.' using errcode = 'no_data_found';
    end if;
    site := v_f.site;
    module_origine := 'fdj';
    date_ecart := v_f.date;
    quart_ecart := v_f.quart;
    ecart_effectif := v_f.ecart;
    -- Règle 1 : seule une validation prononcée clôt l'écart. `a_revoir` et
    -- `non_comparable` renseignent resultat_controle sans valider.
    cloture := v_f.valide_le is not null and v_f.valide_par is not null;
    employee_id := v_f.employee_id;
    nb_responsables := case when v_f.employee_id is null then 0 else 1 end;
  end if;
end;
$$;

create or replace function public._ecarts_regul_tiroir_clos(p_site text, p_tiroir text, p_date date, p_quart text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case p_tiroir
    when 'tiroir_verify_piste' then exists (
      select 1 from public.audits_caisse a
       where a.site = p_site and a.date = p_date and a.quart = p_quart and a.valide_le_piste is not null)
    when 'tiroir_verify_boutique' then exists (
      select 1 from public.audits_caisse a
       where a.site = p_site and a.date = p_date and a.quart = p_quart and a.valide_le_boutique is not null)
    when 'tiroir_fdj' then exists (
      select 1 from public.fdj_cash_controls c join public.fdj_shifts s on s.id = c.shift_id
       where s.site = p_site and s.date = p_date and s.quart = p_quart and c.valide_le is not null)
    else false
  end;
$$;

drop function public.enregistrer_versement_regularisation(uuid, text, uuid, numeric, text, text, text, date, text, uuid);
drop function public.enregistrer_restitution_trop_percu(uuid, text, uuid, numeric, text, text, text, date, text, uuid);

create function public.enregistrer_versement_regularisation(
  p_audit_id            uuid,
  p_caisse              text,
  p_fdj_cash_control_id uuid,
  p_montant             numeric,
  p_mode                text,
  p_justificatif        text,
  p_destination         text,
  p_recepteur_date      date,
  p_recepteur_quart     text,
  p_idempotency_key     uuid,
  p_correction_datation text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o     record;
  v_s     record;
  v_uid   uuid;
  v_exist public.ecarts_versements_regularisation;
  v_jour  date;
  v_id    uuid;
begin
  if p_idempotency_key is null then
    raise exception 'Clé d''idempotence manquante.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('evr:' || p_idempotency_key::text, 0));
  select * into v_exist from public.ecarts_versements_regularisation where idempotency_key = p_idempotency_key;
  if found then
    if v_exist.auteur_id is distinct from (select auth.uid())
       or v_exist.audit_id is distinct from p_audit_id
       or v_exist.fdj_cash_control_id is distinct from p_fdj_cash_control_id
       or v_exist.montant is distinct from p_montant then
      raise exception '[IDEMPOTENCE_CONFLIT] Cette clé désigne déjà une autre opération.'
        using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('ok', true, 'rejoue', true, 'versement_id', v_exist.id);
  end if;

  if p_montant is null or p_montant <= 0 or p_montant <> round(p_montant, 2) then
    raise exception 'Montant invalide : un nombre positif, au centime.' using errcode = 'invalid_parameter_value';
  end if;
  if p_mode is null or p_mode not in ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre') then
    raise exception 'Mode d''encaissement inconnu : %', coalesce(p_mode, '(vide)') using errcode = 'invalid_parameter_value';
  end if;
  if p_mode = 'autre' and length(btrim(coalesce(p_justificatif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Le mode « autre » exige une justification d''au moins 5 caractères.'
      using errcode = 'check_violation';
  end if;
  if p_destination is null or p_destination not in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj', 'coffre') then
    raise exception 'Destination inconnue : %', coalesce(p_destination, '(vide)') using errcode = 'invalid_parameter_value';
  end if;
  if p_destination <> 'coffre' and (p_recepteur_date is null or p_recepteur_quart is null or p_recepteur_quart not in ('1', '2')) then
    raise exception 'Un tiroir se désigne par la date et le quart (1 ou 2) qui reçoivent l''argent.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_o from public._ecarts_regul_origine(p_audit_id, p_caisse, p_fdj_cash_control_id, true);
  v_uid := public._ecarts_regul_manager(v_o.site);

  if v_o.nb_responsables <> 1 or v_o.employee_id is null then
    raise exception '[ECART_SANS_RESPONSABLE] Cet écart n''a pas de responsable unique : aucune régularisation ne peut lui être imputée.'
      using errcode = 'check_violation';
  end if;
  if not v_o.cloture then
    raise exception '[ECART_NON_CLOTURE] Cet écart n''est pas encore validé.'
      using errcode = 'check_violation';
  end if;

  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  if v_s.deficit = 0 then
    raise exception '[ECART_SANS_DEFICIT] Cet écart n''est pas un manque : rien à régulariser.'
      using errcode = 'check_violation';
  end if;
  if v_s.reste_du = 0 then
    raise exception '[ECART_SOLDE] Cet écart est déjà soldé : rien ne reste dû.'
      using errcode = 'check_violation';
  end if;
  if p_montant > v_s.reste_du then
    raise exception '[PLAFOND_DEPASSE] Le versement (%) dépasse le reste dû (%).', p_montant, v_s.reste_du
      using errcode = 'check_violation';
  end if;

  if p_destination <> 'coffre' then
    select (now() at time zone s.timezone)::date into v_jour from public.sites s where s.site_id = v_o.site;
    if p_recepteur_date > v_jour then
      raise exception '[QUART_RECEPTEUR_FUTUR] Le quart récepteur est postérieur au jour de la station.'
        using errcode = 'check_violation';
    end if;
    -- Règle 5 : le même quart est permis ; un quart antérieur (jour, puis
    -- quart du même jour) seulement par une correction de datation écrite.
    if (p_recepteur_date, p_recepteur_quart) < (v_o.date_ecart, v_o.quart_ecart)
       and length(btrim(coalesce(p_correction_datation, ''))) < 5 then
      raise exception '[QUART_RECEPTEUR_ANTERIEUR] Le quart récepteur précède l''écart régularisé ; seule une correction de datation documentée (5 caractères au moins) le permet.'
        using errcode = 'check_violation';
    end if;
    if public._ecarts_regul_tiroir_clos(v_o.site, p_destination, p_recepteur_date, p_recepteur_quart) then
      raise exception '[QUART_RECEPTEUR_CLOTURE] Ce tiroir appartient à un quart déjà validé.'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.ecarts_versements_regularisation (
    site, employee_id, module_origine, audit_id, caisse_origine, fdj_cash_control_id,
    date_ecart, quart_ecart, montant, mode_encaissement, justificatif, destination,
    recepteur_date, recepteur_quart, auteur_id, idempotency_key, correction_datation)
  values (
    v_o.site, v_o.employee_id, v_o.module_origine, p_audit_id,
    case when p_audit_id is not null then p_caisse end, p_fdj_cash_control_id,
    v_o.date_ecart, v_o.quart_ecart, p_montant, p_mode, nullif(btrim(coalesce(p_justificatif, '')), ''), p_destination,
    case when p_destination <> 'coffre' then p_recepteur_date end,
    case when p_destination <> 'coffre' then p_recepteur_quart end,
    v_uid, p_idempotency_key,
    case when p_destination <> 'coffre'
          and (p_recepteur_date, p_recepteur_quart) < (v_o.date_ecart, v_o.quart_ecart)
         then btrim(p_correction_datation) end)
  returning id into v_id;

  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  return jsonb_build_object('ok', true, 'rejoue', false, 'versement_id', v_id,
    'deficit', v_s.deficit, 'versements', v_s.versements, 'restitutions', v_s.restitutions,
    'reste_du', v_s.reste_du, 'trop_percu', v_s.trop_percu);
end;
$$;

create function public.enregistrer_restitution_trop_percu(
  p_audit_id            uuid,
  p_caisse              text,
  p_fdj_cash_control_id uuid,
  p_montant             numeric,
  p_mode                text,
  p_justification       text,
  p_source              text,
  p_source_date         date,
  p_source_quart        text,
  p_idempotency_key     uuid,
  p_beneficiaire_tiers  text default null,
  p_autorisation_tiers  text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_o     record;
  v_s     record;
  v_uid   uuid;
  v_exist public.ecarts_restitutions_trop_percu;
  v_benef uuid[];
  v_jour  date;
  v_id    uuid;
begin
  if p_idempotency_key is null then
    raise exception 'Clé d''idempotence manquante.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ertp:' || p_idempotency_key::text, 0));
  select * into v_exist from public.ecarts_restitutions_trop_percu where idempotency_key = p_idempotency_key;
  if found then
    if v_exist.valide_par is distinct from (select auth.uid())
       or v_exist.audit_id is distinct from p_audit_id
       or v_exist.fdj_cash_control_id is distinct from p_fdj_cash_control_id
       or v_exist.montant is distinct from p_montant then
      raise exception '[IDEMPOTENCE_CONFLIT] Cette clé désigne déjà une autre opération.'
        using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('ok', true, 'rejoue', true, 'restitution_id', v_exist.id);
  end if;

  if p_montant is null or p_montant <= 0 or p_montant <> round(p_montant, 2) then
    raise exception 'Montant invalide : un nombre positif, au centime.' using errcode = 'invalid_parameter_value';
  end if;
  if p_mode is null or p_mode not in ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre') then
    raise exception 'Mode de restitution inconnu : %', coalesce(p_mode, '(vide)') using errcode = 'invalid_parameter_value';
  end if;
  if length(btrim(coalesce(p_justification, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Une restitution exige une justification d''au moins 5 caractères.'
      using errcode = 'check_violation';
  end if;
  -- Règle 2 : l'argent revient au payeur réel. Un tiers exige son nom et
  -- l'autorisation qui le désigne, tous deux conservés avec la restitution.
  if p_beneficiaire_tiers is not null or p_autorisation_tiers is not null then
    if length(btrim(coalesce(p_beneficiaire_tiers, ''))) < 2 then
      raise exception '[TIERS_NON_DESIGNE] Une restitution à un tiers doit nommer ce tiers.'
        using errcode = 'check_violation';
    end if;
    if length(btrim(coalesce(p_autorisation_tiers, ''))) < 5 then
      raise exception '[AUTORISATION_TIERS_REQUISE] Une restitution à un tiers exige l''autorisation du payeur (5 caractères au moins).'
        using errcode = 'check_violation';
    end if;
  end if;
  if p_source is null or p_source not in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj', 'coffre') then
    raise exception 'Source inconnue : %', coalesce(p_source, '(vide)') using errcode = 'invalid_parameter_value';
  end if;
  if p_source <> 'coffre' and (p_source_date is null or p_source_quart is null or p_source_quart not in ('1', '2')) then
    raise exception 'Un tiroir se désigne par la date et le quart (1 ou 2) d''où sort l''argent.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_o from public._ecarts_regul_origine(p_audit_id, p_caisse, p_fdj_cash_control_id, true);
  v_uid := public._ecarts_regul_manager(v_o.site);

  -- Le bénéficiaire est celui qui a versé, pas le responsable recalculé
  -- aujourd'hui : une désignation ne se recalcule pas.
  select array_agg(distinct v.employee_id) into v_benef
    from public.ecarts_versements_regularisation v
   where v.annule_le is null
     and ((p_audit_id is not null and v.audit_id = p_audit_id and v.caisse_origine = p_caisse)
       or (p_fdj_cash_control_id is not null and v.fdj_cash_control_id = p_fdj_cash_control_id));
  if coalesce(array_length(v_benef, 1), 0) <> 1 then
    raise exception '[PLAFOND_DEPASSE] Aucun versement actif sur cet écart : rien à restituer.'
      using errcode = 'check_violation';
  end if;

  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  if p_montant > v_s.trop_percu then
    raise exception '[PLAFOND_DEPASSE] La restitution (%) dépasse le trop-perçu (%).', p_montant, v_s.trop_percu
      using errcode = 'check_violation';
  end if;

  if p_source <> 'coffre' then
    select (now() at time zone s.timezone)::date into v_jour from public.sites s where s.site_id = v_o.site;
    if p_source_date > v_jour then
      raise exception '[QUART_RECEPTEUR_FUTUR] Le quart désigné est postérieur au jour de la station.'
        using errcode = 'check_violation';
    end if;
    if (p_source_date, p_source_quart) < (v_o.date_ecart, v_o.quart_ecart) then
      raise exception '[QUART_RECEPTEUR_ANTERIEUR] Le quart désigné précède l''écart concerné.'
        using errcode = 'check_violation';
    end if;
    if public._ecarts_regul_tiroir_clos(v_o.site, p_source, p_source_date, p_source_quart) then
      raise exception '[QUART_RECEPTEUR_CLOTURE] Ce tiroir appartient à un quart déjà validé.'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.ecarts_restitutions_trop_percu (
    site, employee_id, module_origine, audit_id, caisse_origine, fdj_cash_control_id,
    montant, mode_restitution, justification, source, source_date, source_quart,
    valide_par, idempotency_key, beneficiaire_tiers, autorisation_tiers)
  values (
    v_o.site, v_benef[1], v_o.module_origine, p_audit_id,
    case when p_audit_id is not null then p_caisse end, p_fdj_cash_control_id,
    p_montant, p_mode, btrim(p_justification), p_source,
    case when p_source <> 'coffre' then p_source_date end,
    case when p_source <> 'coffre' then p_source_quart end,
    v_uid, p_idempotency_key,
    nullif(btrim(coalesce(p_beneficiaire_tiers, '')), ''), nullif(btrim(coalesce(p_autorisation_tiers, '')), ''))
  returning id into v_id;

  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  return jsonb_build_object('ok', true, 'rejoue', false, 'restitution_id', v_id,
    'deficit', v_s.deficit, 'versements', v_s.versements, 'restitutions', v_s.restitutions,
    'reste_du', v_s.reste_du, 'trop_percu', v_s.trop_percu);
end;
$$;

create or replace function public.ecart_regularisation_etat(
  p_audit_id uuid, p_caisse text, p_fdj_cash_control_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_o record;
  v_s record;
begin
  select * into v_o from public._ecarts_regul_origine(p_audit_id, p_caisse, p_fdj_cash_control_id, false);
  perform public._ecarts_regul_manager(v_o.site);
  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  return jsonb_build_object(
    'module_origine', v_o.module_origine,
    'site', v_o.site,
    'date_ecart', v_o.date_ecart,
    'quart_ecart', v_o.quart_ecart,
    'ecart_effectif', v_o.ecart_effectif,
    'cloture', v_o.cloture,
    'responsable_id', v_o.employee_id,
    'sans_responsable', v_o.nb_responsables <> 1,
    'deficit', v_s.deficit,
    'versements', v_s.versements,
    'restitutions', v_s.restitutions,
    'reste_du', v_s.reste_du,
    'trop_percu', v_s.trop_percu,
    'statut', case
      when v_s.trop_percu > 0 then 'trop_percu'
      when v_s.deficit = 0 then 'sans_deficit'
      when v_s.reste_du = 0 then 'regularise'
      when v_s.versements - v_s.restitutions > 0 then 'partiellement_regularise'
      else 'non_regularise' end,
    -- Mandat §2 : OUVERT, PARTIELLEMENT RÉGULARISÉ, SOLDÉ. Un versement
    -- annulé l'est par contre-écriture (annule_le) et ne compte plus.
    'statut_regularisation', case
      when v_s.deficit = 0 then null
      when v_s.reste_du = 0 then 'SOLDE'
      when v_s.versements - v_s.restitutions > 0 then 'PARTIELLEMENT_REGULARISE'
      else 'OUVERT' end);
end;
$$;

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public._ecarts_regul_origine(uuid, text, uuid, boolean)',
    'public._ecarts_regul_tiroir_clos(text, text, date, text)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('revoke all on function %s from authenticated', v_sig);
  end loop;

  foreach v_sig in array array[
    'public.enregistrer_versement_regularisation(uuid, text, uuid, numeric, text, text, text, date, text, uuid, text)',
    'public.enregistrer_restitution_trop_percu(uuid, text, uuid, numeric, text, text, text, date, text, uuid, text, text)',
    'public.ecart_regularisation_etat(uuid, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;
