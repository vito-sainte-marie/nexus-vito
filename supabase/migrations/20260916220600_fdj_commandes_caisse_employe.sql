-- ============================================================================
-- FDJ — Vague 1, Phase A (« ÉTENDRE ») — Commandes serveur de l'employé
--
-- Mandat « Refonte FDJ, Vague 1 », §3 (cycle de vie d'une caisse FDJ) et
-- §5.3 (« des commandes serveur distinctes »).
--
-- Cycle imposé :
--   brouillon → confirmée / transmise par l'employé
--             → éventuellement corrigée avant contrôle
--             → validée par le manager
--             → éventuellement rouverte ou régularisée (procédure distincte)
--
-- Cette migration crée les QUATRE commandes de la partie employé :
--   1. public.fdj_enregistrer_brouillon_caisse(...)      — §3.1
--   2. public.fdj_confirmer_caisse(...)                  — §3.2
--   3. public.fdj_corriger_caisse_confirmee(...)         — §3.4
--   4. public.fdj_signaler_erreur_apres_validation(...)  — §3.7
--
-- ainsi que les fonctions de calcul qu'elles utilisent, afin que le montant
-- de l'écart soit TOUJOURS établi par le serveur et jamais reçu du
-- navigateur (§5 : « imposée côté serveur et en base, pas seulement dans
-- l'interface »).
--
-- ---------------------------------------------------------------------------
-- PHASE A — AUCUNE RUPTURE DU FRONT SERVI
--
-- Rien n'est supprimé ni restreint ici. Les écritures directes actuelles de
-- NEXUS-FDJ-v1.html continuent de fonctionner à l'identique. Ces fonctions
-- s'ajoutent à côté ; elles ne seront utilisées qu'en Phase B (nouveau
-- front), et les accès directs ne seront fermés qu'en Phase C.
--
-- ---------------------------------------------------------------------------
-- ARBITRAGES DOCUMENTÉS (§ clause finale du mandat : documenter, ne pas
-- inventer)
--
-- (a) VOCABULAIRE DE `fdj_shifts.statut`.
--     La colonne n'accepte aujourd'hui que 'brouillon' et 'valide', et
--     'valide' y signifie historiquement « transmis par l'employé », PAS
--     « validé par le manager » (la validation manager vit dans
--     fdj_cash_controls.valide_par / valide_le). Le mandat interdit de dire
--     que l'employé « valide » (§3.2). Le cycle de vie canonique est donc
--     porté par fdj_cash_controls.statut ('brouillon' → 'confirmee' → …,
--     valeurs ajoutées par 20260916220100), et fdj_shifts.statut reste tenu
--     à jour à l'ancienne valeur 'valide' pour que le front servi et les
--     ~30 tests existants continuent de fonctionner sans modification.
--     Le renommage de cette valeur est un point de Phase C / Vague 2, pas de
--     cette vague.
--
-- (b) LE CALCUL EST REPRIS VERBATIM DE nexus-fdj-moteur.js.
--     Aucune formule n'est réinventée ici. Référence : nexus-fdj-moteur.js
--       calculerVentesJeu()  : qte = stock_initial + appro - stock_final
--                              valeur = qte * prix
--                              null si stock_initial OU stock_final est null
--       ventesGrattageTotal(): somme des valeurs non nulles
--       caisseGrattage()     : ventes_total - lots_payes    (null si lots null)
--       caisseAttendue()     : grattage + caisse_tirages + regularisations
--                              (null si grattage ou tirages null)
--       ecartCaisse()        : round((caisse_reelle - attendue) * 100) / 100
--                              (null si attendue ou caisse_reelle null)
--
-- (c) LE CHAMP « RÉGULARISATIONS » RESTE SAISI PAR L'EMPLOYÉ.
--     NEXUS-FDJ-v1.html:1914 expose aujourd'hui un champ « Régularisations »
--     que l'employé renseigne, et ce montant entre directement dans la
--     caisse attendue — donc réduit l'écart. Le §7 du mandat fait de la
--     régularisation un objet managérial distinct, mais demande aussi de ne
--     pas l'implémenter entièrement en Vague 1. Retirer le champ casserait
--     le front servi ; le laisser sans trace serait un angle mort. Choix
--     retenu : le paramètre est conservé à l'identique, mais toute valeur
--     non nulle est enregistrée explicitement dans fdj_caisse_evenements
--     (metadata->'regularisations_saisies_par_employe') pour que le manager
--     la voie comme une information de contrôle. L'indicateur d'alerte
--     correspondant est posé par la migration suivante (§3.5).
--
-- (d) LE RELEVÉ DE CLÔTURE EST PRODUIT PAR LE SERVEUR.
--     fdj_releves_cloture version 1 / 'validation_employe' est aujourd'hui
--     écrit par le navigateur (NEXUS-FDJ-v1.html:2162). La commande de
--     confirmation le produit désormais côté serveur, à partir des données
--     déjà enregistrées, avec la même sémantique (snapshot complet, jamais
--     une référence ; 23505 absorbé comme un rejeu, jamais une erreur ;
--     fdj_shifts.releve_cloture_statut renseigné). Le trigger existant
--     trg_fdj_sync_releve_apres_cash_control produit les versions suivantes
--     et n'est pas modifié.
--
-- AUCUNE DONNÉE EXISTANTE N'EST LUE, ÉCRITE NI CORRIGÉE PAR CETTE MIGRATION.
-- Elle ne crée que des fonctions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CALCULS — portage SQL des formules de nexus-fdj-moteur.js
-- ----------------------------------------------------------------------------

-- Valeur des ventes d'un jeu sur un quart. Renvoie NULL si l'un des deux
-- stocks manque : un jeu non compté ne vaut pas zéro, il ne vaut rien.
create or replace function public.fdj_ventes_jeu(
  p_stock_initial numeric,
  p_appro         numeric,
  p_stock_final   numeric,
  p_prix          numeric
)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
           when p_stock_initial is null or p_stock_final is null then null
           else (p_stock_initial + coalesce(p_appro, 0) - p_stock_final) * p_prix
         end;
$$;

comment on function public.fdj_ventes_jeu(numeric, numeric, numeric, numeric) is
  'Portage SQL de NexusFdjMoteur.calculerVentesJeu() — valeur uniquement. NULL si un stock manque.';

-- Recalcule intégralement la caisse d'un quart à partir des données déjà
-- enregistrées en base (fdj_shift_counts + fdj_reports) et des paramètres de
-- caisse. Le navigateur ne fournit JAMAIS ventes_grattage_valeur,
-- caisse_grattage, caisse_attendue ni ecart : ils sont établis ici.
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
begin
  -- ventesGrattageTotal() : somme des valeurs non nulles. coalesce(...,0)
  -- reproduit le `let total = 0` du moteur pour un quart sans aucun jeu
  -- compté (total = 0, jamais NULL).
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

  -- caisseGrattage()
  v_grattage := case when v_lots is null then null else v_ventes - v_lots end;

  -- caisseAttendue()
  v_attendue := case
                  when v_grattage is null or v_tirages is null then null
                  else v_grattage + v_tirages + v_regul
                end;

  -- ecartCaisse() — arrondi au centime, exactement comme le moteur.
  v_ecart := case
               when v_attendue is null or p_caisse_reelle is null then null
               else round((p_caisse_reelle - v_attendue)::numeric, 2)
             end;

  return jsonb_build_object(
    'ventes_grattage_valeur', v_ventes,
    'lots_payes_grattage',    v_lots,
    'caisse_tirages',         v_tirages,
    'caisse_grattage',        v_grattage,
    'regularisations',        v_regul,
    'caisse_attendue',        v_attendue,
    'caisse_reelle',          p_caisse_reelle,
    'ecart',                  v_ecart
  );
end;
$$;

comment on function public.fdj_calculer_caisse(uuid, numeric, numeric) is
  'Établit la caisse d''un quart côté serveur (portage de nexus-fdj-moteur.js). Le navigateur ne fournit jamais l''écart.';

-- ----------------------------------------------------------------------------
-- 2. CHAÎNE DE CONTINUITÉ — portage SQL de NexusFdjMoteur.chaineContinuite()
--    Nécessaire au caractère (definitif / provisoire) du relevé de clôture.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_chaine_continuite(
  p_site  text,
  p_date  date,
  p_quart text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prev       record;
  v_att_date   date;
  v_att_quart  text;
  v_manquants  jsonb := '[]'::jsonb;
  v_cur_date   date;
  v_cur_quart  text;
  v_garde      int := 0;
begin
  -- Dernier quart VALIDÉ strictement antérieur (même ordre que
  -- NEXUS-FDJ-v1.html::chargerDernierStockFinal).
  select s.date, s.quart
    into v_prev
    from public.fdj_shifts s
   where s.site = p_site
     and s.statut = 'valide'
     and (s.date < p_date or (s.date = p_date and s.quart < p_quart))
   order by s.date desc, s.quart desc
   limit 1;

  -- Aucun quart précédent : premier quart jamais compté. Ce n'est pas une
  -- rupture (le moteur le dit explicitement).
  if not found then
    return jsonb_build_object('rompue', false, 'manquants', '[]'::jsonb);
  end if;

  -- quartPrecedentAttendu()
  if p_quart = '2' then
    v_att_date := p_date; v_att_quart := '1';
  else
    v_att_date := p_date - 1; v_att_quart := '2';
  end if;

  if v_prev.date = v_att_date and v_prev.quart = v_att_quart then
    return jsonb_build_object('rompue', false, 'manquants', '[]'::jsonb);
  end if;

  -- quartSuivant() appliqué en boucle, bornes exclues.
  if v_prev.quart = '1' then
    v_cur_date := v_prev.date; v_cur_quart := '2';
  else
    v_cur_date := v_prev.date + 1; v_cur_quart := '1';
  end if;

  while v_garde < 2000
        and (v_cur_date < p_date or (v_cur_date = p_date and v_cur_quart < p_quart))
  loop
    v_manquants := v_manquants || jsonb_build_object('date', v_cur_date, 'quart', v_cur_quart);
    if v_cur_quart = '1' then
      v_cur_quart := '2';
    else
      v_cur_date := v_cur_date + 1; v_cur_quart := '1';
    end if;
    v_garde := v_garde + 1;
  end loop;

  return jsonb_build_object(
    'rompue',    jsonb_array_length(v_manquants) > 0,
    'manquants', v_manquants
  );
end;
$$;

comment on function public.fdj_chaine_continuite(text, date, text) is
  'Portage SQL de NexusFdjMoteur.chaineContinuite() — { rompue, manquants }. Recalculé à chaque appel, jamais persisté (règle du 16/08/2026).';

-- ----------------------------------------------------------------------------
-- 3. GARDE D'ACCÈS — identité, site, titulaire du quart (§5.3)
--    « Chaque opération doit vérifier : l'identité ; le rôle ; le site ;
--      le titulaire du quart ; l'état courant ; la transition demandée ;
--      l'idempotence ; les conflits de concurrence. »
--    Cette fonction couvre identité + site + titulaire. L'état courant et la
--    transition sont vérifiés par chaque commande, qui seule les connaît.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_quart_de_l_employe(p_shift_id uuid)
returns public.fdj_shifts
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid   uuid;
  v_site  text;
  v_shift public.fdj_shifts;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_shift_id is null then
    raise exception 'Identifiant de quart FDJ manquant.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Le site est lu EN BASE depuis employees, jamais reçu du client (§5.2).
  select e.site_id into v_site from public.employees e where e.id = v_uid;
  if v_site is null then
    raise exception 'Utilisateur sans rattachement de site : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_shift from public.fdj_shifts s where s.id = p_shift_id;
  if not found then
    raise exception 'Quart FDJ introuvable.' using errcode = 'no_data_found';
  end if;

  if v_shift.site is distinct from v_site then
    raise exception 'Ce quart FDJ appartient à un autre site.'
      using errcode = 'insufficient_privilege';
  end if;

  -- §5.1 : « modifier la caisse d'un collègue » est interdit. Un quart sans
  -- titulaire (employee_id NULL, cas historique) n'est appropriable par
  -- personne : il relève d'une reprise managériale explicite.
  if v_shift.employee_id is null then
    raise exception 'Ce quart FDJ n''a pas de responsable enregistré : une reprise managériale explicite est nécessaire.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_shift.employee_id is distinct from v_uid then
    raise exception 'Ce quart FDJ est sous la responsabilité d''un autre employé.'
      using errcode = 'insufficient_privilege';
  end if;

  return v_shift;
end;
$$;

comment on function public.fdj_quart_de_l_employe(uuid) is
  'Garde commune aux commandes employé : identité authentifiée, site lu en base, titulaire du quart. Lève une exception sinon.';

-- ----------------------------------------------------------------------------
-- 4. ENREGISTREMENT DES SAISIES — partie commune brouillon / confirmation /
--    correction. Écrit fdj_shift_counts et fdj_reports, jamais la caisse.
--    p_comptages : [ { "game_id": uuid, "stock_initial": n|null,
--                      "appro": n, "stock_final": n|null }, … ]
--    Un game_id absent du tableau n'est PAS effacé (saisie partielle).
-- ----------------------------------------------------------------------------

create or replace function public.fdj_ecrire_saisies_caisse(
  p_shift_id             uuid,
  p_site                 text,
  p_auteur_id            uuid,
  p_comptages            jsonb,
  p_lots_payes_grattage  numeric,
  p_caisse_tirages       numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ligne jsonb;
  v_prix  numeric;
begin
  if p_comptages is not null and jsonb_typeof(p_comptages) = 'array' then
    for v_ligne in select * from jsonb_array_elements(p_comptages)
    loop
      -- Le prix vient TOUJOURS du catalogue, jamais du navigateur.
      select g.prix into v_prix
        from public.fdj_games g
       where g.id = (v_ligne->>'game_id')::uuid
         and g.site = p_site;
      if not found then
        raise exception 'Jeu FDJ inconnu pour ce site : %', v_ligne->>'game_id'
          using errcode = 'invalid_parameter_value';
      end if;

      insert into public.fdj_shift_counts as c (
        site, shift_id, game_id, stock_initial, appro, stock_final,
        ventes_qte, ventes_valeur, updated_at
      )
      values (
        p_site,
        p_shift_id,
        (v_ligne->>'game_id')::uuid,
        nullif(v_ligne->>'stock_initial', '')::numeric,
        coalesce(nullif(v_ligne->>'appro', '')::numeric, 0),
        nullif(v_ligne->>'stock_final', '')::numeric,
        case
          when nullif(v_ligne->>'stock_initial', '') is null
            or nullif(v_ligne->>'stock_final', '')   is null then null
          else (v_ligne->>'stock_initial')::numeric
               + coalesce(nullif(v_ligne->>'appro', '')::numeric, 0)
               - (v_ligne->>'stock_final')::numeric
        end,
        public.fdj_ventes_jeu(
          nullif(v_ligne->>'stock_initial', '')::numeric,
          coalesce(nullif(v_ligne->>'appro', '')::numeric, 0),
          nullif(v_ligne->>'stock_final', '')::numeric,
          v_prix
        ),
        now()
      )
      on conflict (shift_id, game_id) do update
        set stock_initial = excluded.stock_initial,
            appro         = excluded.appro,
            stock_final   = excluded.stock_final,
            ventes_qte    = excluded.ventes_qte,
            ventes_valeur = excluded.ventes_valeur,
            updated_at    = now();
    end loop;
  end if;

  -- Deux rapports distincts, comme le front servi (upsert par
  -- (shift_id, type_rapport)).
  insert into public.fdj_reports (site, shift_id, type_rapport, lots_payes_grattage, saisi_par)
  values (p_site, p_shift_id, 'journalier', p_lots_payes_grattage, p_auteur_id)
  on conflict (shift_id, type_rapport) do update
    set lots_payes_grattage = excluded.lots_payes_grattage,
        saisi_par           = excluded.saisi_par;

  insert into public.fdj_reports (site, shift_id, type_rapport, caisse_tirages, saisi_par)
  values (p_site, p_shift_id, 'temps_reel', p_caisse_tirages, p_auteur_id)
  on conflict (shift_id, type_rapport) do update
    set caisse_tirages = excluded.caisse_tirages,
        saisi_par      = excluded.saisi_par;
end;
$$;

comment on function public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric) is
  'Écrit les comptages par jeu et les deux rapports. Interne aux commandes de caisse : jamais exposée directement.';

-- ----------------------------------------------------------------------------
-- 5. COMMANDE §3.1 — « Enregistrer mon brouillon »
--    « L'employé peut saisir, compléter, modifier librement et enregistrer
--      sans transmettre. Ce n'est ni une confirmation ni une validation. »
--    §4 : avant confirmation, la réponse ne présente AUCUN écart. Elle ne
--    renvoie que des informations de saisie.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_enregistrer_brouillon_caisse(
  p_shift_id            uuid,
  p_comptages           jsonb default null,
  p_lots_payes_grattage numeric default null,
  p_caisse_tirages      numeric default null,
  p_caisse_reelle       numeric default null,
  p_regularisations     numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_uid   uuid := (select auth.uid());
  v_cash  public.fdj_cash_controls;
  v_calc  jsonb;
begin
  v_shift := public.fdj_quart_de_l_employe(p_shift_id);

  -- État courant : un brouillon ne s'enregistre que sur un quart encore
  -- ouvert. Après confirmation, la commande à utiliser est
  -- fdj_corriger_caisse_confirmee() — qui, elle, exige un motif.
  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id;
  if found and v_cash.confirme_le is not null then
    return jsonb_build_object(
      'enregistre', false,
      'motif', 'caisse_deja_confirmee',
      'message', 'Cette caisse a déjà été confirmée et transmise au manager. Utilisez « Corriger ma saisie ».'
    );
  end if;
  if v_shift.statut <> 'brouillon' then
    return jsonb_build_object(
      'enregistre', false,
      'motif', 'quart_non_modifiable',
      'message', 'Ce quart n''est plus en brouillon.'
    );
  end if;

  perform public.fdj_ecrire_saisies_caisse(
    p_shift_id, v_shift.site, v_uid, p_comptages, p_lots_payes_grattage, p_caisse_tirages
  );

  -- La caisse est calculée pour être ENREGISTRÉE (le manager doit pouvoir
  -- reprendre un brouillon cohérent), mais elle n'est PAS renvoyée :
  -- §3.1/§4 — avant la première confirmation, aucun résultat n'est présenté
  -- à l'employé comme un écart établi.
  v_calc := public.fdj_calculer_caisse(p_shift_id, p_caisse_reelle, p_regularisations);

  insert into public.fdj_cash_controls as c (
    site, shift_id, ventes_grattage_valeur, lots_payes_grattage, caisse_grattage,
    caisse_tirages, regularisations, caisse_attendue, caisse_reelle, ecart,
    statut, saisi_par, updated_at
  )
  values (
    v_shift.site, p_shift_id,
    (v_calc->>'ventes_grattage_valeur')::numeric,
    (v_calc->>'lots_payes_grattage')::numeric,
    (v_calc->>'caisse_grattage')::numeric,
    (v_calc->>'caisse_tirages')::numeric,
    (v_calc->>'regularisations')::numeric,
    (v_calc->>'caisse_attendue')::numeric,
    (v_calc->>'caisse_reelle')::numeric,
    (v_calc->>'ecart')::numeric,
    'brouillon', v_uid, now()
  )
  on conflict (shift_id) do update
    set ventes_grattage_valeur = excluded.ventes_grattage_valeur,
        lots_payes_grattage    = excluded.lots_payes_grattage,
        caisse_grattage        = excluded.caisse_grattage,
        caisse_tirages         = excluded.caisse_tirages,
        regularisations        = excluded.regularisations,
        caisse_attendue        = excluded.caisse_attendue,
        caisse_reelle          = excluded.caisse_reelle,
        ecart                  = excluded.ecart,
        statut                 = 'brouillon',
        saisi_par              = excluded.saisi_par,
        updated_at             = now()
  -- caisse_reelle_origine / ecart_origine ne sont JAMAIS posés ici : le
  -- constat d'origine naît à la confirmation, pas au brouillon.
  where c.confirme_le is null;

  -- Trace simple et non probante (un brouillon n'est pas un événement de
  -- cycle de vie — le journal fdj_caisse_evenements ne reçoit que des faits
  -- opposables). Reprend l'action déjà utilisée par le front servi.
  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, nouvelle_valeur)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', p_shift_id,
    'quart_brouillon_enregistre', v_uid,
    jsonb_build_object('saisie_enregistree', true)
  );

  return jsonb_build_object(
    'enregistre', true,
    'shift_id',   p_shift_id,
    'statut',     'brouillon',
    'message',    'Votre saisie est enregistrée en brouillon. Elle n''a pas encore été transmise au manager.'
  );
end;
$$;

comment on function public.fdj_enregistrer_brouillon_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) is
  'Mandat §3.1 — enregistre un brouillon de caisse. Ne confirme rien, ne transmet rien, et ne renvoie aucun écart.';

-- ----------------------------------------------------------------------------
-- 6. COMMANDE §3.2 — « Confirmer ma caisse et la transmettre au manager »
--    « L'employé ne "valide" jamais sa caisse. »
--    La confirmation initiale est un ÉVÉNEMENT IMMUABLE : auteur, date et
--    heure, valeurs confirmées, écart provisoire calculé, numéro de version.
--    §3.3 : l'écart provisoire est renvoyé à l'employé dès cet instant.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_confirmer_caisse(
  p_shift_id            uuid,
  p_comptages           jsonb default null,
  p_lots_payes_grattage numeric default null,
  p_caisse_tirages      numeric default null,
  p_caisse_reelle       numeric default null,
  p_regularisations     numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift   public.fdj_shifts;
  v_uid     uuid := (select auth.uid());
  v_cash    public.fdj_cash_controls;
  v_calc    jsonb;
  v_chaine  jsonb;
  v_statut_releve text;
  v_nom     text;
  v_role    text;
  v_si jsonb; v_ap jsonb; v_sf jsonb; v_ventes jsonb;
begin
  v_shift := public.fdj_quart_de_l_employe(p_shift_id);

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id;

  -- IDEMPOTENCE (§5.3) : reconfirmer ne crée jamais une deuxième
  -- confirmation. Le double-clic et le rejeu réseau renvoient le même
  -- résultat, sans réécrire la preuve d'origine.
  if found and v_cash.confirme_le is not null then
    return jsonb_build_object(
      'confirme', true,
      'idempotent', true,
      'motif', 'caisse_deja_confirmee',
      'shift_id', p_shift_id,
      'version', v_cash.version,
      'confirme_le', v_cash.confirme_le,
      'ecart_provisoire', case when v_cash.valide_le is null then v_cash.ecart else null end,
      'ecart_retenu',     case when v_cash.valide_le is null then null else v_cash.ecart end,
      'statut', v_cash.statut
    );
  end if;

  if v_shift.statut <> 'brouillon' then
    return jsonb_build_object(
      'confirme', false,
      'motif', 'quart_non_confirmable',
      'message', 'Ce quart n''est plus en brouillon.'
    );
  end if;

  perform public.fdj_ecrire_saisies_caisse(
    p_shift_id, v_shift.site, v_uid, p_comptages, p_lots_payes_grattage, p_caisse_tirages
  );

  v_calc := public.fdj_calculer_caisse(p_shift_id, p_caisse_reelle, p_regularisations);

  -- On ne confirme pas une caisse qu'on ne sait pas calculer : sans lots
  -- payés, sans caisse tirages ou sans caisse réelle, l'écart est NULL et
  -- la « confirmation » ne confirmerait rien.
  if (v_calc->>'ecart') is null then
    return jsonb_build_object(
      'confirme', false,
      'motif', 'saisie_incomplete',
      'message', 'Il manque une information pour établir votre caisse (lots payés, caisse tirages ou caisse réelle).'
    );
  end if;

  -- Caisse confirmée. caisse_reelle_origine / ecart_origine sont posés ICI,
  -- une seule fois : c'est le constat d'origine, protégé par le trigger
  -- fdj_cash_controls_proteger_origine_trg, et jamais réécrit ensuite.
  insert into public.fdj_cash_controls as c (
    site, shift_id, ventes_grattage_valeur, lots_payes_grattage, caisse_grattage,
    caisse_tirages, regularisations, caisse_attendue, caisse_reelle, ecart,
    caisse_reelle_origine, ecart_origine,
    statut, saisi_par, confirme_par, confirme_le, version, nb_corrections, updated_at
  )
  values (
    v_shift.site, p_shift_id,
    (v_calc->>'ventes_grattage_valeur')::numeric,
    (v_calc->>'lots_payes_grattage')::numeric,
    (v_calc->>'caisse_grattage')::numeric,
    (v_calc->>'caisse_tirages')::numeric,
    (v_calc->>'regularisations')::numeric,
    (v_calc->>'caisse_attendue')::numeric,
    (v_calc->>'caisse_reelle')::numeric,
    (v_calc->>'ecart')::numeric,
    (v_calc->>'caisse_reelle')::numeric,
    (v_calc->>'ecart')::numeric,
    'confirmee', v_uid, v_uid, now(), 1, 0, now()
  )
  on conflict (shift_id) do update
    set ventes_grattage_valeur = excluded.ventes_grattage_valeur,
        lots_payes_grattage    = excluded.lots_payes_grattage,
        caisse_grattage        = excluded.caisse_grattage,
        caisse_tirages         = excluded.caisse_tirages,
        regularisations        = excluded.regularisations,
        caisse_attendue        = excluded.caisse_attendue,
        caisse_reelle          = excluded.caisse_reelle,
        ecart                  = excluded.ecart,
        -- coalesce : si un constat d'origine existe déjà (brouillon repris
        -- d'un ancien parcours), il n'est pas réécrit.
        caisse_reelle_origine  = coalesce(c.caisse_reelle_origine, excluded.caisse_reelle_origine),
        ecart_origine          = coalesce(c.ecart_origine, excluded.ecart_origine),
        statut                 = 'confirmee',
        saisi_par              = excluded.saisi_par,
        confirme_par           = excluded.confirme_par,
        confirme_le            = now(),
        version                = 1,
        nb_corrections         = 0,
        updated_at             = now()
  where c.confirme_le is null;

  -- ORDRE VOULU — NE PAS INTERVERTIR AVEC L'UPSERT CI-DESSUS.
  -- Le trigger existant trg_fdj_sync_releve_apres_cash_control se déclenche
  -- sur tout UPDATE de caisse_reelle / caisse_attendue / ecart /
  -- ventes_grattage_valeur / regularisations, mais sort immédiatement si
  -- fdj_shifts.statut <> 'valide'. En laissant le quart en 'brouillon'
  -- pendant l'upsert de confirmation, on évite qu'il fabrique une version de
  -- relevé parasite AVANT la version 1 écrite plus bas. Le quart ne passe à
  -- 'valide' qu'ensuite, et les UPDATE suivants (corrections) le trouveront
  -- alors bien en 'valide', ce qui est précisément le comportement attendu.
  -- Le quart passe à 'valide' : vocabulaire historique de fdj_shifts,
  -- lu « transmis par l'employé » (arbitrage (a) en tête de fichier).
  update public.fdj_shifts
     set statut = 'valide', valide_le = now()
   where id = p_shift_id
     and statut = 'brouillon';

  -- ÉVÉNEMENT IMMUABLE de confirmation initiale (§3.2). Le journal
  -- fdj_caisse_evenements refuse tout UPDATE/DELETE (trigger de la
  -- migration 20260916220200) et n'accepte qu'UNE confirmation_initiale par
  -- caisse (index unique partiel).
  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id;

  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, valeurs_apres, ecart_apres, metadata
  )
  values (
    v_shift.site, v_cash.id, p_shift_id, 'confirmation_initiale', v_uid, 'employe',
    v_shift.employee_id, v_cash.confirme_le,
    null, 1, 0,
    'brouillon', 'confirmee',
    v_calc, (v_calc->>'ecart')::numeric,
    jsonb_build_object(
      'regularisations_saisies_par_employe', (v_calc->>'regularisations')::numeric,
      'source', 'fdj_confirmer_caisse'
    )
  );

  -- Relevé de clôture version 1 (arbitrage (d)). Snapshot complet, construit
  -- à partir des lignes qui viennent d'être enregistrées.
  select coalesce(jsonb_object_agg(game_id, stock_initial), '{}'::jsonb),
         coalesce(jsonb_object_agg(game_id, appro), '{}'::jsonb),
         coalesce(jsonb_object_agg(game_id, stock_final), '{}'::jsonb),
         coalesce(jsonb_object_agg(game_id, jsonb_build_object('qte', ventes_qte, 'valeur', ventes_valeur)), '{}'::jsonb)
    into v_si, v_ap, v_sf, v_ventes
    from public.fdj_shift_counts where shift_id = p_shift_id;

  v_chaine := public.fdj_chaine_continuite(v_shift.site, v_shift.date, v_shift.quart);
  -- statutRelevecloture(1, ecart, 'validation_employe')
  v_statut_releve := case
                       when (v_calc->>'ecart')::numeric = 0 then 'conforme'
                       else 'valide_avec_ecart'
                     end;
  select e.nom, e.role into v_nom, v_role from public.employees e where e.id = v_uid;

  begin
    insert into public.fdj_releves_cloture (
      site, shift_id, date, quart, employee_id, version_num, type_version, cree_par,
      stock_initial_par_jeu, appro_par_jeu, stock_final_par_jeu, ventes_par_jeu,
      ventes_grattage_valeur, lots_payes_grattage, caisse_tirages, regularisations,
      caisse_attendue, caisse_reelle, ecart, anomalie_chaine, caractere, statut, signature
    )
    values (
      v_shift.site, p_shift_id, v_shift.date, v_shift.quart, v_shift.employee_id,
      1, 'validation_employe', v_uid,
      v_si, v_ap, v_sf, v_ventes,
      (v_calc->>'ventes_grattage_valeur')::numeric,
      (v_calc->>'lots_payes_grattage')::numeric,
      (v_calc->>'caisse_tirages')::numeric,
      (v_calc->>'regularisations')::numeric,
      (v_calc->>'caisse_attendue')::numeric,
      (v_calc->>'caisse_reelle')::numeric,
      (v_calc->>'ecart')::numeric,
      jsonb_build_object(
        'chaine_interrompue', (v_chaine->>'rompue')::boolean,
        'manquants', v_chaine->'manquants',
        'continuite_stock_a_verifier', false
      ),
      -- caractereRelevecloture({ chaineInterrompue, continuiteStockAVerifier:false })
      case when (v_chaine->>'rompue')::boolean then 'provisoire' else 'definitif' end,
      v_statut_releve,
      jsonb_build_object(
        'utilisateur_id', v_uid,
        'nom', coalesce(v_nom, 'NEXUS'),
        'role', coalesce(v_role, 'employe'),
        'date_heure', now(),
        'version_donnees', coalesce(v_shift.version, 1),
        'quart_id', p_shift_id,
        'heure_ouverture_quart', v_shift.ouvert_le,
        'message_confirmation', 'Caisse confirmée et transmise au manager. Le résultat reste provisoire tant que le manager ne l''a pas contrôlée.'
      )
    );
    update public.fdj_shifts set releve_cloture_statut = 'ok' where id = p_shift_id;
  exception
    when unique_violation then
      -- Rejeu : une validation employé existe déjà pour ce quart. Ce n'est
      -- jamais une vraie erreur (même règle que NEXUS-FDJ-v1.html:2200).
      update public.fdj_shifts set releve_cloture_statut = 'ok' where id = p_shift_id;
  end;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, nouvelle_valeur)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_cash.id,
    'fdj_caisse_confirmee_par_employe', v_uid,
    jsonb_build_object('version', 1, 'ecart_provisoire', (v_calc->>'ecart')::numeric)
  );

  -- §3.3 — l'employé voit son écart provisoire dès la confirmation.
  return jsonb_build_object(
    'confirme', true,
    'idempotent', false,
    'shift_id', p_shift_id,
    'version', 1,
    'confirme_le', v_cash.confirme_le,
    'statut', 'confirmee',
    'ecart_provisoire', (v_calc->>'ecart')::numeric,
    'en_attente_controle_manager', true,
    'message', 'Cette caisse reste en attente du contrôle du manager.'
  );
