-- ============================================================================
-- L'attendu de chaque tiroir lit les régularisations (mandat consolidé §3, B8)
-- ============================================================================
-- P2 (20261008120000) enregistre versements, restitutions et transferts avec
-- leur mode et leur tiroir (piste, boutique, FDJ ou coffre), mais aucun
-- attendu ne les lisait : un versement en espèces déposé dans le tiroir
-- boutique du quart récepteur y apparaissait comme un excédent inexpliqué,
-- et le transfert de ce versement vers le coffre comme un manque.
--
-- Ce qui est ajouté :
--   _regul_tiroir_detail(site, tiroir, date, quart)   net des opérations
--     actives (annule_le null) du tiroir d'un quart, ventilé par mode :
--     + versements reçus (destination, recepteur_date, recepteur_quart),
--     − restitutions payées (source, source_date, source_quart),
--     − transferts vers le coffre (source, source_date, source_quart ; mode
--       du versement transféré, sinon « sans_mode »).
--     Le coffre n'a pas d'attendu : il n'a aucun effet.
--   regularisations_tiroirs(site, date, quart)   lecture manager (garde
--     _ecarts_regul_manager) des trois tiroirs, pour l'écran Verify.
--   Verify : audits_caisse.regularisations_piste / _boutique, la valeur que
--     l'écran a ajoutée à l'attendu. Le déclencheur
--     trg_audits_caisse_regularisations refuse [REGULARISATIONS_PERIMEES]
--     quand elle diffère du net serveur au moment où l'écart est écrit ou
--     validé : l'écran ne peut ni l'oublier ni valider un écart calculé
--     avant une opération reçue depuis.
--   FDJ : fdj_calculer_caisse ajoute le net du tiroir FDJ à l'attendu et
--     l'expose (versements_regularisation). Tous les appelants en héritent.
--     fdj_cash_controls.versements_regularisation garde le net retenu par
--     le dernier calcul (posé par le déclencheur, jamais par l'écran) ;
--     fdj_valider_caisse ne recalcule pas, donc la validation est refusée
--     [REGULARISATIONS_PERIMEES] si le net a changé depuis ; le manager
--     recalcule par fdj_corriger_caisse_manager.
--
-- Un tiroir validé n'accepte plus d'opération ni d'annulation
-- ([QUART_RECEPTEUR_CLOTURE], B3) : l'attendu d'un quart clos ne bouge
-- jamais, et les opérations elles-mêmes n'ont pas à déclencher de recalcul.
--
-- Rien n'est réécrit : les audits existants partent à 0 (aucune opération
-- n'existe en Production), les caisses FDJ existantes aussi.
--
-- Ce qu'elle ne fait pas : un écran antérieur qui met à jour un audit déjà
-- aligné sans toucher l'écart passe (sa valeur n'est pas renvoyée, l'ancienne
-- reste) ; un virement dirigé vers un tiroir y compte comme reçu (choix de
-- destination du manager, arbitrage 2 du 08/10).
--
-- Retour arrière : drop trigger trg_audits_caisse_regularisations on
-- public.audits_caisse ; drop trigger trg_fdj_cash_controls_regularisations
-- on public.fdj_cash_controls ; drop function
-- public.audits_caisse_regularisations_controle(),
-- public.fdj_cash_controls_regularisations_controle(),
-- public.regularisations_tiroirs(text, date, text) ; rejouer
-- fdj_calculer_caisse de 20260916220600 ; drop function
-- public._regul_tiroir_detail(text, text, date, text) ; alter table
-- public.audits_caisse drop column regularisations_piste, drop column
-- regularisations_boutique ; alter table public.fdj_cash_controls drop column
-- versements_regularisation.
-- Épreuve : outils/epreuve-regularisations-attendu-20261008/executer.sh
-- ============================================================================

alter table public.audits_caisse
  add column regularisations_piste numeric(12,2) not null default 0,
  add column regularisations_boutique numeric(12,2) not null default 0;

