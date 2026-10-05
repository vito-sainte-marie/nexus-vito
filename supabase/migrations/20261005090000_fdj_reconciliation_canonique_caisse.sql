-- ============================================================================
-- FDJ — RÉCONCILIATION CANONIQUE DE LA CAISSE (lot FDJ-CARNETS-LEDGER-AUDIT-1-20261004)
--
-- Constat du 04-05/10/2026 (Production, lecture seule) : une activation de
-- carnet n'écrit qu'un mouvement caisse→caisse. Quand aucun transfert
-- bureau→caisse ne l'a précédée — réappro jamais saisi, réception saisie
-- après coup, activation côté Manager en complétant une caisse journalière —
-- le moteur calcule `nonActives = confies − actives` NÉGATIF pour la caisse
-- (−1 sur MAXI GOAL 3€, MEGA GOAL 10€, MILLIONNAIRE 10€) et laisse le
-- bureau surévalué d'autant. Le carnet activé est pourtant physiquement
-- sorti du bureau : le ledger ne le dit nulle part.
--
-- Ce que fait cette migration :
--
--   1. `fdj_reconcilier_caisse_jeu(p_declencheur)` — INTERNE (service_role
--      seul). Après chaque mouvement écrit, recalcule pour (site, jeu) les
--      soldes selon EXACTEMENT les règles de `soldesCarnetsAvecReference`
--      (nexus-fdj-moteur.js), à partir de la dernière référence valide, en
--      datant chaque mouvement par `coalesce(effective_at, created_at)` :
--        - caisse non activée négative ET bureau positif → un transfert
--          bureau→caisse compensatoire, unique par déclencheur
--          (idempotency_key dérivée du déclencheur), tracé
--          (`source = 'reconciliation_automatique'`, justification qui cite le
--          déclencheur, ligne `fdj_audit_log`) ;
--        - déficit restant (bureau insuffisant) → AMBIGUÏTÉ : alerte
--          explicite `activation_sans_carnet_confie` (motif
--          `reconciliation_bureau_insuffisant`) quand un quart est connu,
--          sinon ligne `fdj_audit_log` `fdj_reconciliation_ambigue` ;
--        - caisse non activée ≥ 0 → les alertes ouvertes
--          `activation_sans_carnet_confie` du jeu sont résolues
--          automatiquement (`resolue_automatiquement`, `resolue_le`) — jamais
--          `vue` : l'examen humain reste un geste distinct ;
--        - correction négative (annulation d'activation) → un retour
--          caisse→bureau compensatoire, borné par le net des transferts
--          automatiques déjà écrits pour ce jeu : ce que la réconciliation a
--          sorti du bureau, et seulement cela, y revient.
--      Un verrou transactionnel par (site, jeu) sérialise deux réconciliations
--      concurrentes.
--
--   2. `fdj_activer_carnet` et `fdj_enregistrer_mouvement_stock` sont
--      redéfinies À SIGNATURE ET RETOUR IDENTIQUES (PR #62) : mêmes contrôles,
--      mêmes messages, même idempotence, même journal. Deux ajouts seulement :
--        - après un insert réussi (jamais sur un rejeu), l'appel au helper ;
--          le retour porte une clé supplémentaire `reconciliation` ;
--        - `fdj_activer_carnet` écrit elle-même l'alerte d'exception
--          `activation_sans_carnet_confie` quand l'employé déclare un motif
--          (`p_motif`). L'écran Employé ne l'insère plus : une seule source,
--          dans la même transaction que le mouvement.
--
-- Ce que cette migration NE fait PAS :
--   - aucune réparation de données : aucun mouvement passé n'est réécrit ni
--     complété. Les −1 actuels seront absorbés par le point zéro.
--     Effet de bord déclaré : au premier mouvement d'un jeu après
--     application, une alerte `activation_sans_carnet_confie` encore ouverte
--     sur ce jeu est résolue automatiquement si le solde recalculé est ≥ 0 —
--     c'est la doctrine de 20260815213225 appliquée, pas une purge ;
--   - aucune table, colonne ni contrainte nouvelle ;
--   - aucun nouveau droit navigateur : le helper est fermé à anon et
--     authenticated (grants nommés, voir 20260916221000 §5).
--
-- Ordre de déploiement : migration D'ABORD, front ensuite. Ancien front +
-- nouvelle migration : l'alerte d'exception est écrite deux fois (serveur et
-- client) pendant la fenêtre — transitoire, sans effet sur les soldes.
--
-- Retour arrière : réappliquer les définitions de
-- 20260916221000_fdj_commandes_activations_et_mouvements.sql §3 et §4 (les
-- signatures sont identiques), puis
--   drop function public.fdj_reconcilier_caisse_jeu(uuid);
-- Les mouvements `source = 'reconciliation_automatique'` déjà écrits restent :
-- ce sont des faits tracés, ils ne se suppriment pas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. INTERNE — la réconciliation d'un jeu après un mouvement
-- ----------------------------------------------------------------------------

create or replace function public.fdj_reconcilier_caisse_jeu(p_declencheur uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_mvt          public.fdj_stock_movements;
  v_ref_id       uuid;
  v_ref_cree     timestamptz;
  v_caisse       uuid;
  v_bureau       uuid;
  v_bloque       uuid;
  v_bureau_qte   numeric := 0;
  v_confies      numeric := 0;
  v_actives      numeric := 0;
  v_bloques      numeric := 0;
  v_non_actives  numeric;
  v_na_avant     numeric;
  v_deficit      numeric := 0;
  v_transfert    numeric := 0;
  v_retour       numeric := 0;
  v_net_auto     numeric := 0;
  v_effective    timestamptz;
  v_id           uuid;
  v_anomalie     text := null;
  v_resolues     int := 0;
begin
  select * into v_mvt from public.fdj_stock_movements where id = p_declencheur;
  if v_mvt.id is null then
    raise exception 'Mouvement déclencheur introuvable : réconciliation impossible.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Deux réconciliations du même jeu ne doivent jamais lire le même déficit
  -- et le combler chacune.
  perform pg_advisory_xact_lock(hashtext('fdj_reco|' || v_mvt.site || '|' || v_mvt.game_id::text));

  -- Même référence que les écrans (Manager, Employé, Brief, Coach, Analyse).
  select r.id, r.created_at into v_ref_id, v_ref_cree
    from public.fdj_stock_references r
   where r.site = v_mvt.site and r.statut = 'valide'
   order by r.date desc, r.created_at desc
   limit 1;

  if v_ref_id is not null then
    select coalesce(l.bureau_reel, 0), coalesce(l.caisse_reel, 0)
      into v_bureau_qte, v_confies
      from public.fdj_stock_reference_lignes l
     where l.reference_id = v_ref_id and l.game_id = v_mvt.game_id;
    v_bureau_qte := coalesce(v_bureau_qte, 0);
    v_confies    := coalesce(v_confies, 0);
  end if;

  v_caisse := public.fdj_emplacement_du_site(v_mvt.site, 'caisse');
  v_bureau := public.fdj_emplacement_du_site(v_mvt.site, 'bureau');
  v_bloque := public.fdj_emplacement_du_site(v_mvt.site, 'bloque');

  -- Règles de soldesCarnetsAvecReference, à l'identique. Un mouvement dont la
  -- date d'effet précède la référence est déjà incorporé dans le comptage.
  select
    v_bureau_qte + coalesce(sum(case
      when m.type_mouvement = 'transfert' and m.location_destination_id = v_caisse
           and m.location_source_id = v_bureau then -m.quantite
      when m.type_mouvement = 'retour' and m.location_source_id = v_caisse
           and m.location_destination_id = v_bureau then m.quantite
      when m.type_mouvement = 'retour' and m.location_source_id = v_bloque
           and m.location_destination_id = v_bureau then m.quantite
      when m.type_mouvement = 'reception' and m.location_destination_id = v_bureau then m.quantite
      when m.type_mouvement = 'blocage' and m.location_source_id = v_bureau then -m.quantite
      else 0 end), 0),
    v_confies + coalesce(sum(case
      when m.type_mouvement = 'transfert' and m.location_destination_id = v_caisse then m.quantite
      when m.type_mouvement = 'retour' and m.location_source_id = v_caisse then -m.quantite
      when m.type_mouvement = 'retour' and m.location_source_id = v_bloque
           and m.location_destination_id = v_caisse then m.quantite
      when m.type_mouvement = 'blocage' and m.location_source_id = v_caisse then -m.quantite
      else 0 end), 0),
    coalesce(sum(case
      when m.type_mouvement in ('activation', 'correction') then m.quantite
      else 0 end), 0),
    coalesce(sum(case
      when m.type_mouvement = 'retour' and m.location_source_id = v_bloque then -m.quantite
      when m.type_mouvement = 'blocage' and m.location_source_id in (v_bureau, v_caisse) then m.quantite
      else 0 end), 0),
    coalesce(sum(case
      when m.source = 'reconciliation_automatique' and m.type_mouvement = 'transfert' then m.quantite
      when m.source = 'reconciliation_automatique' and m.type_mouvement = 'retour' then -m.quantite
      else 0 end), 0)
    into v_bureau_qte, v_confies, v_actives, v_bloques, v_net_auto
    from public.fdj_stock_movements m
   where m.site = v_mvt.site
     and m.game_id = v_mvt.game_id
     and (v_ref_cree is null or coalesce(m.effective_at, m.created_at) > v_ref_cree);

  v_non_actives := v_confies - v_actives;
  v_na_avant := v_non_actives;

  -- Date d'effet des mouvements compensatoires : celle du déclencheur, mais
  -- jamais avant la référence — sinon le moteur l'ignorerait et la
  -- compensation serait écrite sans rien compenser.
  v_effective := least(
    greatest(coalesce(v_mvt.effective_at, v_mvt.created_at),
             coalesce(v_ref_cree + interval '1 millisecond', '-infinity'::timestamptz)),
    now()
  );

  -- Annulation d'une activation : rendre au bureau ce que la réconciliation
  -- en avait sorti, et seulement cela.
  if v_mvt.type_mouvement = 'correction' and v_mvt.quantite < 0 then
    v_retour := least(greatest(v_net_auto, 0), -v_mvt.quantite, greatest(v_non_actives, 0));
    if v_retour > 0 then
      begin
        insert into public.fdj_stock_movements (
          site, game_id, shift_id, type_mouvement, quantite,
          location_source_id, location_destination_id,
          methode_identification, booklet_id,
          employee_id, created_by, effective_at,
          idempotency_key, justification, source
        )
        values (
          v_mvt.site, v_mvt.game_id, v_mvt.shift_id, 'retour', v_retour,
          v_caisse, v_bureau,
          'quantite', null,
          v_mvt.employee_id, (select auth.uid()), v_effective,
          md5('fdj_reconciliation_auto_retour|' || p_declencheur::text)::uuid,
          'Réconciliation automatique — retour caisse → bureau compensant l''annulation d''activation '
            || p_declencheur::text || '.',
          'reconciliation_automatique'
        )
        returning id into v_id;

        insert into public.fdj_audit_log (
          site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
        )
        values (
          v_mvt.site, v_mvt.shift_id, 'fdj_stock_movement', v_id,
          'fdj_reconciliation_auto_retour', (select auth.uid()), null,
          jsonb_build_object(
            'declencheur', p_declencheur, 'game_id', v_mvt.game_id, 'quantite', v_retour,
            'non_actives_avant', v_non_actives, 'net_auto_avant', v_net_auto,
            'effective_at', v_effective, 'reference_id', v_ref_id
          )
        );
        v_bureau_qte := v_bureau_qte + v_retour;
        v_confies := v_confies - v_retour;
      exception
        when unique_violation then v_retour := 0;
      end;
    end if;
  end if;

  v_non_actives := v_confies - v_actives;

  if v_non_actives < 0 then
    v_deficit := -v_non_actives;
    v_transfert := least(v_deficit, greatest(v_bureau_qte, 0));

    if v_transfert > 0 then
      begin
        insert into public.fdj_stock_movements (
          site, game_id, shift_id, type_mouvement, quantite,
          location_source_id, location_destination_id,
          methode_identification, booklet_id,
          employee_id, created_by, effective_at,
          idempotency_key, justification, source
        )
        values (
          v_mvt.site, v_mvt.game_id, v_mvt.shift_id, 'transfert', v_transfert,
          v_bureau, v_caisse,
          'quantite', null,
          v_mvt.employee_id, (select auth.uid()), v_effective,
          md5('fdj_reconciliation_auto|' || p_declencheur::text)::uuid,
          'Réconciliation automatique — transfert bureau → caisse reconstitué : la caisse '
            || 'non activée était négative (' || v_non_actives::text || ') après le mouvement '
            || p_declencheur::text || '.',
          'reconciliation_automatique'
        )
        returning id into v_id;

        insert into public.fdj_audit_log (
          site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
        )
        values (
          v_mvt.site, v_mvt.shift_id, 'fdj_stock_movement', v_id,
          'fdj_reconciliation_auto_transfert', (select auth.uid()), null,
          jsonb_build_object(
            'declencheur', p_declencheur, 'game_id', v_mvt.game_id, 'quantite', v_transfert,
            'non_actives_avant', v_non_actives, 'bureau_avant', v_bureau_qte,
            'effective_at', v_effective, 'reference_id', v_ref_id
          )
        );
        v_bureau_qte := v_bureau_qte - v_transfert;
        v_confies := v_confies + v_transfert;
      exception
        when unique_violation then v_transfert := 0;
      end;
    end if;

    v_non_actives := v_confies - v_actives;
  end if;

  if v_non_actives < 0 then
    -- Ambiguïté : le bureau ne couvre pas l'activation. NEXUS ne devine pas
    -- d'où vient le carnet ; il le dit.
    v_anomalie := 'reconciliation_bureau_insuffisant';
    if v_mvt.shift_id is not null then
      if not exists (
        select 1 from public.fdj_alertes a
         where a.site = v_mvt.site and a.game_id = v_mvt.game_id
           and a.type = 'activation_sans_carnet_confie'
           and a.resolue_le is null and a.resolue_automatiquement is false
      ) then
        insert into public.fdj_alertes (
          site, type, shift_id, shift_precedent_id, game_id,
          valeur_quart_precedent, valeur_saisie, employee_id, motif
        )
        values (
          v_mvt.site, 'activation_sans_carnet_confie', v_mvt.shift_id, null, v_mvt.game_id,
          null, v_non_actives, v_mvt.employee_id, 'reconciliation_bureau_insuffisant'
        );
      end if;
    end if;
    insert into public.fdj_audit_log (
      site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
    )
    values (
      v_mvt.site, v_mvt.shift_id, 'fdj_stock_movement', p_declencheur,
      'fdj_reconciliation_ambigue', (select auth.uid()), 'reconciliation_bureau_insuffisant',
      jsonb_build_object(
        'declencheur', p_declencheur, 'game_id', v_mvt.game_id,
        'deficit_restant', -v_non_actives, 'bureau', v_bureau_qte,
        'transfert_auto', v_transfert, 'reference_id', v_ref_id
      )
    );
  else
    -- Équilibre constaté par recalcul : résolution automatique, jamais `vue`.
    update public.fdj_alertes a
       set resolue_automatiquement = true, resolue_le = now()
     where a.site = v_mvt.site and a.game_id = v_mvt.game_id
       and a.type = 'activation_sans_carnet_confie'
       and a.resolue_le is null and a.resolue_automatiquement is false;
    get diagnostics v_resolues = row_count;
  end if;

  return jsonb_build_object(
    'declencheur', p_declencheur,
    'game_id', v_mvt.game_id,
    'reference_id', v_ref_id,
    'bureau', v_bureau_qte,
    'confies', v_confies,
    'actives', v_actives,
    'bloques', v_bloques,
    'non_actives_avant', v_na_avant,
    'non_actives', v_non_actives,
    'transfert_auto', v_transfert,
    'retour_auto', v_retour,
    'anomalie', v_anomalie,
    'alertes_resolues', v_resolues
  );
end;
$$;

comment on function public.fdj_reconcilier_caisse_jeu(uuid) is
  'Interne (FDJ-CARNETS-LEDGER-AUDIT-1, 05/10/2026) — après un mouvement, '
  'recalcule les soldes du jeu selon soldesCarnetsAvecReference (date effective) '
  'et compense une caisse non activée négative par un transfert bureau→caisse '
  'tracé ; déficit restant = anomalie explicite ; équilibre = alertes résolues.';

-- ----------------------------------------------------------------------------
-- 2. fdj_activer_carnet — signature et retour inchangés (+ `reconciliation`)
-- ----------------------------------------------------------------------------

create or replace function public.fdj_activer_carnet(
  p_shift_id      uuid,
  p_game_id       uuid,
  p_quantite      numeric,
  p_methode       text,
  p_jeton         text,
  p_justification text default null,
  p_motif         text default null,
  p_booklet_id    uuid default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid         uuid;
  v_role        text;
  v_par_manager boolean;
  v_shift       public.fdj_shifts;
  v_caisse      uuid;
  v_type        text;
  v_effective   timestamptz;
  v_cle         uuid;
  v_id          uuid;
  v_motif       text;
  v_alerte      uuid;
  v_reco        jsonb;
begin
  v_uid := (select auth.uid());
  if v_uid is null then
    raise exception 'Aucune session authentifiée : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_game_id is null then
    raise exception 'Jeu FDJ manquant.' using errcode = 'invalid_parameter_value';
  end if;

  if p_jeton is null or btrim(p_jeton) = '' then
    raise exception 'Jeton d''appel manquant : l''idempotence ne peut pas être garantie.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_quantite is null or p_quantite = 0 then
    raise exception 'Quantité de carnets manquante ou nulle.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_methode not in ('quantite', 'implicite_appro', 'reconstituee_correction_manager') then
    raise exception 'Méthode d''identification inconnue pour une activation FDJ.'
      using errcode = 'invalid_parameter_value';
  end if;

  select e.role into v_role
    from public.employees e
   where e.id = v_uid and e.actif is not false;

  v_par_manager := coalesce(v_role, '') in ('manager', 'gerant');

  if p_methode = 'reconstituee_correction_manager' and not v_par_manager then
    raise exception 'Seul un manager habilité peut reconstituer une activation.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_quantite < 0 and p_methode <> 'reconstituee_correction_manager' then
    raise exception 'Une quantité négative n''est admise que pour une correction managériale reconstituée.'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_par_manager then
    v_shift := public.fdj_quart_du_manager(p_shift_id);
  else
    v_shift := public.fdj_quart_de_l_employe(p_shift_id);
  end if;

  v_caisse := public.fdj_emplacement_du_site(v_shift.site, 'caisse');

  v_type := case when p_quantite >= 0 then 'activation' else 'correction' end;

  v_effective := least(
    coalesce(v_shift.ouvert_le, v_shift.date::timestamptz),
    now()
  );

  v_cle := public.fdj_cle_idempotence(
    p_jeton,
    'activation|' || v_shift.id::text || '|' || p_game_id::text || '|' || p_methode
  );

  v_motif := nullif(btrim(coalesce(p_motif, '')), '');

  begin
    insert into public.fdj_stock_movements (
      site, game_id, shift_id, type_mouvement, quantite,
      location_source_id, location_destination_id,
      methode_identification, booklet_id,
      employee_id, created_by, effective_at,
      idempotency_key, justification
    )
    values (
      v_shift.site, p_game_id, v_shift.id, v_type, p_quantite,
      v_caisse, v_caisse,
      p_methode, p_booklet_id,
      v_shift.employee_id, v_uid, v_effective,
      v_cle, p_justification
    )
    returning id into v_id;
  exception
    when unique_violation then
      -- Rejeu réseau : rien n'est réécrit, rien n'est réconcilié une seconde fois.
      return jsonb_build_object(
        'enregistre', true,
        'idempotent', true,
        'shift_id', v_shift.id,
        'par_manager', v_par_manager
      );
  end;

  insert into public.fdj_audit_log (
    site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
  )
  values (
    v_shift.site, v_shift.id, 'fdj_stock_movement', v_id,
    case
      when p_methode = 'implicite_appro' then 'fdj_activation_implicite_appro'
      when p_methode <> 'reconstituee_correction_manager' then 'fdj_activation_carnet'
      when p_quantite >= 0 then 'fdj_activation_reconstituee_correction_manager'
      else 'fdj_activation_reconstituee_annulee_correction_manager'
    end,
    v_uid, v_motif,
    jsonb_build_object(
      'game_id', p_game_id,
      'quantite', p_quantite,
      'type_mouvement', v_type,
      'methode_identification', p_methode,
      'motif_exception', v_motif,
      'employee_id', v_shift.employee_id,
      'created_by', v_uid,
      'effective_at', v_effective,
      'par_manager', v_par_manager
    )
  );

  -- Exception déclarée par l'employé (MOTIFS_EXCEPTION_CARNET) : l'alerte
  -- était insérée par l'écran Employé après le RPC, hors transaction. Elle
  -- l'est désormais ici, une fois, avec le mouvement. La réconciliation qui
  -- suit la résout si le bureau couvrait le carnet.
  if v_motif is not null and p_quantite > 0 then
    insert into public.fdj_alertes (
      site, type, shift_id, shift_precedent_id, game_id,
      valeur_quart_precedent, valeur_saisie, employee_id, motif
    )
    values (
      v_shift.site, 'activation_sans_carnet_confie', v_shift.id, null, p_game_id,
      null, null, v_shift.employee_id, v_motif
    )
    returning id into v_alerte;
  end if;

  v_reco := public.fdj_reconcilier_caisse_jeu(v_id);

  -- « Solde à ce moment » (panneau Manager) : les carnets non activés en
  -- caisse avant cette activation, tels que le recalcul les voit — ce que
  -- l'écran Employé écrivait (`solde.nonActives`), mesuré ici côté serveur.
  if v_alerte is not null then
    update public.fdj_alertes
       set valeur_saisie = (v_reco->>'non_actives_avant')::numeric + p_quantite
     where id = v_alerte;
  end if;

  return jsonb_build_object(
    'enregistre', true,
    'idempotent', false,
    'mouvement_id', v_id,
    'shift_id', v_shift.id,
    'type_mouvement', v_type,
    'employee_id', v_shift.employee_id,
    'created_by', v_uid,
    'effective_at', v_effective,
    'par_manager', v_par_manager,
    'reconciliation', v_reco
  );
end;
$$;

comment on function public.fdj_activer_carnet(uuid, uuid, numeric, text, text, text, text, uuid) is
  'Relecture PR #62, point 3 — active ou corrige des carnets FDJ sur un quart. '
  'site, shift_id et employee_id viennent du quart autorisé ; created_by vient '
  'de auth.uid() ; effective_at vient du quart, pas de l''instant de saisie. '
  'employee_id n''est paramètre d''aucun appel : personne ne peut attribuer un '
  'mouvement à un collègue. Depuis 20261005090000 : alerte d''exception écrite '
  'côté serveur, puis réconciliation canonique de la caisse (fdj_reconcilier_caisse_jeu).';

-- ----------------------------------------------------------------------------
-- 3. fdj_enregistrer_mouvement_stock — signature et retour inchangés (+ `reconciliation`)
-- ----------------------------------------------------------------------------

create or replace function public.fdj_enregistrer_mouvement_stock(
  p_operation           text,
  p_lignes              jsonb,
  p_jeton               text,
  p_motif               text default null,
  p_source              text default null,
  p_emplacement_source  text default null,
  p_effective_at        timestamptz default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid           uuid;
  v_role          text;
  v_site          text;
  v_type          text;
  v_methode       text;
  v_src_type      text;
  v_dst_type      text;
  v_src           uuid;
  v_dst           uuid;
  v_employee      uuid;
  v_effective     timestamptz;
  v_justification text;
  v_ligne         jsonb;
  v_game          uuid;
  v_qte           numeric;
  v_cle           uuid;
  v_id            uuid;
  v_ids           uuid[] := '{}';
  v_rejeux        int := 0;
  v_ecrits        int := 0;
  v_reco          jsonb := '[]'::jsonb;
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
    raise exception 'Seul un manager habilité peut enregistrer un mouvement de stock FDJ.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_site is null then
    raise exception 'Utilisateur sans rattachement de site : opération refusée.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_jeton is null or btrim(p_jeton) = '' then
    raise exception 'Jeton d''appel manquant : l''idempotence ne peut pas être garantie.'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_lignes is null or jsonb_typeof(p_lignes) <> 'array' or jsonb_array_length(p_lignes) = 0 then
    raise exception 'Aucune ligne de mouvement fournie.'
      using errcode = 'invalid_parameter_value';
  end if;

  case p_operation
    when 'reception' then
      v_type := 'reception'; v_methode := 'quantite';
      v_src_type := null;      v_dst_type := 'bureau';
      v_justification := 'Réception FDJ (manager)'
        || case when coalesce(btrim(p_source), '') <> '' then ' — ' || btrim(p_source) else '' end || '.';
    when 'reappro_caisse' then
      v_type := 'transfert'; v_methode := 'quantite';
      v_src_type := 'bureau';  v_dst_type := 'caisse';
      v_justification := 'Réapprovisionnement caisse — carnets non activés (manager).';
    when 'retrait_caisse' then
      v_type := 'retour';    v_methode := 'quantite';
      v_src_type := 'caisse';  v_dst_type := 'bureau';
      v_justification := 'Retrait caisse → bureau (manager)'
        || case when coalesce(btrim(p_motif), '') <> '' then ' — ' || btrim(p_motif) else '' end || '.';
    when 'blocage' then
      v_type := 'blocage';   v_methode := 'quantite';
      if coalesce(p_emplacement_source, '') not in ('bureau', 'caisse') then
        raise exception 'Emplacement de blocage inconnu : bureau ou caisse attendus.'
          using errcode = 'invalid_parameter_value';
      end if;
      v_src_type := p_emplacement_source; v_dst_type := 'bloque';
      if coalesce(btrim(p_motif), '') = '' then
        raise exception 'Un blocage exige un motif.' using errcode = 'invalid_parameter_value';
      end if;
      v_justification := 'Retrait/blocage (manager) — ' || btrim(p_motif);
    when 'retour_bloque' then
      v_type := 'retour';    v_methode := 'quantite';
      v_src_type := 'bloque';  v_dst_type := 'bureau';
      v_justification := 'Retour au bureau depuis la zone bloquée (manager).';
    when 'rapprochement_activation' then
      v_type := 'activation'; v_methode := 'saisie_manuelle';
      v_src_type := 'caisse';   v_dst_type := 'caisse';
      v_justification := 'Rapprochement manuel manager — quart(s) complété(s)/corrigé(s) après coup sans mouvement tracé.'
        || case when coalesce(btrim(p_motif), '') <> '' then ' ' || btrim(p_motif) else '' end;
    else
      raise exception 'Opération de mouvement de stock inconnue.'
        using errcode = 'invalid_parameter_value';
  end case;

  v_employee := case when p_operation = 'rapprochement_activation' then null else v_uid end;

  v_src := case when v_src_type is null then null
                else public.fdj_emplacement_du_site(v_site, v_src_type) end;
  v_dst := case when v_dst_type is null then null
                else public.fdj_emplacement_du_site(v_site, v_dst_type) end;

  v_effective := coalesce(p_effective_at, now());
  if v_effective > now() then
    raise exception 'Une date d''effet ne peut pas être dans le futur.'
      using errcode = 'invalid_parameter_value';
  end if;
  if v_effective < now() - interval '366 days' then
    raise exception 'Date d''effet trop ancienne : au-delà d''un an, la correction relève d''un inventaire de référence.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(p_lignes) loop
    v_game := nullif(v_ligne->>'game_id', '')::uuid;
    v_qte  := nullif(v_ligne->>'quantite', '')::numeric;

    if v_game is null then
      raise exception 'Ligne de mouvement sans jeu FDJ.' using errcode = 'invalid_parameter_value';
    end if;
    if v_qte is null or v_qte <= 0 then
      raise exception 'Ligne de mouvement sans quantité positive.' using errcode = 'invalid_parameter_value';
    end if;

    v_cle := public.fdj_cle_idempotence(
      p_jeton,
      p_operation || '|' || v_game::text
    );

    begin
      insert into public.fdj_stock_movements (
        site, game_id, shift_id, type_mouvement, quantite,
        location_source_id, location_destination_id,
        methode_identification, booklet_id,
        employee_id, created_by, effective_at,
        idempotency_key, justification, source
      )
      values (
        v_site, v_game, null, v_type, v_qte,
        v_src, v_dst,
        v_methode, null,
        v_employee, v_uid, v_effective,
        v_cle, v_justification, nullif(btrim(coalesce(p_source, '')), '')
      )
      returning id into v_id;

      v_ids := v_ids || v_id;
      v_ecrits := v_ecrits + 1;
    exception
      when unique_violation then
        v_rejeux := v_rejeux + 1;
    end;
  end loop;

  if v_ecrits > 0 then
    insert into public.fdj_audit_log (
      site, shift_id, entite_type, entite_id, action, acteur_id, motif, nouvelle_valeur
    )
    values (
      v_site, null, 'fdj_stock_movement', v_ids[1],
      'fdj_mouvement_stock_' || p_operation,
      v_uid, nullif(btrim(coalesce(p_motif, '')), ''),
      jsonb_build_object(
        'operation', p_operation,
        'type_mouvement', v_type,
        'methode_identification', v_methode,
        'lignes', jsonb_array_length(p_lignes),
        'ecrits', v_ecrits,
        'rejeux', v_rejeux,
        'mouvement_ids', to_jsonb(v_ids),
        'employee_id', v_employee,
        'created_by', v_uid,
        'effective_at', v_effective
      )
    );
  end if;

  -- Une réception saisie après une activation (cas « livraison après
  -- activation ») comble ici le déficit et résout l'alerte. Après le journal
  -- de l'opération : les mouvements compensatoires ont leur propre ligne.
  if v_ecrits > 0 then
    foreach v_id in array v_ids loop
      v_reco := v_reco || jsonb_build_array(public.fdj_reconcilier_caisse_jeu(v_id));
    end loop;
  end if;

  return jsonb_build_object(
    'enregistre', true,
    'idempotent', v_ecrits = 0,
    'operation', p_operation,
    'type_mouvement', v_type,
    'ecrits', v_ecrits,
    'rejeux', v_rejeux,
    'mouvement_ids', to_jsonb(v_ids),
    'employee_id', v_employee,
    'created_by', v_uid,
    'effective_at', v_effective,
    'reconciliation', v_reco
  );
end;
$$;

comment on function public.fdj_enregistrer_mouvement_stock(text, jsonb, text, text, text, text, timestamptz) is
  'Relecture PR #62, point 3 — mouvements de stock FDJ de gestion, hors quart, '
  'réservés au manager du site. L''appelant nomme une opération ; le type, les '
  'emplacements, la méthode, le site, l''auteur et la clé d''idempotence sont '
  'déterminés côté serveur. Depuis 20261005090000 : chaque ligne écrite déclenche '
  'la réconciliation canonique de la caisse (fdj_reconcilier_caisse_jeu).';

-- ----------------------------------------------------------------------------
-- 4. PRIVILÈGES — grants nommés (revoke from public ne ferme pas anon)
-- ----------------------------------------------------------------------------

do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_activer_carnet(uuid, uuid, numeric, text, text, text, text, uuid)',
    'public.fdj_enregistrer_mouvement_stock(text, jsonb, text, text, text, text, timestamptz)'
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

do $$
declare
  v_sig text;
  v_signatures text[] := array[
    'public.fdj_reconcilier_caisse_jeu(uuid)'
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