end;
$$;

comment on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) is
  'Mandat §3.2/§3.3 — « Confirmer ma caisse et la transmettre au manager ». Événement immuable, idempotent, renvoie l''écart provisoire.';

-- ----------------------------------------------------------------------------
-- 7. COMMANDE §3.4 — « Corriger ma saisie »
--    Tant que le manager n'a pas validé, l'employé peut corriger. Chaque
--    correction laisse une trace complète : auteur, date et heure, état de
--    la caisse, version précédente, nouvelle version, anciennes valeurs,
--    nouvelles valeurs, écart avant, écart après, motif, date de
--    confirmation initiale, nombre total de corrections.
--    La preuve de la première confirmation n'est JAMAIS écrasée.
-- ----------------------------------------------------------------------------

create or replace function public.fdj_corriger_caisse_confirmee(
  p_shift_id            uuid,
  p_motif               text,
  p_commentaire         text default null,
  p_comptages           jsonb default null,
  p_lots_payes_grattage numeric default null,
  p_caisse_tirages      numeric default null,
  p_caisse_reelle       numeric default null,
  p_regularisations     numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift  public.fdj_shifts;
  v_uid    uuid := (select auth.uid());
  v_avant  public.fdj_cash_controls;
  v_calc   jsonb;
  v_valeurs_avant jsonb;
  v_lots   numeric;
  v_tir    numeric;
begin
  v_shift := public.fdj_quart_de_l_employe(p_shift_id);

  if p_motif is null or length(btrim(p_motif)) < 3 then
    raise exception 'Un motif d''au moins 3 caractères est obligatoire pour corriger une caisse confirmée.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_avant from public.fdj_cash_controls c where c.shift_id = p_shift_id for update;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  -- ÉTAT COURANT ET TRANSITION (§5.3)
  if v_avant.confirme_le is null then
    return jsonb_build_object(
      'corrige', false,
      'motif', 'caisse_non_confirmee',
      'message', 'Cette caisse n''a pas encore été confirmée : utilisez « Enregistrer mon brouillon ».'
    );
  end if;

  -- §5.1 : « modifier une caisse validée » est interdit à l'employé. C'est
  -- LE défaut que corrige cette vague : fdj_corriger_caisse_employe() ne
  -- vérifiait jamais valide_par / valide_le.
  if v_avant.valide_le is not null or v_avant.valide_par is not null then
    return jsonb_build_object(
      'corrige', false,
      'motif', 'caisse_validee',
      'message', 'Cette caisse a été validée par le manager. Utilisez « Signaler une erreur après validation ».'
    );
  end if;

  -- Valeurs AVANT, figées avant toute écriture.
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

  -- Paramètres omis (NULL) = inchangés. Un employé qui ne corrige que sa
  -- caisse réelle n'efface pas ses rapports.
  v_lots := coalesce(p_lots_payes_grattage, v_avant.lots_payes_grattage);
  v_tir  := coalesce(p_caisse_tirages,      v_avant.caisse_tirages);

  perform public.fdj_ecrire_saisies_caisse(
    p_shift_id, v_shift.site, v_uid, p_comptages, v_lots, v_tir
  );

  v_calc := public.fdj_calculer_caisse(
    p_shift_id,
    coalesce(p_caisse_reelle,   v_avant.caisse_reelle),
    coalesce(p_regularisations, v_avant.regularisations)
  );

  -- Les GUC lues par le trigger existant trg_fdj_sync_releve_apres_cash_control
  -- pour produire la version suivante du relevé de clôture avec le bon
  -- type_version ('correction_employe') et le motif réel.
  perform set_config('nexus.fdj_correction_employe', 'true', true);
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
         -- caisse_reelle_origine et ecart_origine ne figurent PAS ici :
         -- la preuve de la première confirmation n'est jamais écrasée.
         version                = v_avant.version + 1,
         nb_corrections         = v_avant.nb_corrections + 1,
         derniere_correction_le = now(),
         updated_at             = now()
   where shift_id = p_shift_id;

  perform set_config('nexus.fdj_correction_employe', 'false', true);

  -- Trace complète exigée par le §3.4 — chaque élément de la liste y figure.
  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, valeurs_avant, valeurs_apres,
    ecart_avant, ecart_apres, motif, commentaire, metadata
  )
  values (
    v_shift.site, v_avant.id, p_shift_id, 'correction_employe', v_uid, 'employe',
    v_shift.employee_id, v_avant.confirme_le,
    v_avant.version, v_avant.version + 1, v_avant.nb_corrections + 1,
    v_avant.statut, v_avant.statut,
    v_valeurs_avant, v_calc,
    v_avant.ecart, (v_calc->>'ecart')::numeric,
    btrim(p_motif), nullif(btrim(coalesce(p_commentaire, '')), ''),
    jsonb_build_object(
      'controle_manager_deja_ouvert', v_avant.controle_le is not null,
      'delai_depuis_confirmation_secondes',
        extract(epoch from (now() - v_avant.confirme_le))::bigint,
      'source', 'fdj_corriger_caisse_confirmee'
    )
  );

  -- Trace historique conservée dans fdj_corrections, comme l'ancienne
  -- fdj_corriger_caisse_employe(), pour que les écrans manager existants
  -- continuent de voir la correction pendant la bascule.
  if (v_calc->>'caisse_reelle')::numeric is distinct from v_avant.caisse_reelle then
    insert into public.fdj_corrections (
      site, shift_id, game_id, correction_type, old_value, new_value,
      reason_code, commentaire, created_by
    )
    values (
      v_shift.site, p_shift_id, null, 'caisse_reelle',
      v_avant.caisse_reelle, (v_calc->>'caisse_reelle')::numeric,
      btrim(p_motif), nullif(btrim(coalesce(p_commentaire, '')), ''), v_uid
    );
  end if;

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, ancienne_valeur, nouvelle_valeur, motif)
  values (
    v_shift.site, p_shift_id, 'fdj_cash_control', v_avant.id,
    'fdj_caisse_corrigee_par_employe', v_uid,
    v_valeurs_avant, v_calc, btrim(p_motif)
  );

  return jsonb_build_object(
    'corrige', true,
    'shift_id', p_shift_id,
    'version_precedente', v_avant.version,
    'version', v_avant.version + 1,
    'nb_corrections', v_avant.nb_corrections + 1,
    'confirme_le', v_avant.confirme_le,
    'ecart_avant', v_avant.ecart,
    'ecart_provisoire', (v_calc->>'ecart')::numeric,
    'en_attente_controle_manager', true,
    'message', 'Cette caisse reste en attente du contrôle du manager.'
  );