comment on column public.audits_caisse.regularisations_piste is
  'B8 (20261008160000) : net des versements reçus moins restitutions et transferts sortis du tiroir piste de ce quart, ajouté à l''attendu piste. Contrôlé par trg_audits_caisse_regularisations.';
comment on column public.audits_caisse.regularisations_boutique is
  'B8 (20261008160000) : net des versements reçus moins restitutions et transferts sortis du tiroir boutique de ce quart, ajouté à l''attendu boutique. Contrôlé par trg_audits_caisse_regularisations.';

alter table public.fdj_cash_controls
  add column versements_regularisation numeric(12,2) not null default 0;

comment on column public.fdj_cash_controls.versements_regularisation is
  'B8 (20261008160000) : net des versements de régularisation reçus moins restitutions et transferts sortis du tiroir FDJ, inclus dans caisse_attendue par le dernier calcul. Posé par trg_fdj_cash_controls_regularisations seulement. Distinct de `regularisations` (saisie manuelle historique).';

create or replace function public._regul_tiroir_detail(p_site text, p_tiroir text, p_date date, p_quart text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with ops as (
    select v.mode_encaissement as mode, v.montant as entree, 0::numeric as sortie
      from public.ecarts_versements_regularisation v
     where v.site = p_site and v.destination = p_tiroir
       and v.recepteur_date = p_date and v.recepteur_quart = p_quart
       and v.annule_le is null
    union all
    select r.mode_restitution, 0, r.montant
      from public.ecarts_restitutions_trop_percu r
     where r.site = p_site and r.source = p_tiroir
       and r.source_date = p_date and r.source_quart = p_quart
       and r.annule_le is null
    union all
    select coalesce(v.mode_encaissement, 'sans_mode'), 0, t.montant
      from public.caisse_transferts_coffre t
      left join public.ecarts_versements_regularisation v on v.id = t.versement_id
     where t.site = p_site and t.source = p_tiroir
       and t.source_date = p_date and t.source_quart = p_quart
       and t.annule_le is null
  ), par_mode as (
    select mode, sum(entree) as entrees, sum(sortie) as sorties
      from ops group by mode
  )
  select jsonb_build_object(
    'tiroir',  p_tiroir,
    'net',     coalesce((select sum(entrees - sorties) from par_mode), 0),
    'entrees', coalesce((select sum(entrees) from par_mode), 0),
    'sorties', coalesce((select sum(sorties) from par_mode), 0),
    'par_mode', coalesce((select jsonb_object_agg(mode, jsonb_build_object(
                    'entrees', entrees, 'sorties', sorties, 'net', entrees - sorties)
                  order by mode) from par_mode), '{}'::jsonb));
$$;

comment on function public._regul_tiroir_detail(text, text, date, text) is
  'B8 : net des opérations de régularisation actives d''un tiroir d''un quart, ventilé par mode. Le coffre rend 0.';

create or replace function public._regul_tiroir_net(p_site text, p_tiroir text, p_date date, p_quart text)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select case when p_tiroir = 'coffre' or p_date is null or p_quart is null then 0
              else (public._regul_tiroir_detail(p_site, p_tiroir, p_date, p_quart)->>'net')::numeric end;
$$;

-- Lecture manager pour l'écran Verify (et la vue FDJ manager).
create or replace function public.regularisations_tiroirs(p_site text, p_date date, p_quart text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._ecarts_regul_manager(p_site);
  if p_date is null or p_quart is null or p_quart not in ('1', '2') then
    raise exception '[QUART_INVALIDE] Date et quart (1 ou 2) sont obligatoires.'
      using errcode = 'invalid_parameter_value';
  end if;
  return jsonb_build_object(
    'site', p_site, 'date', p_date, 'quart', p_quart,
    'tiroir_verify_piste',    public._regul_tiroir_detail(p_site, 'tiroir_verify_piste', p_date, p_quart),
    'tiroir_verify_boutique', public._regul_tiroir_detail(p_site, 'tiroir_verify_boutique', p_date, p_quart),
    'tiroir_fdj',             public._regul_tiroir_detail(p_site, 'tiroir_fdj', p_date, p_quart));
end;
$$;

comment on function public.regularisations_tiroirs(text, date, text) is
  'B8 : ce que les régularisations ajoutent à l''attendu de chaque tiroir d''un quart, par mode. Managers et gérants du site.';

-- --------------------------------------------------------------------------
-- Verify : la valeur ajoutée par l'écran doit être celle du serveur.
-- Ordre BEFORE (alphabétique) : factures_differees, regularisations,
-- revalidation, normaliser_ecarts.
-- --------------------------------------------------------------------------
create or replace function public.audits_caisse_regularisations_controle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caisse text;
  v_net    numeric;
  v_envoye numeric;
  v_doit   boolean;
begin
  foreach v_caisse in array array['piste', 'boutique'] loop
    v_envoye := case v_caisse when 'piste' then new.regularisations_piste else new.regularisations_boutique end;
    if tg_op = 'INSERT' then
      v_doit := true;
    elsif v_caisse = 'piste' then
      v_doit := new.regularisations_piste is distinct from old.regularisations_piste
             or round(new.ecart_piste, 2) is distinct from round(old.ecart_piste, 2)
             or (new.valide_le_piste is not null and new.valide_le_piste is distinct from old.valide_le_piste);
    else
      v_doit := new.regularisations_boutique is distinct from old.regularisations_boutique
             or round(new.ecart_boutique, 2) is distinct from round(old.ecart_boutique, 2)
             or (new.valide_le_boutique is not null and new.valide_le_boutique is distinct from old.valide_le_boutique);
    end if;
    if v_doit then
      v_net := public._regul_tiroir_net(new.site, 'tiroir_verify_' || v_caisse, new.date, new.quart);
      if round(coalesce(v_envoye, 0), 2) <> round(v_net, 2) then
        raise exception '[REGULARISATIONS_PERIMEES] Caisse %, quart % du % : les régularisations du tiroir valent % € et non % €. Recalculez l''écart avant d''enregistrer ou de valider.',
          v_caisse, new.quart, to_char(new.date, 'DD/MM/YYYY'),
          to_char(v_net, 'FM999999990.00'), to_char(coalesce(v_envoye, 0), 'FM999999990.00')
          using errcode = 'check_violation';
      end if;
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_audits_caisse_regularisations
  before insert or update on public.audits_caisse
  for each row execute function public.audits_caisse_regularisations_controle();

-- --------------------------------------------------------------------------
-- FDJ : l'attendu inclut le net du tiroir FDJ du quart.
-- --------------------------------------------------------------------------
create or replace function public.fdj_calculer_caisse(
  p_shift_id       uuid,
  p_caisse_reelle  numeric,
  p_regularisations numeric default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ventes    numeric;
  v_lots      numeric;
  v_tirages   numeric;
  v_grattage  numeric;
  v_attendue  numeric;
  v_ecart     numeric;
  v_regul     numeric := coalesce(p_regularisations, 0);
  v_versements numeric := 0;
  v_shift     public.fdj_shifts;
begin
  select coalesce(sum(public.fdj_ventes_jeu(c.stock_initial, c.appro, c.stock_final, g.prix)), 0)
    into v_ventes
    from public.fdj_shift_counts c
    join public.fdj_games g on g.id = c.game_id
   where c.shift_id = p_shift_id;

  select max(r.lots_payes_grattage) filter (where r.type_rapport = 'journalier'),
         max(r.caisse_tirages)      filter (where r.type_rapport = 'temps_reel')
    into v_lots, v_tirages
    from public.fdj_reports r
   where r.shift_id = p_shift_id;

  -- B8 : versements reçus moins restitutions et transferts sortis du tiroir FDJ.
  select * into v_shift from public.fdj_shifts s where s.id = p_shift_id;
  if found then
    v_versements := public._regul_tiroir_net(v_shift.site, 'tiroir_fdj', v_shift.date, v_shift.quart);
  end if;

  v_grattage := case when v_lots is null then null else v_ventes - v_lots end;

  v_attendue := case
                  when v_grattage is null or v_tirages is null then null
                  else v_grattage + v_tirages + v_regul + v_versements
                end;

  v_ecart := case
               when v_attendue is null or p_caisse_reelle is null then null
               else round((p_caisse_reelle - v_attendue)::numeric, 2)
             end;

  return jsonb_build_object(
    'ventes_grattage_valeur',    v_ventes,
    'lots_payes_grattage',       v_lots,
    'caisse_tirages',            v_tirages,
    'caisse_grattage',           v_grattage,
    'regularisations',           v_regul,
    'versements_regularisation', v_versements,
    'caisse_attendue',           v_attendue,
    'caisse_reelle',             p_caisse_reelle,
    'ecart',                     v_ecart
  );
end;
$$;

comment on function public.fdj_calculer_caisse(uuid, numeric, numeric) is
  'Établit la caisse d''un quart côté serveur (portage de nexus-fdj-moteur.js), versements de régularisation du tiroir FDJ inclus (B8). Le navigateur ne fournit jamais l''écart.';

create or replace function public.fdj_cash_controls_regularisations_controle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_net   numeric;
begin
  select * into v_shift from public.fdj_shifts s where s.id = new.shift_id;
  v_net := case when v_shift.id is null then 0
                else public._regul_tiroir_net(v_shift.site, 'tiroir_fdj', v_shift.date, v_shift.quart) end;

  if tg_op = 'INSERT' then
    new.versements_regularisation := v_net;
    return new;
  end if;

  if old.valide_le is null and new.valide_le is not null then
    if round(v_net, 2) <> round(old.versements_regularisation, 2) then
      raise exception '[REGULARISATIONS_PERIMEES] Caisse FDJ, quart % du % : les versements de régularisation du tiroir valent % € et non % €. Recalculez la caisse (correction manager) avant de valider.',
        v_shift.quart, to_char(v_shift.date, 'DD/MM/YYYY'),
        to_char(v_net, 'FM999999990.00'), to_char(old.versements_regularisation, 'FM999999990.00')
        using errcode = 'check_violation';
    end if;
    new.versements_regularisation := old.versements_regularisation;
  elsif new.caisse_attendue is distinct from old.caisse_attendue
     or new.ecart is distinct from old.ecart
     or new.caisse_reelle is distinct from old.caisse_reelle
     or new.regularisations is distinct from old.regularisations
     or new.version is distinct from old.version
     or new.confirme_le is distinct from old.confirme_le then
    -- Le calcul vient d'être réécrit dans cette transaction par
    -- fdj_calculer_caisse : il a lu ce même net.
    new.versements_regularisation := v_net;
  else
    new.versements_regularisation := old.versements_regularisation;
  end if;
  return new;
end;
$$;

create trigger trg_fdj_cash_controls_regularisations
  before insert or update on public.fdj_cash_controls
  for each row execute function public.fdj_cash_controls_regularisations_controle();

do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public._regul_tiroir_detail(text, text, date, text)',
    'public._regul_tiroir_net(text, text, date, text)',
    'public.audits_caisse_regularisations_controle()',
    'public.fdj_cash_controls_regularisations_controle()',
    'public.fdj_calculer_caisse(uuid, numeric, numeric)',
    'public.regularisations_tiroirs(text, date, text)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('revoke all on function %s from authenticated', v_sig);
  end loop;
  grant execute on function public.regularisations_tiroirs(text, date, text) to authenticated, service_role;
end;
$$;
