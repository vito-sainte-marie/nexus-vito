-- ============================================================================
-- Nouvelle validation quand le résultat change (mandat consolidé §6, B5)
-- ============================================================================
-- P1 (e6ab6f1) réaligne l'écart validé d'un audit modifié quand la
-- validation portait sur le calcul, sans toucher valide_le_* : l'écart
-- restait « clôturé » et ouvert aux versements de régularisation avec une
-- valeur qu'aucun manager n'avait validée. Le mandat (§6) exige une nouvelle
-- validation dès que le résultat change.
--
-- Ce qui est ajouté :
--   revalidation_requise_piste_le / _boutique_le   instant où le serveur a
--     constaté que, sur une caisse validée, l'écart calculé ou l'écart
--     retenu a changé sans nouvelle validation (valide_le_* inchangé).
--     Effacé par une validation (valide_le_* qui change). L'écran ne peut ni
--     le poser ni l'effacer : la valeur envoyée est ignorée.
--   _ecarts_regul_origine   une caisse à valider de nouveau n'est plus
--     clôturée ; versement et restitution sont refusés [ECART_A_REVALIDER].
--   ecart_regularisation_etat   expose `revalidation_requise`.
--
-- Rien n'est réécrit : ni les champs _origine, ni valide_le_*, ni
-- l'historique (snapshot audits_caisse_versions posé par Verify). Les audits
-- existants partent sans revalidation requise. FDJ n'est pas concerné : une
-- correction y crée une version V2 qui n'est jamais validée d'office.
--
-- Retour arrière : drop trigger trg_audits_caisse_revalidation ; drop
-- function public.audits_caisse_revalidation_controle() ; rejouer
-- _ecarts_regul_origine et ecart_regularisation_etat de 20261008130000 ;
-- alter table public.audits_caisse drop column revalidation_requise_piste_le,
-- drop column revalidation_requise_boutique_le.
-- Épreuve : outils/epreuve-revalidation-20261008/executer.sh
-- ============================================================================

alter table public.audits_caisse
  add column revalidation_requise_piste_le timestamptz,
  add column revalidation_requise_boutique_le timestamptz;

comment on column public.audits_caisse.revalidation_requise_piste_le is
  'B5 (20261008150000) : résultat piste modifié après validation ; nouvelle validation requise depuis cet instant. Posé et effacé par trg_audits_caisse_revalidation seulement.';
comment on column public.audits_caisse.revalidation_requise_boutique_le is
  'B5 (20261008150000) : résultat boutique modifié après validation ; nouvelle validation requise depuis cet instant. Posé et effacé par trg_audits_caisse_revalidation seulement.';

-- Ordre des déclencheurs BEFORE (alphabétique) : factures_differees,
-- revalidation, normaliser_ecarts. La comparaison se fait au centime, comme
-- la normalisation qui suit.
create or replace function public.audits_caisse_revalidation_controle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.revalidation_requise_piste_le := null;
    new.revalidation_requise_boutique_le := null;
    return new;
  end if;

  if new.valide_le_piste is distinct from old.valide_le_piste then
    new.revalidation_requise_piste_le := null;   -- validation renouvelée ou retirée
  else
    new.revalidation_requise_piste_le := old.revalidation_requise_piste_le;
    if old.valide_le_piste is not null and old.revalidation_requise_piste_le is null and (
         round(new.ecart_piste, 2) is distinct from round(old.ecart_piste, 2)
         or round(coalesce(new.ecart_piste_valide, new.ecart_piste), 2)
              is distinct from round(coalesce(old.ecart_piste_valide, old.ecart_piste), 2)) then
      new.revalidation_requise_piste_le := now();
    end if;
  end if;

  if new.valide_le_boutique is distinct from old.valide_le_boutique then
    new.revalidation_requise_boutique_le := null;
  else
    new.revalidation_requise_boutique_le := old.revalidation_requise_boutique_le;
    if old.valide_le_boutique is not null and old.revalidation_requise_boutique_le is null and (
         round(new.ecart_boutique, 2) is distinct from round(old.ecart_boutique, 2)
         or round(coalesce(new.ecart_boutique_valide, new.ecart_boutique), 2)
              is distinct from round(coalesce(old.ecart_boutique_valide, old.ecart_boutique), 2)) then
      new.revalidation_requise_boutique_le := now();
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.audits_caisse_revalidation_controle() from public;
revoke all on function public.audits_caisse_revalidation_controle() from anon;
revoke all on function public.audits_caisse_revalidation_controle() from authenticated;

create trigger trg_audits_caisse_revalidation
before insert or update on public.audits_caisse
for each row execute function public.audits_caisse_revalidation_controle();

-- Copie de 20261008130000, seule la clôture Verify change.
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
      -- B5 (§6) : un résultat modifié après validation rouvre l'écart.
      cloture := v_a.valide_le_piste is not null and v_a.revalidation_requise_piste_le is null;
      if p_verrouiller and v_a.revalidation_requise_piste_le is not null then
        raise exception '[ECART_A_REVALIDER] Le résultat de cette caisse a changé après sa validation : un manager doit la valider de nouveau avant toute régularisation.'
          using errcode = 'check_violation';
      end if;
    else
      select array_agg(x) into v_ids
        from jsonb_array_elements_text(case when jsonb_typeof(v_a.employes_boutique) = 'array' then v_a.employes_boutique else '[]'::jsonb end) x
       where nullif(btrim(x), '') is not null;
      ecart_effectif := coalesce(v_a.ecart_boutique_valide, v_a.ecart_boutique);
      -- B5 (§6) : un résultat modifié après validation rouvre l'écart.
      cloture := v_a.valide_le_boutique is not null and v_a.revalidation_requise_boutique_le is null;
      if p_verrouiller and v_a.revalidation_requise_boutique_le is not null then
        raise exception '[ECART_A_REVALIDER] Le résultat de cette caisse a changé après sa validation : un manager doit la valider de nouveau avant toute régularisation.'
          using errcode = 'check_violation';
      end if;
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
    -- B5 (§6) : distinguer « jamais validé » de « à valider de nouveau ».
    'revalidation_requise', p_audit_id is not null and exists (
      select 1 from public.audits_caisse a
       where a.id = p_audit_id
         and case when p_caisse = 'piste' then a.revalidation_requise_piste_le
                  else a.revalidation_requise_boutique_le end is not null),
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
  v_sig := 'public._ecarts_regul_origine(uuid, text, uuid, boolean)';
  execute format('revoke all on function %s from public', v_sig);
  execute format('revoke all on function %s from anon', v_sig);
  execute format('revoke all on function %s from authenticated', v_sig);

  v_sig := 'public.ecart_regularisation_etat(uuid, text, uuid)';
  execute format('revoke all on function %s from public', v_sig);
  execute format('revoke all on function %s from anon', v_sig);
  execute format('grant execute on function %s to authenticated', v_sig);
  execute format('grant execute on function %s to service_role', v_sig);
end;
$$;