end;
$$;

comment on function public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric) is
  'Mandat §3.4 — « Corriger ma saisie ». Refusée après validation manager. Trace complète dans fdj_caisse_evenements.';

-- ----------------------------------------------------------------------------
-- 8. COMMANDE §3.7 — « Signaler une erreur après validation »
--    « Elle ne modifie aucune valeur validée, crée une demande horodatée,
--      conserve le message, informe le manager. »
-- ----------------------------------------------------------------------------

create or replace function public.fdj_signaler_erreur_apres_validation(
  p_shift_id uuid,
  p_message  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift   public.fdj_shifts;
  v_uid     uuid := (select auth.uid());
  v_cash    public.fdj_cash_controls;
  v_demande public.fdj_demandes_correction;
  v_ouverte uuid;
begin
  v_shift := public.fdj_quart_de_l_employe(p_shift_id);

  if p_message is null or length(btrim(p_message)) < 5 then
    raise exception 'Merci de décrire l''erreur en au moins 5 caractères.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_cash from public.fdj_cash_controls c where c.shift_id = p_shift_id;
  if not found then
    raise exception 'Aucune caisse enregistrée pour ce quart.' using errcode = 'no_data_found';
  end if;

  -- Cette action n'existe qu'APRÈS validation. Avant, la bonne action est
  -- « Corriger ma saisie » — ne pas proposer deux chemins pour le même geste.
  if v_cash.valide_le is null then
    return jsonb_build_object(
      'signale', false,
      'motif', 'caisse_non_validee',
      'message', 'Cette caisse n''a pas encore été validée par le manager : utilisez « Corriger ma saisie ».'
    );
  end if;

  -- Idempotence (§5.3) : une seule demande ouverte à la fois pour une même
  -- caisse et un même demandeur. Le rejeu renvoie la demande existante.
  select id into v_ouverte
    from public.fdj_demandes_correction
   where cash_control_id = v_cash.id
     and demandeur_id = v_uid
     and statut = 'ouverte'
   limit 1;

  if v_ouverte is not null then
    return jsonb_build_object(
      'signale', true,
      'idempotent', true,
      'demande_id', v_ouverte,
      'message', 'Votre signalement est déjà enregistré et attend la réponse du manager.'
    );
  end if;

  insert into public.fdj_demandes_correction (
    site, cash_control_id, shift_id, demandeur_id, employe_responsable_id,
    message, version_caisse_au_signalement, ecart_au_signalement,
    valide_le_au_signalement, statut
  )
  values (
    v_shift.site, v_cash.id, p_shift_id, v_uid, v_shift.employee_id,
    btrim(p_message), v_cash.version, v_cash.ecart, v_cash.valide_le, 'ouverte'
  )
  returning * into v_demande;

  -- AUCUNE valeur validée n'est modifiée : l'événement est enregistré au
  -- journal, la caisse reste telle quelle.
  insert into public.fdj_caisse_evenements (
    site, cash_control_id, shift_id, evenement, auteur_id, auteur_role,
    employe_responsable_id, confirmation_initiale_le,
    version_avant, version_apres, nb_corrections_apres,
    statut_avant, statut_apres, ecart_avant, ecart_apres, commentaire, metadata
  )
  values (
    v_shift.site, v_cash.id, p_shift_id, 'demande_correction', v_uid, 'employe',
    v_shift.employee_id, v_cash.confirme_le,
    v_cash.version, v_cash.version, v_cash.nb_corrections,
    v_cash.statut, v_cash.statut, v_cash.ecart, v_cash.ecart,
    btrim(p_message),
    jsonb_build_object('demande_id', v_demande.id, 'source', 'fdj_signaler_erreur_apres_validation')
  );

  insert into public.fdj_audit_log (site, shift_id, entite_type, entite_id, action, acteur_id, nouvelle_valeur, motif)
  values (
    v_shift.site, p_shift_id, 'fdj_demande_correction', v_demande.id,
    'fdj_erreur_signalee_apres_validation', v_uid,
    jsonb_build_object('demande_id', v_demande.id, 'statut', 'ouverte'),
    btrim(p_message)
  );

  return jsonb_build_object(
    'signale', true,
    'idempotent', false,
    'demande_id', v_demande.id,
    'cree_le', v_demande.cree_le,
    'message', 'Votre signalement est transmis au manager. Aucune valeur validée n''a été modifiée.'
  );
end;
$$;

comment on function public.fdj_signaler_erreur_apres_validation(uuid, text) is
  'Mandat §3.7 — « Signaler une erreur après validation ». Ne modifie aucune valeur validée : crée une demande horodatée.';

-- ----------------------------------------------------------------------------
-- 9. DROITS (§4) — ACL ÉCRITE, JAMAIS HÉRITÉE
--    « droits révoqués pour anon et PUBLIC ; EXECUTE aux seuls rôles
--      nécessaires ». REVOKE … FROM PUBLIC ne ferme pas anon : Supabase
--      accorde EXECUTE par des grants nommés — anon est donc révoqué
--      explicitement, à chaque fonction.
--
--    DEUX LISTES, ET NON UNE.
--    Le §4 exige « EXECUTE aux seuls rôles nécessaires » et « aucune donnée
--    de collègue ni d'autre site ». Trois de ces fonctions LISENT des lignes
--    à partir d'un identifiant reçu en paramètre, sans vérifier que
--    l'appelant a quoi que ce soit à voir avec elles :
--
--      fdj_calculer_caisse(shift_id, …)   lit fdj_shift_counts, fdj_reports
--                                          et fdj_games du quart désigné
--      fdj_chaine_continuite(site, …)      lit la chaîne d'un site désigné
--      fdj_ecrire_saisies_caisse(…)        écrit les saisies d'un quart désigné
--
--    Ouvertes à `authenticated`, elles rendraient les chiffres d'un collègue
--    ou d'un autre site à qui devinerait un UUID de quart — et l'ordre de
--    grandeur d'un site voisin sans rien deviner du tout, puisque
--    fdj_chaine_continuite se contente d'un nom de site, d'une date et d'un
--    numéro de quart. Faire reposer une confidentialité sur le fait qu'un
--    UUID est difficile à deviner n'est pas une garde, c'est un pari.
--
--    Elles restent donc INTERNES : `service_role` seul. Cela n'enlève rien
--    aux écrans, parce que les commandes exposées ci-dessous sont toutes
--    SECURITY DEFINER et les appellent avec les droits du propriétaire,
--    APRÈS avoir vérifié l'identité par fdj_quart_de_l_employe().
--
--    fdj_ventes_jeu() reste exposée : c'est de l'arithmétique sur ses quatre
--    paramètres, elle ne lit aucune table et ne révèle donc rien.
-- ----------------------------------------------------------------------------

-- 9.a — Commandes et calculs exposés à l'employé authentifié.
--       Chacune vérifie elle-même l'identité, le site et le titulaire du
--       quart : le droit d'appeler n'est pas le droit d'agir.
do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_ventes_jeu(numeric, numeric, numeric, numeric)',
    'public.fdj_quart_de_l_employe(uuid)',
    'public.fdj_enregistrer_brouillon_caisse(uuid, jsonb, numeric, numeric, numeric, numeric)',
    'public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric)',
    'public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric)',
    'public.fdj_signaler_erreur_apres_validation(uuid, text)'
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

-- 9.b — Fonctions internes : aucun rôle du navigateur ne les appelle.
--       `authenticated` est révoqué EXPLICITEMENT, et pas seulement PUBLIC :
--       sur une base neuve, l'alter default privileges de Supabase accorde
--       EXECUTE par grants nommés, qu'un revoke from public ne retire pas.
do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_calculer_caisse(uuid, numeric, numeric)',
    'public.fdj_chaine_continuite(text, date, text)',
    'public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric)'
  ];
