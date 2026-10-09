-- ============================================================================
-- NEXUS — Versements de régularisation, restitutions de trop-perçu et
-- transferts tiroir → coffre (08/10/2026)
-- ============================================================================
--
-- CONSTAT
--   Un salarié qui rapporte, plus tard, l'argent d'un manque de caisse n'a
--   aujourd'hui aucun endroit où ce versement soit enregistré. Les managers
--   « corrigent » alors l'écart validé de l'audit ou du contrôle FDJ d'origine,
--   ce qui efface le manque initial et fausse le quart qui reçoit l'argent
--   (faux excédent). Aucune table ne relie un argent reçu à l'écart qu'il
--   régularise ; aucun solde par écart n'existe.
--
-- ARBITRAGES DE FRÉDÉRIC (08/10, définitifs)
--   - vocabulaire : « versement de régularisation » (le mot « remboursement »
--     est déjà pris par le motif d'écart « remboursement client ») ;
--   - l'écart d'origine et sa validation ne sont JAMAIS modifiés ;
--   - versements, restitutions et transferts internes sont trois objets
--     distincts ; aucune double comptabilisation ;
--   - destination par défaut : le tiroir du quart récepteur, dont l'attendu
--     augmente du montant ; dépôt direct au coffre enregistré comme tel ;
--     tout transfert tiroir → coffre est tracé, sans nouvel encaissement ;
--   - trop-perçu : détecté et signalé ; restitution distincte, traçable,
--     justifiée et validée par un manager ; jamais automatique ;
--   - modes : espèces, carte bancaire, chèque, virement, autre (justification
--     obligatoire) ;
--   - aucune attribution financière quand l'écart n'a pas de responsable ;
--   - réservé aux managers et gérants du site.
--
-- CE QUE FAIT CETTE MIGRATION
--   1. Trois tables en ajout seul, chacune avec son annulation :
--        ecarts_versements_regularisation   (argent reçu du responsable)
--        ecarts_restitutions_trop_percu     (argent rendu au responsable)
--        caisse_transferts_coffre           (tiroir → coffre, interne)
--      Aucune suppression, aucune réécriture : la seule mise à jour admise est
--      le passage d'une ligne active à annulée (trigger), TRUNCATE compris.
--   2. Le solde d'un écart n'est stocké nulle part : il se calcule
--      (déficit effectif − versements actifs + restitutions actives).
--   3. Écriture exclusivement par RPC SECURITY DEFINER, gardées manager ou
--      gérant actif du site de l'écart, avec verrou de la ligne d'origine,
--      plafond et clé d'idempotence :
--        enregistrer_versement_regularisation / annuler_versement_regularisation
--        enregistrer_restitution_trop_percu   / annuler_restitution_trop_percu
--        enregistrer_transfert_coffre         / annuler_transfert_coffre
--      Lecture : ecart_regularisation_etat (un écart), ecarts_trop_percus (site).
--   4. RLS : lecture par les managers et gérants du site, aucune policy
--      d'écriture ; anon fermé ; authenticated en SELECT seul.
--
-- RÈGLES DE REFUS (le code figure en tête du message, entre crochets)
--   ECART_SANS_RESPONSABLE   Verify : la caisse n'a pas exactement un employé
--                            (employes_piste / employes_boutique) ; FDJ : le
--                            quart n'a pas de titulaire. Même règle que
--                            NexusEcartsMoteur.resoudreEmployeCaisseVerify.
--   ECART_NON_CLOTURE        l'écart n'est pas validé (Verify valide_le_*,
--                            FDJ resultat_controle) : comme dans le moteur
--                            d'écarts, seul un manque clôturé est retenu.
--   ECART_SANS_DEFICIT       l'écart effectif n'est pas négatif.
--   PLAFOND_DEPASSE          le versement dépasse le reste dû, ou la
--                            restitution dépasse le trop-perçu, ou le
--                            transfert dépasse le versement qu'il déplace.
--   QUART_RECEPTEUR_CLOTURE  le tiroir désigné appartient à un quart déjà
--                            validé : y ajouter (ou en retirer) de l'argent
--                            réécrirait un attendu clos.
--   QUART_RECEPTEUR_FUTUR / QUART_RECEPTEUR_ANTERIEUR  date de quart
--                            postérieure au jour de la station, ou antérieure
--                            à l'écart régularisé.
--   JUSTIFICATION_REQUISE    mode « autre », restitution, transfert,
--                            annulation : au moins 5 caractères.
--   IDEMPOTENCE_CONFLIT      clé déjà utilisée pour une autre opération.
--   DEJA_ANNULE, RESTITUTION_ACTIVE, TRANSFERT_ACTIF  annulation impossible
--                            tant qu'une opération dépendante reste active.
--
-- CE QU'ELLE NE FAIT PAS
--   - elle ne touche à aucune ligne d'audits_caisse ni de fdj_cash_controls ;
--   - elle ne modifie pas encore le calcul de l'attendu des tiroirs : c'est
--     l'objet de P3 (interface Verify et FDJ), qui lira ces tables ;
--   - elle ne touche pas à Paye (P4) ; aucune retenue n'est créée ;
--   - elle n'ouvre rien à nexus_ci_recette.
--
-- ORDRE DE DÉPLOIEMENT
--   Indépendante du front : les tables restent vides tant que l'interface P3
--   n'est pas servie. Aucune donnée n'est reprise.
--
-- RETOUR ARRIÈRE (tant qu'aucune ligne n'a été écrite)
--   drop function public.enregistrer_versement_regularisation(uuid, text, uuid, numeric, text, text, text, date, text, uuid);
--   drop function public.annuler_versement_regularisation(uuid, text);
--   drop function public.enregistrer_restitution_trop_percu(uuid, text, uuid, numeric, text, text, text, date, text, uuid);
--   drop function public.annuler_restitution_trop_percu(uuid, text);
--   drop function public.enregistrer_transfert_coffre(text, date, text, numeric, uuid, text, uuid);
--   drop function public.annuler_transfert_coffre(uuid, text);
--   drop function public.ecart_regularisation_etat(uuid, text, uuid);
--   drop function public.ecarts_trop_percus(text);
--   drop table public.caisse_transferts_coffre, public.ecarts_restitutions_trop_percu,
--              public.ecarts_versements_regularisation;
--   drop function public._ecarts_regul_manager(text), public._ecarts_regul_origine(uuid, text, uuid, boolean),
--                 public._ecarts_regul_situation(uuid, text, uuid, numeric),
--                 public._ecarts_regul_tiroir_clos(text, text, date, text),
--                 public._ecarts_regul_immuable();
--   Dès qu'une ligne existe, ces tables sont des pièces comptables : on ne
--   les supprime plus, on annule les lignes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------
create table public.ecarts_versements_regularisation (
  id                  uuid primary key default gen_random_uuid(),
  site                text not null references public.sites(site_id),
  employee_id         uuid not null references public.employees(id),
  module_origine      text not null check (module_origine in ('verify', 'fdj')),
  audit_id            uuid references public.audits_caisse(id),
  caisse_origine      text check (caisse_origine in ('piste', 'boutique')),
  fdj_cash_control_id uuid references public.fdj_cash_controls(id),
  date_ecart          date not null,
  quart_ecart         text not null,
  montant             numeric(12,2) not null check (montant > 0),
  mode_encaissement   text not null check (mode_encaissement in ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre')),
  justificatif        text,
  destination         text not null check (destination in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj', 'coffre')),
  recepteur_date      date,
  recepteur_quart     text check (recepteur_quart in ('1', '2')),
  encaisse_le         timestamptz not null default now(),
  auteur_id           uuid not null references public.employees(id),
  created_at          timestamptz not null default now(),
  idempotency_key     uuid not null unique,
  annule_le           timestamptz,
  annule_par          uuid references public.employees(id),
  motif_annulation    text,
  constraint evr_origine_exactement_une check (
       (module_origine = 'verify' and audit_id is not null and caisse_origine is not null and fdj_cash_control_id is null)
    or (module_origine = 'fdj' and fdj_cash_control_id is not null and audit_id is null and caisse_origine is null)),
  constraint evr_autre_justifie check (mode_encaissement <> 'autre' or length(btrim(coalesce(justificatif, ''))) >= 5),
  constraint evr_recepteur check (
       (destination = 'coffre' and recepteur_date is null and recepteur_quart is null)
    or (destination <> 'coffre' and recepteur_date is not null and recepteur_quart is not null)),
  constraint evr_annulation_complete check (
       (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) >= 5))
);
comment on table public.ecarts_versements_regularisation is
  'Versements de régularisation : argent remis par le responsable d''un manque de caisse clôturé. Ajout seul ; l''écart d''origine n''est jamais modifié. Écriture par RPC uniquement (20261008120000).';

create index evr_audit_idx   on public.ecarts_versements_regularisation (audit_id, caisse_origine) where audit_id is not null;
create index evr_fdj_idx     on public.ecarts_versements_regularisation (fdj_cash_control_id) where fdj_cash_control_id is not null;
create index evr_recept_idx  on public.ecarts_versements_regularisation (site, destination, recepteur_date, recepteur_quart);
create index evr_employe_idx on public.ecarts_versements_regularisation (employee_id, encaisse_le);

create table public.ecarts_restitutions_trop_percu (
  id                  uuid primary key default gen_random_uuid(),
  site                text not null references public.sites(site_id),
  employee_id         uuid not null references public.employees(id),
  module_origine      text not null check (module_origine in ('verify', 'fdj')),
  audit_id            uuid references public.audits_caisse(id),
  caisse_origine      text check (caisse_origine in ('piste', 'boutique')),
  fdj_cash_control_id uuid references public.fdj_cash_controls(id),
  montant             numeric(12,2) not null check (montant > 0),
  mode_restitution    text not null check (mode_restitution in ('especes', 'carte_bancaire', 'cheque', 'virement', 'autre')),
  justification       text not null check (length(btrim(justification)) >= 5),
  source              text not null check (source in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj', 'coffre')),
  source_date         date,
  source_quart        text check (source_quart in ('1', '2')),
  restitue_le         timestamptz not null default now(),
  valide_par          uuid not null references public.employees(id),
  created_at          timestamptz not null default now(),
  idempotency_key     uuid not null unique,
  annule_le           timestamptz,
  annule_par          uuid references public.employees(id),
  motif_annulation    text,
  constraint ertp_origine_exactement_une check (
       (module_origine = 'verify' and audit_id is not null and caisse_origine is not null and fdj_cash_control_id is null)
    or (module_origine = 'fdj' and fdj_cash_control_id is not null and audit_id is null and caisse_origine is null)),
  constraint ertp_source check (
       (source = 'coffre' and source_date is null and source_quart is null)
    or (source <> 'coffre' and source_date is not null and source_quart is not null)),
  constraint ertp_annulation_complete check (
       (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) >= 5))
);
comment on table public.ecarts_restitutions_trop_percu is
  'Restitutions de trop-perçu : argent rendu au responsable quand ses versements dépassent le manque effectif. Jamais automatique : justifiée et validée par un manager (20261008120000).';

create index ertp_audit_idx on public.ecarts_restitutions_trop_percu (audit_id, caisse_origine) where audit_id is not null;
create index ertp_fdj_idx   on public.ecarts_restitutions_trop_percu (fdj_cash_control_id) where fdj_cash_control_id is not null;
create index ertp_src_idx   on public.ecarts_restitutions_trop_percu (site, source, source_date, source_quart);

create table public.caisse_transferts_coffre (
  id               uuid primary key default gen_random_uuid(),
  site             text not null references public.sites(site_id),
  source           text not null check (source in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj')),
  source_date      date not null,
  source_quart     text not null check (source_quart in ('1', '2')),
  montant          numeric(12,2) not null check (montant > 0),
  versement_id     uuid references public.ecarts_versements_regularisation(id),
  motif            text not null check (length(btrim(motif)) >= 5),
  effectue_le      timestamptz not null default now(),
  auteur_id        uuid not null references public.employees(id),
  created_at       timestamptz not null default now(),
  idempotency_key  uuid not null unique,
  annule_le        timestamptz,
  annule_par       uuid references public.employees(id),
  motif_annulation text,
  constraint ctc_annulation_complete check (
       (annule_le is null and annule_par is null and motif_annulation is null)
    or (annule_le is not null and annule_par is not null and length(btrim(coalesce(motif_annulation, ''))) >= 5))
);
comment on table public.caisse_transferts_coffre is
  'Transferts internes tiroir → coffre. Ni encaissement ni décaissement : ils déplacent de l''argent déjà compté. Écriture par RPC uniquement (20261008120000).';

create index ctc_src_idx       on public.caisse_transferts_coffre (site, source, source_date, source_quart);
create index ctc_versement_idx on public.caisse_transferts_coffre (versement_id) where versement_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Immuabilité : seule l'annulation d'une ligne active est permise
-- ----------------------------------------------------------------------------
create or replace function public._ecarts_regul_immuable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception '[IMMUABLE] % ne se vide pas : on annule ses lignes.', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  if tg_op = 'DELETE' then
    raise exception '[IMMUABLE] Une ligne de % ne se supprime pas : on l''annule.', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  if old.annule_le is not null then
    raise exception '[DEJA_ANNULE] Cette ligne de % est déjà annulée.', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  if new.annule_le is null
     or (to_jsonb(new) - 'annule_le' - 'annule_par' - 'motif_annulation')
        is distinct from (to_jsonb(old) - 'annule_le' - 'annule_par' - 'motif_annulation') then
    raise exception '[IMMUABLE] Une ligne de % ne se réécrit pas : seule son annulation est permise.', tg_table_name
      using errcode = 'restrict_violation';
  end if;
  return new;
end;
$$;

create trigger evr_immuable before update or delete on public.ecarts_versements_regularisation
  for each row execute function public._ecarts_regul_immuable();
create trigger evr_immuable_truncate before truncate on public.ecarts_versements_regularisation
  for each statement execute function public._ecarts_regul_immuable();
create trigger ertp_immuable before update or delete on public.ecarts_restitutions_trop_percu
  for each row execute function public._ecarts_regul_immuable();
create trigger ertp_immuable_truncate before truncate on public.ecarts_restitutions_trop_percu
  for each statement execute function public._ecarts_regul_immuable();
create trigger ctc_immuable before update or delete on public.caisse_transferts_coffre
  for each row execute function public._ecarts_regul_immuable();
create trigger ctc_immuable_truncate before truncate on public.caisse_transferts_coffre
  for each statement execute function public._ecarts_regul_immuable();

-- ----------------------------------------------------------------------------
-- 3. Aides internes (aucun droit d'exécution hors propriétaire)
-- ----------------------------------------------------------------------------

-- Garde : manager ou gérant actif du site visé. Rend son identifiant.
create or replace function public._ecarts_regul_manager(p_site text)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid;
  v_role text;
  v_site text;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;
  select e.role, e.site_id into v_role, v_site
    from public.employees e
   where e.id = v_uid and e.actif is not false;
  if v_role is null then
    raise exception 'Utilisateur inconnu ou inactif : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;
  if v_role not in ('manager', 'gerant') then
    raise exception 'Seul un manager ou un gérant peut enregistrer une régularisation.'
      using errcode = 'insufficient_privilege';
  end if;
  if p_site is null or v_site is distinct from p_site then
    raise exception 'Cet écart appartient à un autre site.'
      using errcode = 'insufficient_privilege';
  end if;
  return v_uid;
end;
$$;

-- Origine d'un écart : site, responsable, date, écart effectif (validé sinon
-- brut, comme NexusEcartsDonnees), clôture. Verrouille la ligne si demandé.
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
      select c.site, c.ecart, c.resultat_controle, s.employee_id, s.date, s.quart into v_f
        from public.fdj_cash_controls c join public.fdj_shifts s on s.id = c.shift_id
       where c.id = p_fdj_cash_control_id
         for update of c;
    else
      select c.site, c.ecart, c.resultat_controle, s.employee_id, s.date, s.quart into v_f
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
    cloture := v_f.resultat_controle is not null;
    employee_id := v_f.employee_id;
    nb_responsables := case when v_f.employee_id is null then 0 else 1 end;
  end if;
end;
$$;

-- Situation calculée d'un écart. Rien n'est stocké.
create or replace function public._ecarts_regul_situation(
  p_audit_id uuid, p_caisse text, p_fdj_cash_control_id uuid, p_ecart_effectif numeric,
  out deficit numeric, out versements numeric, out restitutions numeric,
  out reste_du numeric, out trop_percu numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  deficit := greatest(-coalesce(p_ecart_effectif, 0), 0);
  select coalesce(sum(v.montant), 0) into versements
    from public.ecarts_versements_regularisation v
   where v.annule_le is null
     and ((p_audit_id is not null and v.audit_id = p_audit_id and v.caisse_origine = p_caisse)
       or (p_fdj_cash_control_id is not null and v.fdj_cash_control_id = p_fdj_cash_control_id));
  select coalesce(sum(r.montant), 0) into restitutions
    from public.ecarts_restitutions_trop_percu r
   where r.annule_le is null
     and ((p_audit_id is not null and r.audit_id = p_audit_id and r.caisse_origine = p_caisse)
       or (p_fdj_cash_control_id is not null and r.fdj_cash_control_id = p_fdj_cash_control_id));
  reste_du   := greatest(deficit - (versements - restitutions), 0);
  trop_percu := greatest((versements - restitutions) - deficit, 0);
end;
$$;

-- Le tiroir désigné appartient-il à un quart déjà validé ? Y ajouter ou en
-- retirer de l'argent réécrirait alors un attendu clos.
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
       where s.site = p_site and s.date = p_date and s.quart = p_quart and c.resultat_controle is not null)
    else false
  end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Versements de régularisation
-- ----------------------------------------------------------------------------
create or replace function public.enregistrer_versement_regularisation(
  p_audit_id            uuid,
  p_caisse              text,
  p_fdj_cash_control_id uuid,
  p_montant             numeric,
  p_mode                text,
  p_justificatif        text,
  p_destination         text,
  p_recepteur_date      date,
  p_recepteur_quart     text,
  p_idempotency_key     uuid)
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
    if p_recepteur_date < v_o.date_ecart then
      raise exception '[QUART_RECEPTEUR_ANTERIEUR] Le quart récepteur précède l''écart régularisé.'
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
    recepteur_date, recepteur_quart, auteur_id, idempotency_key)
  values (
    v_o.site, v_o.employee_id, v_o.module_origine, p_audit_id,
    case when p_audit_id is not null then p_caisse end, p_fdj_cash_control_id,
    v_o.date_ecart, v_o.quart_ecart, p_montant, p_mode, nullif(btrim(coalesce(p_justificatif, '')), ''), p_destination,
    case when p_destination <> 'coffre' then p_recepteur_date end,
    case when p_destination <> 'coffre' then p_recepteur_quart end,
    v_uid, p_idempotency_key)
  returning id into v_id;

  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  return jsonb_build_object('ok', true, 'rejoue', false, 'versement_id', v_id,
    'deficit', v_s.deficit, 'versements', v_s.versements, 'restitutions', v_s.restitutions,
    'reste_du', v_s.reste_du, 'trop_percu', v_s.trop_percu);
end;
$$;

create or replace function public.annuler_versement_regularisation(p_versement_id uuid, p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_v   public.ecarts_versements_regularisation;
  v_o   record;
  v_s   record;
  v_uid uuid;
begin
  if length(btrim(coalesce(p_motif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Un motif d''annulation d''au moins 5 caractères est obligatoire.'
      using errcode = 'check_violation';
  end if;
  select * into v_v from public.ecarts_versements_regularisation where id = p_versement_id;
  if not found then
    raise exception 'Versement introuvable.' using errcode = 'no_data_found';
  end if;
  v_uid := public._ecarts_regul_manager(v_v.site);
  -- Même ordre de verrouillage que l'enregistrement : l'origine d'abord.
  select * into v_o from public._ecarts_regul_origine(v_v.audit_id, v_v.caisse_origine, v_v.fdj_cash_control_id, true);
  select * into v_v from public.ecarts_versements_regularisation where id = p_versement_id for update;
  if v_v.annule_le is not null then
    raise exception '[DEJA_ANNULE] Ce versement est déjà annulé.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.caisse_transferts_coffre t where t.versement_id = v_v.id and t.annule_le is null) then
    raise exception '[TRANSFERT_ACTIF] Un transfert vers le coffre porte ce versement : l''annuler d''abord.'
      using errcode = 'check_violation';
  end if;
  select * into v_s from public._ecarts_regul_situation(v_v.audit_id, v_v.caisse_origine, v_v.fdj_cash_control_id, v_o.ecart_effectif);
  if v_s.restitutions > v_s.versements - v_v.montant then
    raise exception '[RESTITUTION_ACTIVE] Une restitution active dépasserait les versements restants : l''annuler d''abord.'
      using errcode = 'check_violation';
  end if;
  if v_v.destination <> 'coffre'
     and public._ecarts_regul_tiroir_clos(v_v.site, v_v.destination, v_v.recepteur_date, v_v.recepteur_quart) then
    raise exception '[QUART_RECEPTEUR_CLOTURE] Le quart qui a reçu ce versement est validé : son attendu ne se réécrit plus.'
      using errcode = 'check_violation';
  end if;

  update public.ecarts_versements_regularisation
     set annule_le = now(), annule_par = v_uid, motif_annulation = btrim(p_motif)
   where id = v_v.id;

  select * into v_s from public._ecarts_regul_situation(v_v.audit_id, v_v.caisse_origine, v_v.fdj_cash_control_id, v_o.ecart_effectif);
  return jsonb_build_object('ok', true, 'versement_id', v_v.id,
    'deficit', v_s.deficit, 'versements', v_s.versements, 'restitutions', v_s.restitutions,
    'reste_du', v_s.reste_du, 'trop_percu', v_s.trop_percu);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Restitutions de trop-perçu (jamais automatiques)
-- ----------------------------------------------------------------------------
create or replace function public.enregistrer_restitution_trop_percu(
  p_audit_id            uuid,
  p_caisse              text,
  p_fdj_cash_control_id uuid,
  p_montant             numeric,
  p_mode                text,
  p_justification       text,
  p_source              text,
  p_source_date         date,
  p_source_quart        text,
  p_idempotency_key     uuid)
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
    if public._ecarts_regul_tiroir_clos(v_o.site, p_source, p_source_date, p_source_quart) then
      raise exception '[QUART_RECEPTEUR_CLOTURE] Ce tiroir appartient à un quart déjà validé.'
        using errcode = 'check_violation';
    end if;
  end if;

  insert into public.ecarts_restitutions_trop_percu (
    site, employee_id, module_origine, audit_id, caisse_origine, fdj_cash_control_id,
    montant, mode_restitution, justification, source, source_date, source_quart,
    valide_par, idempotency_key)
  values (
    v_o.site, v_benef[1], v_o.module_origine, p_audit_id,
    case when p_audit_id is not null then p_caisse end, p_fdj_cash_control_id,
    p_montant, p_mode, btrim(p_justification), p_source,
    case when p_source <> 'coffre' then p_source_date end,
    case when p_source <> 'coffre' then p_source_quart end,
    v_uid, p_idempotency_key)
  returning id into v_id;

  select * into v_s from public._ecarts_regul_situation(p_audit_id, p_caisse, p_fdj_cash_control_id, v_o.ecart_effectif);
  return jsonb_build_object('ok', true, 'rejoue', false, 'restitution_id', v_id,
    'deficit', v_s.deficit, 'versements', v_s.versements, 'restitutions', v_s.restitutions,
    'reste_du', v_s.reste_du, 'trop_percu', v_s.trop_percu);
end;
$$;

create or replace function public.annuler_restitution_trop_percu(p_restitution_id uuid, p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_r   public.ecarts_restitutions_trop_percu;
  v_uid uuid;
begin
  if length(btrim(coalesce(p_motif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Un motif d''annulation d''au moins 5 caractères est obligatoire.'
      using errcode = 'check_violation';
  end if;
  select * into v_r from public.ecarts_restitutions_trop_percu where id = p_restitution_id;
  if not found then
    raise exception 'Restitution introuvable.' using errcode = 'no_data_found';
  end if;
  v_uid := public._ecarts_regul_manager(v_r.site);
  perform public._ecarts_regul_origine(v_r.audit_id, v_r.caisse_origine, v_r.fdj_cash_control_id, true);
  select * into v_r from public.ecarts_restitutions_trop_percu where id = p_restitution_id for update;
  if v_r.annule_le is not null then
    raise exception '[DEJA_ANNULE] Cette restitution est déjà annulée.' using errcode = 'check_violation';
  end if;
  if v_r.source <> 'coffre'
     and public._ecarts_regul_tiroir_clos(v_r.site, v_r.source, v_r.source_date, v_r.source_quart) then
    raise exception '[QUART_RECEPTEUR_CLOTURE] Le quart d''où est sorti l''argent est validé : son attendu ne se réécrit plus.'
      using errcode = 'check_violation';
  end if;
  update public.ecarts_restitutions_trop_percu
     set annule_le = now(), annule_par = v_uid, motif_annulation = btrim(p_motif)
   where id = v_r.id;
  return jsonb_build_object('ok', true, 'restitution_id', v_r.id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Transferts tiroir → coffre (internes, sans encaissement)
-- ----------------------------------------------------------------------------
create or replace function public.enregistrer_transfert_coffre(
  p_source          text,
  p_source_date     date,
  p_source_quart    text,
  p_montant         numeric,
  p_versement_id    uuid,
  p_motif           text,
  p_idempotency_key uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid;
  v_site  text;
  v_v     public.ecarts_versements_regularisation;
  v_exist public.caisse_transferts_coffre;
  v_deja  numeric;
  v_jour  date;
  v_id    uuid;
begin
  if p_idempotency_key is null then
    raise exception 'Clé d''idempotence manquante.' using errcode = 'invalid_parameter_value';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('ctc:' || p_idempotency_key::text, 0));
  select * into v_exist from public.caisse_transferts_coffre where idempotency_key = p_idempotency_key;
  if found then
    if v_exist.auteur_id is distinct from (select auth.uid())
       or v_exist.versement_id is distinct from p_versement_id
       or v_exist.montant is distinct from p_montant then
      raise exception '[IDEMPOTENCE_CONFLIT] Cette clé désigne déjà une autre opération.'
        using errcode = 'unique_violation';
    end if;
    return jsonb_build_object('ok', true, 'rejoue', true, 'transfert_id', v_exist.id);
  end if;

  if p_montant is null or p_montant <= 0 or p_montant <> round(p_montant, 2) then
    raise exception 'Montant invalide : un nombre positif, au centime.' using errcode = 'invalid_parameter_value';
  end if;
  if p_source is null or p_source not in ('tiroir_verify_piste', 'tiroir_verify_boutique', 'tiroir_fdj') then
    raise exception 'Un transfert part d''un tiroir : %', coalesce(p_source, '(vide)') using errcode = 'invalid_parameter_value';
  end if;
  if p_source_date is null or p_source_quart is null or p_source_quart not in ('1', '2') then
    raise exception 'Un tiroir se désigne par la date et le quart (1 ou 2).' using errcode = 'invalid_parameter_value';
  end if;
  if length(btrim(coalesce(p_motif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Un transfert exige un motif d''au moins 5 caractères.'
      using errcode = 'check_violation';
  end if;

  if p_versement_id is not null then
    select * into v_v from public.ecarts_versements_regularisation where id = p_versement_id for update;
    if not found then
      raise exception 'Versement introuvable.' using errcode = 'no_data_found';
    end if;
    v_site := v_v.site;
  else
    select e.site_id into v_site from public.employees e where e.id = (select auth.uid());
  end if;
  v_uid := public._ecarts_regul_manager(v_site);

  if p_versement_id is not null then
    if v_v.annule_le is not null then
      raise exception '[DEJA_ANNULE] Ce versement est annulé : rien à transférer.' using errcode = 'check_violation';
    end if;
    if v_v.destination is distinct from p_source
       or v_v.recepteur_date is distinct from p_source_date
       or v_v.recepteur_quart is distinct from p_source_quart then
      raise exception 'Le transfert doit partir du tiroir qui a reçu ce versement.' using errcode = 'invalid_parameter_value';
    end if;
    select coalesce(sum(t.montant), 0) into v_deja
      from public.caisse_transferts_coffre t
     where t.versement_id = p_versement_id and t.annule_le is null;
    if v_deja + p_montant > v_v.montant then
      raise exception '[PLAFOND_DEPASSE] Le transfert (%) dépasse ce qui reste du versement dans le tiroir (%).', p_montant, v_v.montant - v_deja
        using errcode = 'check_violation';
    end if;
  end if;

  select (now() at time zone s.timezone)::date into v_jour from public.sites s where s.site_id = v_site;
  if p_source_date > v_jour then
    raise exception '[QUART_RECEPTEUR_FUTUR] Le quart désigné est postérieur au jour de la station.'
      using errcode = 'check_violation';
  end if;
  if public._ecarts_regul_tiroir_clos(v_site, p_source, p_source_date, p_source_quart) then
    raise exception '[QUART_RECEPTEUR_CLOTURE] Ce tiroir appartient à un quart déjà validé.'
      using errcode = 'check_violation';
  end if;

  insert into public.caisse_transferts_coffre (
    site, source, source_date, source_quart, montant, versement_id, motif, auteur_id, idempotency_key)
  values (v_site, p_source, p_source_date, p_source_quart, p_montant, p_versement_id, btrim(p_motif), v_uid, p_idempotency_key)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'rejoue', false, 'transfert_id', v_id);
end;
$$;

create or replace function public.annuler_transfert_coffre(p_transfert_id uuid, p_motif text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t   public.caisse_transferts_coffre;
  v_uid uuid;
begin
  if length(btrim(coalesce(p_motif, ''))) < 5 then
    raise exception '[JUSTIFICATION_REQUISE] Un motif d''annulation d''au moins 5 caractères est obligatoire.'
      using errcode = 'check_violation';
  end if;
  select * into v_t from public.caisse_transferts_coffre where id = p_transfert_id for update;
  if not found then
    raise exception 'Transfert introuvable.' using errcode = 'no_data_found';
  end if;
  v_uid := public._ecarts_regul_manager(v_t.site);
  if v_t.annule_le is not null then
    raise exception '[DEJA_ANNULE] Ce transfert est déjà annulé.' using errcode = 'check_violation';
  end if;
  if public._ecarts_regul_tiroir_clos(v_t.site, v_t.source, v_t.source_date, v_t.source_quart) then
    raise exception '[QUART_RECEPTEUR_CLOTURE] Le quart d''où est parti l''argent est validé : son attendu ne se réécrit plus.'
      using errcode = 'check_violation';
  end if;
  update public.caisse_transferts_coffre
     set annule_le = now(), annule_par = v_uid, motif_annulation = btrim(p_motif)
   where id = v_t.id;
  return jsonb_build_object('ok', true, 'transfert_id', v_t.id);
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Lectures : situation d'un écart, trop-perçus d'un site
-- ----------------------------------------------------------------------------
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
      else 'non_regularise' end);
end;
$$;

-- Signalement : tout écart dont les versements nets dépassent le manque
-- effectif (typiquement après une correction de l'audit d'origine).
create or replace function public.ecarts_trop_percus(p_site text)
returns table (
  module_origine text, audit_id uuid, caisse_origine text, fdj_cash_control_id uuid,
  employee_id uuid, date_ecart date, ecart_effectif numeric, deficit numeric,
  versements numeric, restitutions numeric, trop_percu numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  k record;
  o record;
  s record;
begin
  perform public._ecarts_regul_manager(p_site);
  for k in
    select distinct v.module_origine, v.audit_id, v.caisse_origine, v.fdj_cash_control_id, v.employee_id
      from public.ecarts_versements_regularisation v
     where v.site = p_site and v.annule_le is null
  loop
    select * into o from public._ecarts_regul_origine(k.audit_id, k.caisse_origine, k.fdj_cash_control_id, false);
    select * into s from public._ecarts_regul_situation(k.audit_id, k.caisse_origine, k.fdj_cash_control_id, o.ecart_effectif);
    if s.trop_percu > 0 then
      module_origine := k.module_origine; audit_id := k.audit_id; caisse_origine := k.caisse_origine;
      fdj_cash_control_id := k.fdj_cash_control_id; employee_id := k.employee_id; date_ecart := o.date_ecart;
      ecart_effectif := o.ecart_effectif; deficit := s.deficit; versements := s.versements;
      restitutions := s.restitutions; trop_percu := s.trop_percu;
      return next;
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. RLS et droits
-- ----------------------------------------------------------------------------
alter table public.ecarts_versements_regularisation enable row level security;
alter table public.ecarts_restitutions_trop_percu   enable row level security;
alter table public.caisse_transferts_coffre         enable row level security;

create policy lecture_manager_meme_site on public.ecarts_versements_regularisation
  for select to authenticated
  using (site = (select public.current_employee_site_id())
         and (select public.current_employee_role()) in ('manager', 'gerant'));
create policy lecture_manager_meme_site on public.ecarts_restitutions_trop_percu
  for select to authenticated
  using (site = (select public.current_employee_site_id())
         and (select public.current_employee_role()) in ('manager', 'gerant'));
create policy lecture_manager_meme_site on public.caisse_transferts_coffre
  for select to authenticated
  using (site = (select public.current_employee_site_id())
         and (select public.current_employee_role()) in ('manager', 'gerant'));

-- `revoke from public` ne ferme pas anon sur Supabase : grants nommés.
revoke all on public.ecarts_versements_regularisation, public.ecarts_restitutions_trop_percu,
              public.caisse_transferts_coffre from public, anon, authenticated;
grant select on public.ecarts_versements_regularisation, public.ecarts_restitutions_trop_percu,
                public.caisse_transferts_coffre to authenticated;

do $$
declare
  v_sig text;
begin
  -- Aides internes : personne d'autre que le propriétaire.
  foreach v_sig in array array[
    'public._ecarts_regul_immuable()',
    'public._ecarts_regul_manager(text)',
    'public._ecarts_regul_origine(uuid, text, uuid, boolean)',
    'public._ecarts_regul_situation(uuid, text, uuid, numeric)',
    'public._ecarts_regul_tiroir_clos(text, text, date, text)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('revoke all on function %s from authenticated', v_sig);
  end loop;

  foreach v_sig in array array[
    'public.enregistrer_versement_regularisation(uuid, text, uuid, numeric, text, text, text, date, text, uuid)',
    'public.annuler_versement_regularisation(uuid, text)',
    'public.enregistrer_restitution_trop_percu(uuid, text, uuid, numeric, text, text, text, date, text, uuid)',
    'public.annuler_restitution_trop_percu(uuid, text)',
    'public.enregistrer_transfert_coffre(text, date, text, numeric, uuid, text, uuid)',
    'public.annuler_transfert_coffre(uuid, text)',
    'public.ecart_regularisation_etat(uuid, text, uuid)',
    'public.ecarts_trop_percus(text)'
  ] loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;
