-- ============================================================================
-- FDJ — Vague 1, Phase A (« ÉTENDRE ») — Projection serveur de l'employé
--
-- Mandat « Refonte FDJ, Vague 1 », §4 (confidentialité et projection employé)
-- et §3.3 (vocabulaire de l'écart provisoire).
--
-- « Aucun champ sensible reçu dans le réseau puis simplement masqué dans
--   l'interface. » — ce qui ne doit pas être lu n'est pas envoyé.
--
-- Fonctions créées :
--   1. public.fdj_libelle_ecart_employe(...)    — §3.3, vocabulaire imposé
--   2. public.fdj_mes_quarts_fdj()              — mes quarts, sans paramètre
--   3. public.fdj_ma_caisse(...)                — la projection d'un quart
--   4. public.fdj_mes_comptages_caisse(...)     — mes comptages, pour corriger
--   5. public.fdj_mes_corrections_caisse(...)   — l'historique de MES corrections
--   6. public.fdj_mes_demandes_correction()     — mes signalements et leur suite
--
-- ---------------------------------------------------------------------------
-- AUCUN PARAMÈTRE D'IDENTITÉ (§4)
-- « L'identité doit provenir de la session authentifiée, jamais d'un
--   identifiant fourni par le navigateur. »
-- Aucune de ces fonctions ne prend d'employee_id ni de site. p_shift_id
-- DÉSIGNE UNE LIGNE, il n'affirme pas une identité : chaque fonction vérifie
-- ensuite que ce quart est bien celui de auth.uid(), et renvoie zéro ligne ou
-- lève une exception dans le cas contraire.
--
-- ---------------------------------------------------------------------------
-- CE QUI N'EST JAMAIS RENVOYÉ, DANS AUCUN ÉTAT
--   - fdj_cash_controls.motif_ecart_texte   (motif interne du manager, §3.6)
--   - fdj_cash_controls.valide_par, controle_par  (qui a contrôlé)
--   - fdj_caisse_evenements.commentaire des événements manager
--   - toute ligne d'un autre employé ou d'un autre site
--   - le journal fdj_caisse_evenements dans son ensemble : `authenticated`
--     n'y a aucun droit (migration 220200), ces fonctions en extraient les
--     seules lignes dont l'employé est l'auteur.
--
-- ---------------------------------------------------------------------------
-- LES TROIS ÉTATS (§4)
--
--   A. AVANT CONFIRMATION
--      Informations de saisie. `ecart_provisoire` est NULL et
--      `ecart_etabli` vaut false.
--
--      ARBITRAGE. Le §3.3 interdit de présenter un résultat « comme un écart
--      établi » avant la première confirmation ; il n'interdit pas à
--      l'employé de voir le total de son propre comptage pendant qu'il
--      compte. Lui refuser cette arithmétique rendrait l'écran inutilisable
--      — il ne saurait pas s'il a fini — et serait de toute façon sans effet,
--      puisque les entrées brutes qu'il vient lui-même de saisir suffisent à
--      la refaire. Les montants calculés sont donc renvoyés, mais sous la clé
--      `aide_a_la_saisie`, jamais sous le nom d'« écart », et accompagnés de
--      `ecart_etabli: false`. La distinction protégée par le mandat est celle
--      entre un calcul de travail et un constat opposable ; c'est cette
--      distinction-là que porte le nommage.
--
--   B. APRÈS CONFIRMATION, AVANT VALIDATION
--      `ecart_provisoire` renseigné, libellé « Écart provisoire en plus /
--      en moins / Aucun écart provisoire », statut « en attente du contrôle
--      du manager », données nécessaires pour comprendre et corriger sa
--      propre saisie, historique de ses propres corrections.
--
--   C. APRÈS VALIDATION
--      « Écart en plus : +X € » / « Écart en moins : −X € » /
--      « Aucun écart retenu ». Le motif interne du manager reste invisible.
--
-- CETTE MIGRATION NE LIT, N'ÉCRIT ET NE CORRIGE AUCUNE DONNÉE EXISTANTE.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. VOCABULAIRE EMPLOYÉ (§3.3)
--    Interdits : « petit écart », « grand écart », « caisse validée » avant
--    l'action du manager, tout vocabulaire accusatoire ou culpabilisant.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_libelle_ecart_employe(
  p_ecart   numeric,
  p_valide  boolean default false
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when p_ecart is null and coalesce(p_valide, false)
             then 'Aucun écart retenu'
           when p_ecart is null
             then 'Calcul incomplet'
           when coalesce(p_valide, false) and p_ecart = 0
             then 'Aucun écart retenu'
           when coalesce(p_valide, false) and p_ecart > 0
             then 'Écart en plus : +' || to_char(p_ecart, 'FM999999990.00') || ' €'
           when coalesce(p_valide, false)
             then 'Écart en moins : ' || replace(to_char(p_ecart, 'FM999999990.00'), '-', '−') || ' €'
           when p_ecart = 0
             then 'Aucun écart provisoire'
           when p_ecart > 0
             then 'Écart provisoire en plus : +' || to_char(p_ecart, 'FM999999990.00') || ' €'
           else
                  'Écart provisoire en moins : ' || replace(to_char(p_ecart, 'FM999999990.00'), '-', '−') || ' €'
         end;
$$;

comment on function public.fdj_libelle_ecart_employe(numeric, boolean) is
  'Mandat §3.3 — vocabulaire employé. Avant validation : « Écart provisoire en plus / en moins / Aucun écart provisoire ». Après : « Écart en plus / en moins / Aucun écart retenu ». Jamais « petit » ni « grand » écart.';

-- ----------------------------------------------------------------------------
-- 2. MES QUARTS FDJ — aucun paramètre, donc aucune identité à falsifier.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_mes_quarts_fdj(p_limite int default 30)
returns table (
  shift_id                 uuid,
  date                     date,
  quart                    text,
  statut_caisse            text,
  etape                    text,
  ouvert_le                timestamptz,
  confirme_le              timestamptz,
  valide_le                timestamptz,
  nb_corrections           int,
  ecart_a_afficher         numeric,
  libelle_ecart            text,
  message                  text,
  correction_possible      boolean,
  signalement_possible     boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as uid)
  select
    s.id,
    s.date,
    s.quart,
    coalesce(c.statut, 'sans_caisse'),
    case
      when c.id is null            then 'saisie_a_commencer'
      when c.confirme_le is null   then 'brouillon'
      when c.valide_le is null     then 'en_attente_controle_manager'
      else                              'validee'
    end,
    s.ouvert_le,
    c.confirme_le,
    c.valide_le,
    coalesce(c.nb_corrections, 0),
    -- Avant confirmation, aucun écart n'est rendu sous ce nom (état A).
    case when c.confirme_le is not null then c.ecart end,
    case when c.confirme_le is null
         then null
         else public.fdj_libelle_ecart_employe(c.ecart, c.valide_le is not null)
    end,
    case
      when c.id is null          then 'Caisse non commencée.'
      when c.confirme_le is null then 'Brouillon en cours. Rien n''a encore été transmis au manager.'
      when c.valide_le is null   then 'Cette caisse reste en attente du contrôle du manager.'
      else                            'Caisse contrôlée par le manager.'
    end,
    -- §3.4 : corriger reste possible tant que le manager n'a pas validé.
    (c.confirme_le is not null and c.valide_le is null),
    -- §3.7 : après validation, seul le signalement est ouvert.
    (c.valide_le is not null)
  from public.fdj_shifts s
  left join public.fdj_cash_controls c on c.shift_id = s.id
  cross join moi
  where moi.uid is not null
    and s.employee_id = moi.uid
  order by s.date desc, s.quart desc
  limit greatest(coalesce(p_limite, 30), 1);
$$;

comment on function public.fdj_mes_quarts_fdj(int) is
  'Mandat §4 — quarts FDJ de l''appelant. Filtre sur auth.uid() uniquement, aucun paramètre d''identité. Aucun écart rendu avant la confirmation.';

-- ----------------------------------------------------------------------------
-- 3. LA PROJECTION D'UN QUART (§4)
-- ----------------------------------------------------------------------------

create or replace function public.fdj_ma_caisse(p_shift_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_shift  public.fdj_shifts;
  v_cash   public.fdj_cash_controls;
  v_calc   jsonb;
  v_etape  text;
  v_valide boolean;
begin
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_shift_id is null then
    raise exception 'Identifiant de quart FDJ manquant.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_shift from public.fdj_shifts s where s.id = p_shift_id;
  if not found then
    raise exception 'Quart FDJ introuvable.' using errcode = 'no_data_found';
  end if;

  -- Le quart doit être celui de l'appelant. Un employé qui devine l'UUID du
  -- quart d'un collègue n'obtient rien : ni montant, ni nom, ni existence
  -- détaillée.
  if v_shift.employee_id is distinct from v_uid then
    raise exception 'Ce quart FDJ n''est pas sous votre responsabilité.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id;

  v_valide := v_cash.valide_le is not null;
  v_etape  := case
                when v_cash.id is null          then 'saisie_a_commencer'
                when v_cash.confirme_le is null then 'brouillon'
                when not v_valide               then 'en_attente_controle_manager'
                else                                 'validee'
              end;

  -- État A — aide à la saisie, recalculée et jamais nommée « écart ».
  if v_etape in ('saisie_a_commencer', 'brouillon') then
    v_calc := public.fdj_calculer_caisse(
                p_shift_id,
                v_cash.caisse_reelle,
                coalesce(v_cash.regularisations, 0));

    return jsonb_build_object(
      'shift_id', p_shift_id,
      'date', v_shift.date,
      'quart', v_shift.quart,
      'etape', v_etape,
      'ecart_etabli', false,
      'ecart_provisoire', null,
      'libelle_ecart', null,
      'message', 'Rien n''a encore été transmis au manager.',
      'action_disponible', 'Confirmer ma caisse et la transmettre au manager',
      'aide_a_la_saisie', jsonb_build_object(
        'ventes_grattage_valeur', v_calc->'ventes_grattage_valeur',
        'lots_payes_grattage',    v_calc->'lots_payes_grattage',
        'caisse_tirages',         v_calc->'caisse_tirages',
        'caisse_grattage',        v_calc->'caisse_grattage',
        'regularisations',        v_calc->'regularisations',
        'total_attendu',          v_calc->'caisse_attendue',
        'total_compte',           v_calc->'caisse_reelle',
        'difference_de_comptage', v_calc->'ecart',
        'saisie_complete',        (v_calc->>'ecart') is not null,
        'note', 'Calcul de travail. Aucun résultat n''est établi avant la confirmation.'
      )
    );
  end if;

  -- États B et C — l'écart est rendu, avec le vocabulaire du §3.3.
  return jsonb_build_object(
    'shift_id', p_shift_id,
    'date', v_shift.date,
    'quart', v_shift.quart,
    'etape', v_etape,
    'ecart_etabli', true,
    'ecart_provisoire', case when v_valide then null else v_cash.ecart end,
    'ecart_retenu',     case when v_valide then v_cash.ecart else null end,
    'libelle_ecart', public.fdj_libelle_ecart_employe(v_cash.ecart, v_valide),
    'message', case when v_valide
                    then 'Caisse contrôlée par le manager.'
                    else 'Cette caisse reste en attente du contrôle du manager.' end,
    'action_disponible', case when v_valide
                              then 'Signaler une erreur après validation'
                              else 'Corriger ma saisie' end,
    -- §4 : « les données nécessaires pour comprendre et corriger sa propre
    -- saisie ». Ce sont ses propres chiffres, pas ceux d'un tiers.
    'ma_saisie', jsonb_build_object(
      'ventes_grattage_valeur', v_cash.ventes_grattage_valeur,
      'lots_payes_grattage',    v_cash.lots_payes_grattage,
      'caisse_tirages',         v_cash.caisse_tirages,
      'caisse_grattage',        v_cash.caisse_grattage,
      'regularisations',        v_cash.regularisations,
      'caisse_attendue',        v_cash.caisse_attendue,
      'caisse_reelle',          v_cash.caisse_reelle
    ),
    'confirmation_initiale', jsonb_build_object(
      'confirme_le',   v_cash.confirme_le,
      'caisse_reelle', v_cash.caisse_reelle_origine,
      'ecart',         v_cash.ecart_origine
    ),
    'version', v_cash.version,
    'nb_corrections', v_cash.nb_corrections,
    'derniere_correction_le', v_cash.derniere_correction_le,
    'valide_le', v_cash.valide_le,
    'correction_possible', (not v_valide),
    'signalement_possible', v_valide
    -- Volontairement absents : motif_ecart_texte, valide_par, controle_par,
    -- controle_le, resultat_controle. Motif interne et identité du contrôleur
    -- ne quittent pas le serveur (§4).
  );
end;
$$;

comment on function public.fdj_ma_caisse(uuid) is
  'Mandat §4 — projection employé d''une caisse FDJ. Trois états ; aucun motif interne manager, aucun contrôleur nommé, aucune donnée de collègue. Identité prise sur auth.uid().';

-- ----------------------------------------------------------------------------
-- 4. MES COMPTAGES — pour comprendre et corriger sa propre saisie (§4)
-- ----------------------------------------------------------------------------

create or replace function public.fdj_mes_comptages_caisse(p_shift_id uuid)
returns table (
  game_id        uuid,
  jeu            text,
  prix           numeric,
  stock_initial  numeric,
  appro          numeric,
  stock_final    numeric,
  ventes_qte     numeric,
  ventes_valeur  numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as uid)
  select
    g.id,
    g.nom,
    g.prix,
    ct.stock_initial,
    ct.appro,
    ct.stock_final,
    case when ct.stock_initial is null or ct.stock_final is null then null
         else ct.stock_initial + coalesce(ct.appro, 0) - ct.stock_final end,
    public.fdj_ventes_jeu(ct.stock_initial, ct.appro, ct.stock_final, g.prix)
  from public.fdj_shift_counts ct
  join public.fdj_games  g on g.id = ct.game_id
  join public.fdj_shifts s on s.id = ct.shift_id
  cross join moi
  where moi.uid is not null
    and ct.shift_id = p_shift_id
    and s.employee_id = moi.uid
  order by g.ordre_affichage nulls last, g.nom;
$$;

comment on function public.fdj_mes_comptages_caisse(uuid) is
  'Mandat §4 — comptages par jeu du quart de l''appelant. Zéro ligne si le quart n''est pas le sien.';

-- ----------------------------------------------------------------------------
-- 5. L'HISTORIQUE DE MES PROPRES CORRECTIONS (§4)
--    Restreint aux événements DONT L'EMPLOYÉ EST L'AUTEUR. Les événements
--    manager (ouverture_controle, validation, correction_manager,
--    reouverture) et leurs motifs internes ne sont pas rendus ici.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_mes_corrections_caisse(p_shift_id uuid)
returns table (
  survenu_le        timestamptz,
  evenement         text,
  libelle           text,
  version_avant     int,
  version_apres     int,
  ecart_avant       numeric,
  ecart_apres       numeric,
  libelle_ecart     text,
  mon_motif         text,
  mon_commentaire   text,
  valeurs_avant     jsonb,
  valeurs_apres     jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as uid)
  select
    e.survenu_le,
    e.evenement,
    case e.evenement
      when 'confirmation_initiale' then 'Caisse confirmée et transmise au manager'
      when 'correction_employe'    then 'Saisie corrigée'
      when 'demande_correction'    then 'Erreur signalée après validation'
      else e.evenement
    end,
    e.version_avant,
    e.version_apres,
    e.ecart_avant,
    e.ecart_apres,
    -- L'événement est antérieur ou concomitant à la validation : le libellé
    -- reste celui d'un écart provisoire.
    public.fdj_libelle_ecart_employe(e.ecart_apres, false),
    e.motif,
    e.commentaire,
    e.valeurs_avant,
    e.valeurs_apres
  from public.fdj_caisse_evenements e
  join public.fdj_shifts s on s.id = e.shift_id
  cross join moi
  where moi.uid is not null
    and e.shift_id = p_shift_id
    and s.employee_id = moi.uid
    and e.auteur_id = moi.uid
    and e.evenement in ('confirmation_initiale', 'correction_employe', 'demande_correction')
  order by e.survenu_le asc;
$$;

comment on function public.fdj_mes_corrections_caisse(uuid) is
  'Mandat §4 — historique des corrections de l''appelant sur son propre quart. Aucun événement manager, aucun motif interne.';

-- ----------------------------------------------------------------------------
-- 6. MES SIGNALEMENTS APRÈS VALIDATION ET LEUR SUITE (§3.7)
--    `reponse_manager` EST destinée à l'employé : c'est la réponse qui lui est
--    faite, pas un commentaire interne. `traite_par` ne l'est pas.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_mes_demandes_correction(p_shift_id uuid default null)
returns table (
  demande_id       uuid,
  shift_id         uuid,
  cree_le          timestamptz,
  mon_message      text,
  statut           text,
  libelle_statut   text,
  traite_le        timestamptz,
  reponse_manager  text
)
language sql
stable
security definer
set search_path = ''
as $$
  with moi as (select (select auth.uid()) as uid)
  select
    d.id,
    d.shift_id,
    d.cree_le,
    d.message,
    d.statut,
    case d.statut
      when 'ouverte'                 then 'En attente de la réponse du manager'
      when 'refusee'                 then 'Demande refusée par le manager'
      when 'acceptee_reouverture'    then 'Caisse rouverte par le manager'
      when 'corrigee_par_manager'    then 'Corrigée par le manager'
      when 'orientee_regularisation' then 'Orientée vers une régularisation'
      else d.statut
    end,
    d.traite_le,
    d.reponse_manager
  from public.fdj_demandes_correction d
  cross join moi
  where moi.uid is not null
    and d.demandeur_id = moi.uid
    and (p_shift_id is null or d.shift_id = p_shift_id)
  order by d.cree_le desc;
$$;

comment on function public.fdj_mes_demandes_correction(uuid) is
  'Mandat §3.7 — signalements déposés par l''appelant et réponse du manager. N''expose pas l''identité du manager qui a traité.';

-- ----------------------------------------------------------------------------
-- 7. DROITS (§4) — ACL ÉCRITE, JAMAIS HÉRITÉE.
--    `create or replace` conserve l'ACL existante et, sur une base neuve,
--    l'`alter default privileges` de Supabase accorderait EXECUTE à `anon`.
--    Les révocations ci-dessous ne sont donc pas redondantes.
--    `revoke ... from public` ne retire jamais un grant nommé : `anon` est
--    révoqué explicitement.
-- ----------------------------------------------------------------------------

do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_libelle_ecart_employe(numeric, boolean)',
    'public.fdj_mes_quarts_fdj(int)',
    'public.fdj_ma_caisse(uuid)',
    'public.fdj_mes_comptages_caisse(uuid)',
    'public.fdj_mes_corrections_caisse(uuid)',
    'public.fdj_mes_demandes_correction(uuid)'
  ];
begin
  foreach v_sig in array v_signatures loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('grant execute on function %s to authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;

-- ============================================================================
-- RETOUR ARRIÈRE (Phase A)
--
--   drop function if exists public.fdj_mes_demandes_correction(uuid);
--   drop function if exists public.fdj_mes_corrections_caisse(uuid);
--   drop function if exists public.fdj_mes_comptages_caisse(uuid);
--   drop function if exists public.fdj_ma_caisse(uuid);
--   drop function if exists public.fdj_mes_quarts_fdj(int);
--   drop function if exists public.fdj_libelle_ecart_employe(numeric, boolean);
--
-- Condition d'arrêt : sûr tant que le front servi n'appelle pas encore ces
-- fonctions. Après la Phase B, les supprimer aveugle l'écran employé — il
-- faut d'abord rebasculer le front sur les accès directs.
-- ============================================================================