begin
  foreach v_sig in array v_signatures loop
    execute format('revoke all on function %s from public', v_sig);
    execute format('revoke all on function %s from anon', v_sig);
    execute format('revoke all on function %s from authenticated', v_sig);
    execute format('grant execute on function %s to service_role', v_sig);
  end loop;
end;
$$;

-- ============================================================================
-- RETOUR ARRIÈRE (Phase A) — à exécuter tel quel, dans cet ordre.
-- Ne supprime que des fonctions créées ici ; aucune donnée n'est touchée.
--
--   drop function if exists public.fdj_signaler_erreur_apres_validation(uuid, text);
--   drop function if exists public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric);
--   drop function if exists public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric);
--   drop function if exists public.fdj_enregistrer_brouillon_caisse(uuid, jsonb, numeric, numeric, numeric, numeric);
--   drop function if exists public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric);
--   drop function if exists public.fdj_quart_de_l_employe(uuid);
--   drop function if exists public.fdj_chaine_continuite(text, date, text);
--   drop function if exists public.fdj_calculer_caisse(uuid, numeric, numeric);
--   drop function if exists public.fdj_ventes_jeu(numeric, numeric, numeric, numeric);
--
-- Condition d'arrêt : ce retour arrière n'est sûr que tant que le front
-- servi n'appelle PAS encore ces fonctions (Phase A et début de Phase B).
-- Une fois la Phase B basculée, les supprimer coupe la saisie de caisse —
-- il faut alors rebasculer le front d'abord.
-- ============================================================================
