-- ============================================================================
-- Régularisation différée — un versement, plusieurs écarts (VERIFY / FDJ)
-- 20261013140000 — additive. Demande 3 du 13/10/2026, phase 3 (branche d'essai).
--
-- Un versement de régularisation pouvait viser un seul écart. Cette migration
-- ajoute le GROUPE : l'argent réellement reçu (un montant, un tiroir, un mode)
-- affecté, sur confirmation du manager, à un ou plusieurs anciens écarts du
-- même salarié et du même domaine (Verify ou FDJ). Les affectations restent des
-- lignes de ecarts_versements_regularisation (donc le solde d'un écart, ses
-- statuts, mes_regularisations() et l'état ne changent pas) ; seul l'ARGENT
-- vit dans le groupe : le tiroir récepteur compte le montant du groupe, une
-- seule fois, jamais la somme des affectations.
--
-- Surplus = montant du groupe − affectations actives. Il n'est ni une vente ni
-- une restitution : il reste suivi à part, visible, jusqu'à imputation à de
-- nouveaux écarts (affecter_surplus_groupe). Sa restitution n'est PAS dans ce
-- lot (décision à prendre : source du décaissement).
--
-- Aucune affectation automatique : la RPC exige la liste choisie, et un surplus
-- exige p_surplus_confirme = true. Aucun calcul de paie n'est touché.
--
-- Retour arrière (non appliqué ici) : (1) retirer les RPC de §5 à §8 ;
-- (2) recréer _regul_tiroir_detail depuis 20261008160000 ; (3) supprimer les
-- triggers de §3 ; (4) drop column groupe_id sur les deux tables ;
-- (5) drop table versements_regularisation_groupes — seulement si vide ou
-- après sauvegarde et accord distinct (les lignes sont immuables).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Table des groupes
-- ----------------------------------------------------------------------------
create table public.versements_regularisation_groupes (
  id                uuid primary key default gen_random_uuid(),
  site              text not null references public.sites(site_id),
  employee_id       uuid not null references public.employees(id),
  domaine           text not null check (domaine in ('verify', 'fdj')),
  montant           numeric(12,2) not null check (montant > 0),
  mode_encaissement text not null check (mode_encaissement in ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre')),
  justificatif      text,
  destination       text not null check (destination in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj', 'coffre')),
  recepteur_date    date,
  recepteur_quart   text check (recepteur_quart in ('1', '2')),
  encaisse_le       timestamptz not null default now(),
  auteur_id         uuid not null references public.employees(id),
  created_at        timestamptz not null default now(),
  idempotency_key   uuid not null unique,
  annule_le         timestamptz,
  annule_par        uuid references public.employees(id),
  motif_annulation  text,
  constraint vrg_autre_justifie check (mode_encaissement <> 'autre' or length(btrim(coalesce(justificatif, ''))) >= 5),
  constraint vrg_recepteur check (
       (destination = 'coffre' and recepteur_date is null and recepteur_quart is null)
    or (destination <> 'coffre' and recepteur_date is not null and recepteur_quart is not null)),
  constraint vrg_annulation_complete check (
       (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) >= 5))
);
comment on table public.versements_regularisation_groupes is
  'Argent reçu pour régulariser un ou plusieurs anciens écarts d''un même salarié et domaine. Ajout seul ; annulation par contre-écriture. Écriture par RPC uniquement (20261013140000).';

create index vrg_recept_idx  on public.versements_regularisation_groupes (site, destination, recepteur_date, recepteur_quart);
create index vrg_employe_idx on public.versements_regularisation_groupes (employee_id, encaisse_le);

alter table public.ecarts_versements_regularisation
  add column groupe_id uuid references public.versements_regularisation_groupes(id);
comment on column public.ecarts_versements_regularisation.groupe_id is
  'Groupe dont cette ligne est une affectation (20261013140000). Nul : versement à un seul écart, historique. Une affectation n''est pas de l''argent : le tiroir compte le groupe.';
create index evr_groupe_idx on public.ecarts_versements_regularisation (groupe_id) where groupe_id is not null;

alter table public.caisse_transferts_coffre
  add column groupe_id uuid references public.versements_regularisation_groupes(id),
  add constraint ctc_versement_ou_groupe check (versement_id is null or groupe_id is null);
create index ctc_groupe_idx on public.caisse_transferts_coffre (groupe_id) where groupe_id is not null;

create trigger vrg_immuable before update or delete on public.versements_regularisation_groupes
  for each row execute function public._ecarts_regul_immuable();
create trigger vrg_immuable_truncate before truncate on public.versements_regularisation_groupes
  for each statement execute function public._ecarts_regul_immuable();

-- ----------------------------------------------------------------------------
-- 2. RLS et droits de la table
-- ----------------------------------------------------------------------------
alter table public.versements_regularisation_groupes enable row level security;
create policy lecture_manager_meme_site on public.versements_regularisation_groupes
  for select to authenticated
  using (site = (select public.current_employee_site_id())
         and (select public.current_employee_role()) in ('manager', 'gerant'));
revoke all on public.versements_regularisation_groupes from public, anon, authenticated;
grant select on public.versements_regularisation_groupes to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Gardes de la base (ceinture : valent même hors des RPC)
-- ----------------------------------------------------------------------------
create or replace function public._evr_groupe_controle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.versements_regularisation_groupes;
  v_deja numeric;
begin
  if new.groupe_id is null then
    return new;
  end if;
  select * into g from public.versements_regularisation_groupes where id = new.groupe_id for update;
  if not found then
    raise exception 'Groupe de versement introuvable.' using errcode = 'no_data_found';
  end if;
  if g.annule_le is not null then
    raise exception '[DEJA_ANNULE] Ce groupe de versement est annulé.' using errcode = 'check_violation';
  end if;
  if g.domaine <> new.module_origine or g.employee_id <> new.employee_id or g.site <> new.site then
    raise exception '[DOMAINE_INCOHERENT] Une affectation doit viser le même salarié, le même site et le même domaine que le versement.'
      using errcode = 'check_violation';
  end if;
  if g.destination <> new.destination
     or g.recepteur_date is distinct from new.recepteur_date
     or g.recepteur_quart is distinct from new.recepteur_quart
     or g.mode_encaissement <> new.mode_encaissement then
    raise exception '[DOMAINE_INCOHERENT] Une affectation reprend le mode, le tiroir et le quart du versement.'
      using errcode = 'check_violation';
  end if;
  select coalesce(sum(v.montant), 0) into v_deja
    from public.ecarts_versements_regularisation v
   where v.groupe_id = g.id and v.annule_le is null;
  if v_deja + new.montant > g.montant then
    raise exception '[AFFECTATION_SUPERIEURE_AU_VERSEMENT] Les affectations (%) dépasseraient le versement reçu (%).',
      v_deja + new.montant, g.montant using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger evr_groupe_controle before insert on public.ecarts_versements_regularisation
  for each row execute function public._evr_groupe_controle();

-- Une affectation ne s'annule pas seule : on annule le groupe.
create or replace function public._evr_groupe_annulation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.groupe_id is not null and old.annule_le is null and new.annule_le is not null
     and coalesce(current_setting('nexus.annulation_groupe', true), '') <> 'on' then
    raise exception '[GROUPE_ACTIF] Cette ligne est une affectation d''un versement groupé : annuler le groupe.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger evr_a_groupe_annulation before update on public.ecarts_versements_regularisation
  for each row execute function public._evr_groupe_annulation();

-- Un transfert vers le coffre ne se rattache pas à une affectation.
create or replace function public._ctc_groupe_controle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.versement_id is not null and exists (
       select 1 from public.ecarts_versements_regularisation v
        where v.id = new.versement_id and v.groupe_id is not null) then
    raise exception '[GROUPE_ACTIF] Ce versement est une affectation d''un groupe : transférer depuis le groupe.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger ctc_groupe_controle before insert on public.caisse_transferts_coffre
  for each row execute function public._ctc_groupe_controle();

-- ----------------------------------------------------------------------------
-- 4. Le tiroir compte le groupe (une fois), pas ses affectations
-- ----------------------------------------------------------------------------
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
       and v.annule_le is null and v.groupe_id is null
    union all
    select g.mode_encaissement, g.montant, 0
      from public.versements_regularisation_groupes g
     where g.site = p_site and g.destination = p_tiroir
       and g.recepteur_date = p_date and g.recepteur_quart = p_quart
       and g.annule_le is null
    union all
    select r.mode_restitution, 0, r.montant
      from public.ecarts_restitutions_trop_percu r
     where r.site = p_site and r.source = p_tiroir
       and r.source_date = p_date and r.source_quart = p_quart
       and r.annule_le is null
    union all
    select coalesce(v.mode_encaissement, g.mode_encaissement, 'sans_mode'), 0, t.montant
      from public.caisse_transferts_coffre t
      left join public.ecarts_versements_regularisation v on v.id = t.versement_id
      left join public.versements_regularisation_groupes g on g.id = t.groupe_id
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

-- ----------------------------------------------------------------------------
-- 5. Validation et insertion des affectations (aides internes)
-- ----------------------------------------------------------------------------
-- Valide chaque affectation (origine verrouillée dans un ordre déterministe,
-- donc sans interblocage) et rend la liste enrichie. N'écrit rien.
create or replace function public._groupe_valider_affectations(
  p_site text, p_employee_id uuid, p_domaine text, p_affectations jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  a      record;
  o      record;
  s      record;
  v_rows jsonb := '[]'::jsonb;
  v_cles text[] := '{}';
  v_cle  text;
begin
  if p_affectations is null or jsonb_typeof(p_affectations) <> 'array' or jsonb_array_length(p_affectations) = 0 then
    raise exception '[AFFECTATION_REQUISE] Désignez au moins un écart à régulariser.'
      using errcode = 'check_violation';
  end if;
  for a in
    select (e->>'audit_id')::uuid as audit_id, e->>'caisse' as caisse,
           (e->>'fdj_cash_control_id')::uuid as fdj, (e->>'montant')::numeric as montant
      from jsonb_array_elements(p_affectations) e
     order by coalesce(e->>'audit_id', ''), coalesce(e->>'caisse', ''), coalesce(e->>'fdj_cash_control_id', '')
  loop
    if a.montant is null or a.montant <= 0 or a.montant <> round(a.montant, 2) then
      raise exception 'Montant d''affectation invalide : un nombre positif, au centime.'
        using errcode = 'invalid_parameter_value';
    end if;
    v_cle := coalesce(a.audit_id::text, '') || '|' || coalesce(a.caisse, '') || '|' || coalesce(a.fdj::text, '');
    if v_cle = any(v_cles) then
      raise exception '[AFFECTATION_DOUBLON] Un même écart ne peut figurer qu''une fois dans le versement.'
        using errcode = 'check_violation';
    end if;
    v_cles := v_cles || v_cle;

    select * into o from public._ecarts_regul_origine(a.audit_id, a.caisse, a.fdj, true);
    if o.site is distinct from p_site then
      raise exception '[DOMAINE_INCOHERENT] Cet écart appartient à un autre site.' using errcode = 'check_violation';
    end if;
    if o.module_origine <> p_domaine then
      raise exception '[DOMAINE_INCOHERENT] Un versement Verify ne régularise pas un écart FDJ, et inversement.'
        using errcode = 'check_violation';
    end if;
    if o.nb_responsables <> 1 or o.employee_id is null then
      raise exception '[ECART_SANS_RESPONSABLE] Cet écart n''a pas de responsable unique.' using errcode = 'check_violation';
    end if;
    if o.employee_id <> p_employee_id then
      raise exception '[DOMAINE_INCOHERENT] Cet écart n''est pas celui du salarié qui verse.' using errcode = 'check_violation';
    end if;
    if not o.cloture then
      raise exception '[ECART_NON_CLOTURE] Cet écart n''est pas encore validé.' using errcode = 'check_violation';
    end if;
    select * into s from public._ecarts_regul_situation(a.audit_id, a.caisse, a.fdj, o.ecart_effectif);
    if s.deficit = 0 then
      raise exception '[ECART_SANS_DEFICIT] Cet écart n''est pas un manque : rien à régulariser.' using errcode = 'check_violation';
    end if;
    if s.reste_du = 0 then
      raise exception '[ECART_SOLDE] Cet écart est déjà soldé : rien ne reste dû.' using errcode = 'check_violation';
    end if;
    if a.montant > s.reste_du then
      raise exception '[PLAFOND_DEPASSE] L''affectation (%) dépasse le reste dû (%).', a.montant, s.reste_du
        using errcode = 'check_violation';
    end if;

    v_rows := v_rows || jsonb_build_object(
      'audit_id', a.audit_id, 'caisse', a.caisse, 'fdj_cash_control_id', a.fdj, 'montant', a.montant,
      'module_origine', o.module_origine, 'date_ecart', o.date_ecart, 'quart_ecart', o.quart_ecart);
  end loop;
  return v_rows;
end;
$$;

-- Insère les affectations validées d'un groupe. Les clés d'idempotence des
-- lignes sont dérivées de la clé de l'opération : un rejeu retombe dessus.
create or replace function public._groupe_inserer_affectations(
  p_groupe_id uuid, p_rows jsonb, p_cle uuid, p_correction text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  g public.versements_regularisation_groupes;
  r record;
  n integer := 0;
begin
  select * into g from public.versements_regularisation_groupes where id = p_groupe_id;
  for r in select e.value as j, e.ordinality as k from jsonb_array_elements(p_rows) with ordinality e loop
    insert into public.ecarts_versements_regularisation (
      site, employee_id, module_origine, audit_id, caisse_origine, fdj_cash_control_id,
      date_ecart, quart_ecart, montant, mode_encaissement, justificatif, destination,
      recepteur_date, recepteur_quart, auteur_id, idempotency_key, correction_datation, groupe_id)
    values (
      g.site, g.employee_id, g.domaine, (r.j->>'audit_id')::uuid, r.j->>'caisse', (r.j->>'fdj_cash_control_id')::uuid,
      (r.j->>'date_ecart')::date, r.j->>'quart_ecart', (r.j->>'montant')::numeric,
      g.mode_encaissement, g.justificatif, g.destination, g.recepteur_date, g.recepteur_quart,
      g.auteur_id, md5(p_cle::text || ':' || r.k::text)::uuid,
      case when g.destination <> 'coffre'
            and (g.recepteur_date, g.recepteur_quart) < ((r.j->>'date_ecart')::date, r.j->>'quart_ecart')
           then btrim(p_correction) end,
      g.id);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Enregistrer un versement groupé
-- ----------------------------------------------------------------------------
create function public.enregistrer_versement_groupe(
  p_employee_id         uuid,
  p_domaine             text,
  p_montant             numeric,
  p_mode                text,
  p_justificatif        text,
  p_destination         text,
  p_recepteur_date      date,
  p_recepteur_quart     text,
  p_affectations        jsonb,
  p_surplus_confirme    boolean,
  p_idempotency_key     uuid,
  p_correction_datation text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid;
  v_site   text;
  v_exist  public.versements_regularisation_groupes;
  v_rows   jsonb;
  v_somme  numeric;
  v_max_d  date;
  v_max_q  text;
  v_jour   date;
  v_id     uuid;
begin
  if p_idempotency_key is null then
    raise exception 'Clé d''idempotence manquante.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('evr:' || p_idempotency_key::text, 0));
  select * into v_exist from public.versements_regularisation_groupes where idempotency_key = p_idempotency_key;
  if found then
    if v_exist.auteur_id is distinct from (select auth.uid())
       or v_exist.employee_id is distinct from p_employee_id
       or v_exist.domaine is distinct from p_domaine
       or v_exist.montant is distinct from p_montant then
      raise exception '[IDEMPOTENCE_CONFLIT] Cette clé désigne déjà une autre opération.'
        using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('ok', true, 'rejoue', true, 'groupe_id', v_exist.id);
  end if;

  if p_montant is null or p_montant <= 0 or p_montant <> round(p_montant, 2) then
    raise exception 'Montant invalide : un nombre positif, au centime.' using errcode = 'invalid_parameter_value';
  end if;
  if p_domaine is null or p_domaine not in ('verify', 'fdj') then
    raise exception 'Domaine inconnu : %', coalesce(p_domaine, '(vide)') using errcode = 'invalid_parameter_value';
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
  if p_employee_id is null then
    raise exception 'Salarié du versement manquant.' using errcode = 'invalid_parameter_value';
  end if;

  select e.site_id into v_site from public.employees e where e.id = (select auth.uid());
  v_uid := public._ecarts_regul_manager(v_site);

  v_rows := public._groupe_valider_affectations(v_site, p_employee_id, p_domaine, p_affectations);
  select coalesce(sum((x->>'montant')::numeric), 0) into v_somme from jsonb_array_elements(v_rows) x;
  if v_somme > p_montant then
    raise exception '[AFFECTATION_SUPERIEURE_AU_VERSEMENT] Les affectations (%) dépassent le versement reçu (%).', v_somme, p_montant
      using errcode = 'check_violation';
  end if;
  if v_somme < p_montant and coalesce(p_surplus_confirme, false) is not true then
    raise exception '[SURPLUS_NON_CONFIRME] % € ne sont affectés à aucun écart : confirmez que ce surplus est suivi à part.',
      p_montant - v_somme using errcode = 'check_violation';
  end if;

  if p_destination <> 'coffre' then
    select (now() at time zone s.timezone)::date into v_jour from public.sites s where s.site_id = v_site;
    if p_recepteur_date > v_jour then
      raise exception '[QUART_RECEPTEUR_FUTUR] Le quart récepteur est postérieur au jour de la station.'
        using errcode = 'check_violation';
    end if;
    select (x->>'date_ecart')::date, x->>'quart_ecart' into v_max_d, v_max_q
      from jsonb_array_elements(v_rows) x
     order by (x->>'date_ecart')::date desc, x->>'quart_ecart' desc limit 1;
    if (p_recepteur_date, p_recepteur_quart) < (v_max_d, v_max_q)
       and length(btrim(coalesce(p_correction_datation, ''))) < 5 then
      raise exception '[QUART_RECEPTEUR_ANTERIEUR] Le quart récepteur précède un écart régularisé ; seule une correction de datation documentée (5 caractères au moins) le permet.'
        using errcode = 'check_violation';
    end if;
    if public._ecarts_regul_tiroir_clos(v_site, p_destination, p_recepteur_date, p_recepteur_quart) then
      raise exception '[QUART_RECEPTEUR_CLOTURE] Ce tiroir appartient à un quart déjà validé.'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.versements_regularisation_groupes (
    site, employee_id, domaine, montant, mode_encaissement, justificatif, destination,
    recepteur_date, recepteur_quart, auteur_id, idempotency_key)
  values (
    v_site, p_employee_id, p_domaine, p_montant, p_mode, nullif(btrim(coalesce(p_justificatif, '')), ''), p_destination,
    case when p_destination <> 'coffre' then p_recepteur_date end,
    case when p_destination <> 'coffre' then p_recepteur_quart end,
    v_uid, p_idempotency_key)
  returning id into v_id;

  perform public._groupe_inserer_affectations(v_id, v_rows, p_idempotency_key, p_correction_datation);

  return jsonb_build_object('ok', true, 'rejoue', false, 'groupe_id', v_id,
    'montant', p_montant, 'affecte', v_somme, 'surplus', p_montant - v_somme,
    'affectations', jsonb_array_length(v_rows));
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Affecter le surplus d'un groupe à de nouveaux écarts, annuler un groupe
-- ----------------------------------------------------------------------------
create function public.affecter_surplus_groupe(
  p_groupe_id uuid, p_affectations jsonb, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g       public.versements_regularisation_groupes;
  v_rows  jsonb;
  v_somme numeric;
  v_deja  numeric;
begin
  if p_idempotency_key is null then
    raise exception 'Clé d''idempotence manquante.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('evr:' || p_idempotency_key::text, 0));
  if exists (select 1 from public.ecarts_versements_regularisation v
              where v.idempotency_key = md5(p_idempotency_key::text || ':1')::uuid) then
    if not exists (select 1 from public.ecarts_versements_regularisation v
                    where v.idempotency_key = md5(p_idempotency_key::text || ':1')::uuid
                      and v.groupe_id = p_groupe_id and v.auteur_id = (select auth.uid())) then
      raise exception '[IDEMPOTENCE_CONFLIT] Cette clé désigne déjà une autre opération.'
        using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('ok', true, 'rejoue', true, 'groupe_id', p_groupe_id);
  end if;

  select * into g from public.versements_regularisation_groupes where id = p_groupe_id for update;
  if not found then
    raise exception 'Versement introuvable.' using errcode = 'no_data_found';
  end if;
  perform public._ecarts_regul_manager(g.site);
  if g.annule_le is not null then
    raise exception '[DEJA_ANNULE] Ce versement est annulé.' using errcode = 'check_violation';
  end if;

  v_rows := public._groupe_valider_affectations(g.site, g.employee_id, g.domaine, p_affectations);
  select coalesce(sum((x->>'montant')::numeric), 0) into v_somme from jsonb_array_elements(v_rows) x;
  select coalesce(sum(v.montant), 0) into v_deja
    from public.ecarts_versements_regularisation v where v.groupe_id = g.id and v.annule_le is null;
  if v_deja + v_somme > g.montant then
    raise exception '[AFFECTATION_SUPERIEURE_AU_VERSEMENT] Il ne reste que % € de surplus à affecter.', g.montant - v_deja
      using errcode = 'check_violation';
  end if;
  -- Le quart récepteur a déjà reçu l'argent : l'imputation ne le touche pas.
  perform public._groupe_inserer_affectations(g.id, v_rows, p_idempotency_key, null);
  return jsonb_build_object('ok', true, 'rejoue', false, 'groupe_id', g.id,
    'affecte', v_deja + v_somme, 'surplus', g.montant - v_deja - v_somme);
end;
$$;

create function public.annuler_versement_groupe(p_groupe_id uuid, p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g     public.versements_regularisation_groupes;
  v     public.ecarts_versements_regularisation;
  o     record;
  s     record;
  v_uid uuid;
begin
  if length(btrim(coalesce(p_motif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Un motif d''annulation d''au moins 5 caractères est obligatoire.'
      using errcode = 'check_violation';
  end if;
  select * into g from public.versements_regularisation_groupes where id = p_groupe_id for update;
  if not found then
    raise exception 'Versement introuvable.' using errcode = 'no_data_found';
  end if;
  v_uid := public._ecarts_regul_manager(g.site);
  if g.annule_le is not null then
    raise exception '[DEJA_ANNULE] Ce versement est déjà annulé.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.caisse_transferts_coffre t where t.groupe_id = g.id and t.annule_le is null) then
    raise exception '[TRANSFERT_ACTIF] Un transfert vers le coffre porte ce versement : l''annuler d''abord.'
      using errcode = 'check_violation';
  end if;
  if g.destination <> 'coffre'
     and public._ecarts_regul_tiroir_clos(g.site, g.destination, g.recepteur_date, g.recepteur_quart) then
    raise exception '[QUART_RECEPTEUR_CLOTURE] Le quart qui a reçu ce versement est validé : son attendu ne se réécrit plus.'
      using errcode = 'check_violation';
  end if;

  for v in select * from public.ecarts_versements_regularisation x
            where x.groupe_id = g.id and x.annule_le is null
            order by x.id loop
    select * into o from public._ecarts_regul_origine(v.audit_id, v.caisse_origine, v.fdj_cash_control_id, true);
    select * into s from public._ecarts_regul_situation(v.audit_id, v.caisse_origine, v.fdj_cash_control_id, o.ecart_effectif);
    if s.restitutions > s.versements - v.montant then
      raise exception '[RESTITUTION_ACTIVE] Une restitution active dépasserait les versements restants : l''annuler d''abord.'
        using errcode = 'check_violation';
    end if;
  end loop;

  perform set_config('nexus.annulation_groupe', 'on', true);
  update public.ecarts_versements_regularisation
     set annule_le = now(), annule_par = v_uid, motif_annulation = btrim(p_motif)
   where groupe_id = g.id and annule_le is null;
  perform set_config('nexus.annulation_groupe', 'off', true);
  update public.versements_regularisation_groupes
     set annule_le = now(), annule_par = v_uid, motif_annulation = btrim(p_motif)
   where id = g.id;

  return jsonb_build_object('ok', true, 'groupe_id', g.id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Transfert vers le coffre depuis un groupe, lectures
-- ----------------------------------------------------------------------------
create function public.enregistrer_transfert_coffre_groupe(
  p_groupe_id uuid, p_montant numeric, p_motif text, p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g       public.versements_regularisation_groupes;
  v_uid   uuid;
  v_exist public.caisse_transferts_coffre;
  v_deja  numeric;
  v_id    uuid;
begin
  if p_idempotency_key is null then
    raise exception 'Clé d''idempotence manquante.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ctc:' || p_idempotency_key::text, 0));
  select * into v_exist from public.caisse_transferts_coffre where idempotency_key = p_idempotency_key;
  if found then
    if v_exist.auteur_id is distinct from (select auth.uid())
       or v_exist.groupe_id is distinct from p_groupe_id
       or v_exist.montant is distinct from p_montant then
      raise exception '[IDEMPOTENCE_CONFLIT] Cette clé désigne déjà une autre opération.'
        using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('ok', true, 'rejoue', true, 'transfert_id', v_exist.id);
  end if;
  if p_montant is null or p_montant <= 0 or p_montant <> round(p_montant, 2) then
    raise exception 'Montant invalide : un nombre positif, au centime.' using errcode = 'invalid_parameter_value';
  end if;
  if length(btrim(coalesce(p_motif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Un transfert exige un motif d''au moins 5 caractères.'
      using errcode = 'check_violation';
  end if;
  select * into g from public.versements_regularisation_groupes where id = p_groupe_id for update;
  if not found then
    raise exception 'Versement introuvable.' using errcode = 'no_data_found';
  end if;
  v_uid := public._ecarts_regul_manager(g.site);
  if g.annule_le is not null then
    raise exception '[DEJA_ANNULE] Ce versement est annulé : rien à transférer.' using errcode = 'check_violation';
  end if;
  if g.destination = 'coffre' then
    raise exception 'Ce versement est déjà au coffre.' using errcode = 'invalid_parameter_value';
  end if;
  select coalesce(sum(t.montant), 0) into v_deja
    from public.caisse_transferts_coffre t where t.groupe_id = g.id and t.annule_le is null;
  if v_deja + p_montant > g.montant then
    raise exception '[PLAFOND_DEPASSE] Le transfert (%) dépasse ce qui reste du versement dans le tiroir (%).', p_montant, g.montant - v_deja
      using errcode = 'check_violation';
  end if;
  if public._ecarts_regul_tiroir_clos(g.site, g.destination, g.recepteur_date, g.recepteur_quart) then
    raise exception '[QUART_RECEPTEUR_CLOTURE] Ce tiroir appartient à un quart déjà validé.'
      using errcode = 'check_violation';
  end if;
  insert into public.caisse_transferts_coffre (
    site, source, source_date, source_quart, montant, groupe_id, motif, auteur_id, idempotency_key)
  values (g.site, g.destination, g.recepteur_date, g.recepteur_quart, p_montant, g.id, btrim(p_motif), v_uid, p_idempotency_key)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'rejoue', false, 'transfert_id', v_id);
end;
$$;

-- Écarts encore dus d'un salarié, du plus ancien au plus récent.
create function public.ecarts_ouverts_employe(p_employee_id uuid, p_domaine text)
returns table (
  module_origine text, audit_id uuid, caisse_origine text, fdj_cash_control_id uuid,
  date_ecart date, quart_ecart text, ecart_initial numeric, corrections numeric,
  ecart_effectif numeric, versements_affectes numeric, solde numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_site text;
  k      record;
  o      record;
  s      record;
  v_brut numeric;
begin
  if p_domaine is null or p_domaine not in ('verify', 'fdj') then
    raise exception 'Domaine inconnu : %', coalesce(p_domaine, '(vide)') using errcode = 'invalid_parameter_value';
  end if;
  select e.site_id into v_site from public.employees e where e.id = (select auth.uid());
  perform public._ecarts_regul_manager(v_site);

  for k in
    select a.id as audit_id, c.caisse, null::uuid as fdj_id, a.date as d, a.quart as q,
           case c.caisse when 'piste' then a.ecart_piste else a.ecart_boutique end as brut
      from public.audits_caisse a
      cross join (values ('piste'), ('boutique')) as c(caisse)
     where p_domaine = 'verify' and a.site = v_site
       and ((c.caisse = 'piste' and a.employes_piste @> to_jsonb(p_employee_id::text))
         or (c.caisse = 'boutique' and a.employes_boutique @> to_jsonb(p_employee_id::text)))
    union all
    select null::uuid, null, cc.id, s2.date, s2.quart, cc.ecart
      from public.fdj_cash_controls cc
      join public.fdj_shifts s2 on s2.id = cc.shift_id
     where p_domaine = 'fdj' and cc.site = v_site and s2.employee_id = p_employee_id
    order by d, q
  loop
    select * into o from public._ecarts_regul_origine(k.audit_id, k.caisse, k.fdj_id, false);
    continue when o.nb_responsables <> 1 or o.employee_id is distinct from p_employee_id or not o.cloture;
    select * into s from public._ecarts_regul_situation(k.audit_id, k.caisse, k.fdj_id, o.ecart_effectif);
    continue when s.deficit = 0 or s.reste_du = 0;
    v_brut := coalesce(k.brut, 0);
    module_origine := o.module_origine; audit_id := k.audit_id; caisse_origine := k.caisse;
    fdj_cash_control_id := k.fdj_id; date_ecart := o.date_ecart; quart_ecart := o.quart_ecart;
    ecart_initial := v_brut; ecart_effectif := o.ecart_effectif;
    corrections := coalesce(o.ecart_effectif, 0) - v_brut;
    versements_affectes := s.versements - s.restitutions;
    solde := s.reste_du;
    return next;
  end loop;
end;
$$;

-- Groupes d'un site (ou d'un salarié) avec leur surplus calculé.
create function public.versements_groupes(p_site text, p_employee_id uuid default null)
returns table (
  id uuid, employee_id uuid, domaine text, montant numeric, mode_encaissement text,
  destination text, recepteur_date date, recepteur_quart text, encaisse_le timestamptz,
  auteur_id uuid, annule_le timestamptz, motif_annulation text,
  affecte numeric, surplus numeric, nb_affectations integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public._ecarts_regul_manager(p_site);
  return query
    select g.id, g.employee_id, g.domaine, g.montant, g.mode_encaissement,
           g.destination, g.recepteur_date, g.recepteur_quart, g.encaisse_le,
           g.auteur_id, g.annule_le, g.motif_annulation,
           coalesce(a.s, 0), case when g.annule_le is null then g.montant - coalesce(a.s, 0) else 0 end,
           coalesce(a.n, 0)::integer
      from public.versements_regularisation_groupes g
      left join lateral (
        select sum(v.montant) as s, count(*) as n
          from public.ecarts_versements_regularisation v
         where v.groupe_id = g.id and v.annule_le is null) a on true
     where g.site = p_site and (p_employee_id is null or g.employee_id = p_employee_id)
     order by g.encaisse_le desc;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Droits des fonctions
-- ----------------------------------------------------------------------------
do $$
declare
  v_sig text;
begin
  foreach v_sig in array array[
    'public._evr_groupe_controle()',
    'public._evr_groupe_annulation()',
    'public._ctc_groupe_controle()',
    'public._groupe_valider_affectations(text, uuid, text, jsonb)',
    'public._groupe_inserer_affectations(uuid, jsonb, uuid, text)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('revoke all on function %s from authenticated', v_sig);
  end loop;

  foreach v_sig in array array[
    'public.enregistrer_versement_groupe(uuid, text, numeric, text, text, text, date, text, jsonb, boolean, uuid, text)',
    'public.affecter_surplus_groupe(uuid, jsonb, uuid)',
    'public.annuler_versement_groupe(uuid, text)',
    'public.enregistrer_transfert_coffre_groupe(uuid, numeric, text, uuid)',
    'public.ecarts_ouverts_employe(uuid, text)',
    'public.versements_groupes(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;
