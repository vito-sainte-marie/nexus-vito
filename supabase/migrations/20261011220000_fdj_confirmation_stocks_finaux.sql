-- ============================================================================
-- FDJ — confirmation des stocks finaux avant clôture (handoff MISSION
-- PATRIMOINE du 11/10/2026, decision-1 de l'arbitre, APPROVED_WITH_CONDITIONS).
--
-- Cause racine. 20261011200000 sécurise l'aval (un quart suivant lit une fin
-- absente à stock nul comme 0), mais pas la validation elle-même :
--   · fdj_confirmer_caisse refusait un jeu à fin vide sans proposer de choix,
--     et laissait passer une fin vide à stock nul sans l'écrire ;
--   · quatre commandes manager passent un quart à 'valide' sans regarder ses
--     fins (fdj_manager_creer_quart, fdj_manager_modifier_quart,
--     fdj_manager_changer_statut_quart, et fdj_manager_enregistrer_comptages
--     qui régularise un quart déjà validé). La fin vide de MISSION PATRIMOINE
--     (539e87bc) est née d'une saisie manager.
--
-- Règle arbitrée (decision-1) : à la validation, aucune quantité finale ne
-- reste indéterminée.
--   · fin vide, stock disponible (début + appro) = 0 -> 0 explicite, posé
--     automatiquement et tracé ;
--   · fin vide, stock disponible > 0 ou stock de départ inconnu -> la
--     validation est refusée ; l'écran demande, jeu par jeu, « Confirmer 0 »
--     (marqueur stock_final_confirme_zero, 0 explicite et tracé) ou
--     « Corriger la saisie » ;
--   · une quantité saisie n'est jamais remplacée : seules les fins NULL
--     deviennent 0, et une fin déjà à 0 n'est que tracée quand l'écran la
--     dit confirmée.
--
-- Marqueur : un élément de p_comptages peut porter
-- "stock_final_confirme_zero": true (l'écran envoie aussi stock_final 0 dans
-- la ligne complète). Sans marqueur, rien ne change pour un client existant.
--
-- 1. fdj_stocks_finaux_a_confirmer(p_shift_id, p_comptages,
--    p_seulement_comptages) — STABLE. Jeux dont la fin est vide alors qu'il
--    restait du stock ou que le début est inconnu, hors confirmés à 0 par le
--    marqueur. Périmètre : jeux actifs du site et jeux envoyés, ou seulement
--    les jeux envoyés (régularisation, correction). Un jeu actif sans ligne
--    compte (stock de départ inconnu). Rend un tableau jsonb (game_id, nom,
--    stock_initial, appro, disponible, libelle), trié comme l'écran.
--
-- 2. fdj_poser_stocks_finaux_confirmes(p_shift_id, p_comptages, p_source,
--    p_acteur, p_seulement_comptages, p_zero_automatique) — pose 0 sur les
--    fins NULL confirmées par le marqueur et, si p_zero_automatique, sur les
--    fins NULL à stock nul ; ventes recalculées avec la même formule que
--    fdj_ecrire_saisies_caisse. Journal fdj_audit_log :
--    'confirmation_stock_final_zero' (choix de l'utilisateur) ou
--    'stock_final_zero_automatique', metadata (game_id, disponible, source,
--    confirme_par_l_utilisateur). Idempotente : une confirmation déjà tracée
--    ne l'est pas deux fois. Rend le nombre de jeux traités.
--
-- 3. fdj_exiger_stocks_finaux_determines(...) — lève check_violation (23514,
--    detail = la liste du point 1) s'il reste une fin indéterminée ; sinon
--    applique le point 2 avec zéro automatique. Un raise annule tout l'appel :
--    aucune écriture partielle.
--
-- 4. fdj_confirmer_caisse : refuse ('stocks_finaux_a_confirmer', liste
--    'jeux', message) avant tout calcul ; le brouillon écrit par
--    fdj_ecrire_saisies_caisse est conservé, rien n'est tracé. Sinon pose les
--    0 (point 2) et recalcule l'écart si une ligne a changé. Remplace le refus
--    'saisie_incomplete' sur fin absente de 20261011200000.
-- 5. fdj_corriger_caisse_confirmee : une correction qui envoie des comptages
--    passe par le point 3 sur les jeux envoyés.
-- 6. fdj_manager_enregistrer_comptages : quart validé -> point 3 sur les
--    jeux envoyés ; brouillon -> seules les confirmations explicites sont
--    posées (les règles s'appliquent au passage à 'valide').
-- 7. fdj_manager_modifier_quart, 8. fdj_manager_changer_statut_quart : au
--    passage d'un statut autre que 'valide' à 'valide', la continuité est
--    complétée (fdj_completer_continuite_quart, quart encore brouillon), puis
--    le point 3 s'applique à tous les jeux actifs.
-- 9. fdj_manager_creer_quart : un quart demandé 'valide' est créé brouillon,
--    complété, contrôlé (point 3), puis validé ; sinon inchangée.
-- Transitions non gardées : 'valide' -> 'valide' (aucune validation
-- nouvelle) et 'valide' -> 'brouillon'.
--
-- Non modifiées (mesuré le 11/10 sur Test) : fdj_manager_aligner_fin_quart_
-- precedent (écrit un début, jamais NULL) ; fdj_manager_corriger_comptages
-- (n'écrit pas la fin) ; fdj_valider_ouverture_quart (refuse un quart
-- validé) ; fdj_enregistrer_brouillon_caisse (refuse un quart non brouillon
-- ou une caisse confirmée) ; fdj_saisir_caisse_manager (n'écrit pas les
-- comptages) ; fdj_ecrire_saisies_caisse (trois appelants seulement :
-- confirmer, corriger, enregistrer_brouillon). Aucune contrainte CHECK ni
-- aucun déclencheur sur fdj_audit_log ; le déclencheur
-- trg_fdj_trace_correction_stock_initial ne porte que sur stock_initial :
-- poser une fin ne le déclenche pas.
--
-- Contrôles d'accès (10) : les trois nouvelles fonctions ne sont exécutables
-- que par service_role ; elles ne sont appelées que par des commandes
-- SECURITY DEFINER. ACL des six commandes redéfinies réaffirmées à
-- l'identique (A6, 20261010150000).
--
-- Prérequis : registre ≥ 20261011200000 (Test 319). Aucune donnée existante
-- n'est réécrite par la migration elle-même : elle ne fait que (re)définir des
-- fonctions. Idempotente (create or replace).
--
-- Ordre de déploiement : CODE D'ABORD. L'écran servi avant ce correctif ne
-- connaît pas 'stocks_finaux_a_confirmer' (il affiche le message, sans choix)
-- et l'écran manager servi passe un quart à 'valide' avant d'écrire ses
-- comptages : migré avant le code, il serait refusé.
--
-- Retour arrière :
--   drop function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean);
--   drop function public.fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean);
--   drop function public.fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean);
--   (dans cet ordre, après avoir rétabli les six commandes qui les appellent)
--   puis rétablir (create or replace, définitions identiques à celles
--   servies le 11/10 sur Test) :
--     fdj_confirmer_caisse                <- 20261011200000 ;
--     fdj_corriger_caisse_confirmee       <- 20260916220600 ;
--     fdj_manager_creer_quart,
--     fdj_manager_changer_statut_quart,
--     fdj_manager_enregistrer_comptages   <- 20261010150000 ;
--     fdj_manager_modifier_quart          <- 20261010170000 ;
--   et leurs commentaires (confirmer et corriger : texte d'origine ;
--   commandes manager : comment ... is null).
--   Les fins posées à 0 et les lignes de journal écrites entre-temps restent
--   (historique immuable).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Jeux dont la fin reste indéterminée.
-- ----------------------------------------------------------------------------
create or replace function public.fdj_stocks_finaux_a_confirmer(
  p_shift_id uuid,
  p_comptages jsonb default null,
  p_seulement_comptages boolean default false
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_site  text;
  v_liste jsonb;
begin
  select s.site into v_site from public.fdj_shifts s where s.id = p_shift_id;
  if v_site is null then
    return '[]'::jsonb;
  end if;

  with envoyes as (
    select nullif(e->>'game_id', '')::uuid as game_id,
           bool_or(coalesce(e->'stock_final_confirme_zero' = 'true'::jsonb, false)) as confirme_zero
      from jsonb_array_elements(
             case when jsonb_typeof(p_comptages) = 'array' then p_comptages else '[]'::jsonb end
           ) e
     where nullif(e->>'game_id', '') is not null
     group by 1
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'game_id',       g.id,
           'nom',           g.nom,
           'stock_initial', c.stock_initial,
           'appro',         coalesce(c.appro, 0),
           'disponible',    case when c.stock_initial is null then null
                                 else c.stock_initial + coalesce(c.appro, 0) end,
           'libelle',       g.nom || case
               when c.stock_initial is null then ' (stock de départ inconnu)'
               when c.stock_initial + coalesce(c.appro, 0) = 1 then ' (1 ticket disponible)'
               else ' (' || trim_scale(c.stock_initial + coalesce(c.appro, 0))::text || ' tickets disponibles)'
             end
         ) order by g.ordre_affichage, g.nom), '[]'::jsonb)
    into v_liste
    from public.fdj_games g
    left join public.fdj_shift_counts c on c.shift_id = p_shift_id and c.game_id = g.id
    left join envoyes e on e.game_id = g.id
   where g.site = v_site
     and (case when p_seulement_comptages then e.game_id is not null
               else (g.actif or e.game_id is not null) end)
     and c.stock_final is null
     and not coalesce(e.confirme_zero, false)
     and not (c.stock_initial is not null and c.stock_initial + coalesce(c.appro, 0) = 0);

  return v_liste;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Fins vides devenues 0 explicite (confirmées, ou à stock nul), tracées.
-- ----------------------------------------------------------------------------
create or replace function public.fdj_poser_stocks_finaux_confirmes(
  p_shift_id uuid,
  p_comptages jsonb,
  p_source text,
  p_acteur uuid,
  p_seulement_comptages boolean default false,
  p_zero_automatique boolean default true
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_site   text;
  v_r      record;
  v_action text;
  v_motif  text;
  v_n      int := 0;
begin
  select s.site into v_site from public.fdj_shifts s where s.id = p_shift_id;
  if v_site is null then
    return 0;
  end if;

  for v_r in
    with envoyes as (
      select nullif(e->>'game_id', '')::uuid as game_id,
             bool_or(coalesce(e->'stock_final_confirme_zero' = 'true'::jsonb, false)) as confirme_zero
        from jsonb_array_elements(
               case when jsonb_typeof(p_comptages) = 'array' then p_comptages else '[]'::jsonb end
             ) e
       where nullif(e->>'game_id', '') is not null
       group by 1
    )
    select c.id, c.game_id, c.stock_initial, c.appro, c.stock_final, g.prix,
           coalesce(e.confirme_zero, false) as confirme_zero
      from public.fdj_shift_counts c
      join public.fdj_games g on g.id = c.game_id
      left join envoyes e on e.game_id = c.game_id
     where c.shift_id = p_shift_id
       and g.site = v_site
       and (
             -- « Confirmer 0 » : seule une fin vide devient 0 ; une fin déjà
             -- à 0 n'est que tracée ; une quantité saisie n'est jamais touchée.
             (coalesce(e.confirme_zero, false)
               and (c.stock_final is null or c.stock_final = 0))
          or (p_zero_automatique
               and not coalesce(e.confirme_zero, false)
               and c.stock_final is null
               and c.stock_initial is not null
               and c.stock_initial + coalesce(c.appro, 0) = 0
               and (case when p_seulement_comptages then e.game_id is not null
                         else (g.actif or e.game_id is not null) end))
           )
     order by g.ordre_affichage, g.nom
  loop
    if v_r.confirme_zero then
      v_action := 'confirmation_stock_final_zero';
      v_motif  := 'Stock final confirmé à 0 avant validation (aucun ticket restant)';
    else
      v_action := 'stock_final_zero_automatique';
      v_motif  := 'Stock final absent sans stock disponible : 0 enregistré automatiquement';
    end if;

    if v_r.stock_final is null then
      update public.fdj_shift_counts c
         set stock_final   = 0,
             ventes_qte    = case when c.stock_initial is null then null
                                  else c.stock_initial + coalesce(c.appro, 0) end,
             ventes_valeur = public.fdj_ventes_jeu(c.stock_initial, coalesce(c.appro, 0), 0, v_r.prix),
             updated_at    = now()
       where c.id = v_r.id
         and c.stock_final is null;
      if not found then
        continue;
      end if;
    elsif exists (
      select 1 from public.fdj_audit_log a
       where a.shift_id = p_shift_id
         and a.action = 'confirmation_stock_final_zero'
         and a.metadata->>'game_id' = v_r.game_id::text
    ) then
      continue;
    end if;

    insert into public.fdj_audit_log (
      site, shift_id, entite_type, entite_id, action,
      ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata
    ) values (
      v_site, p_shift_id, 'fdj_shift_counts', v_r.id, v_action,
      case when v_r.stock_final is null then jsonb_build_object('stock_final', null) end,
      jsonb_build_object('stock_final', 0),
      p_acteur, v_motif,
      jsonb_build_object(
        'game_id', v_r.game_id,
        'disponible', case when v_r.stock_initial is null then null
                           else v_r.stock_initial + coalesce(v_r.appro, 0) end,
        'source', p_source,
        'confirme_par_l_utilisateur', v_r.confirme_zero
      )
    );
    v_n := v_n + 1;
  end loop;

  return v_n;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Garde : aucune fin indéterminée, sinon rien n'est écrit.
-- ----------------------------------------------------------------------------
create or replace function public.fdj_exiger_stocks_finaux_determines(
  p_shift_id uuid,
  p_comptages jsonb,
  p_source text,
  p_acteur uuid,
  p_seulement_comptages boolean default false
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a_confirmer jsonb;
  v_libelles    text;
begin
  v_a_confirmer := public.fdj_stocks_finaux_a_confirmer(p_shift_id, p_comptages, p_seulement_comptages);
  if jsonb_array_length(v_a_confirmer) > 0 then
    select string_agg(x.v->>'libelle', ', ' order by x.n)
      into v_libelles
      from jsonb_array_elements(v_a_confirmer) with ordinality x(v, n);
    raise exception 'Stock final non déterminé pour : %. Indiquez son stock final, ou confirmez 0.', v_libelles
      using errcode = 'check_violation', detail = v_a_confirmer::text;
  end if;

  return public.fdj_poser_stocks_finaux_confirmes(
    p_shift_id, p_comptages, p_source, p_acteur, p_seulement_comptages, true
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Confirmation de la caisse par l'employé.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fdj_confirmer_caisse(p_shift_id uuid, p_comptages jsonb DEFAULT NULL::jsonb, p_lots_payes_grattage numeric DEFAULT NULL::numeric, p_caisse_tirages numeric DEFAULT NULL::numeric, p_caisse_reelle numeric DEFAULT NULL::numeric, p_regularisations numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_a_confirmer     jsonb;
  v_n               int;
  v_stock_a_verifier boolean;
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

  -- decision-1 du 11/10/2026 (règles 2 à 5) : la caisse ne se confirme pas
  -- tant qu'un stock final reste indéterminé (fin vide alors qu'il restait
  -- du stock, ou stock de départ inconnu), sauf jeu confirmé à 0 par
  -- l'employé (stock_final_confirme_zero). L'écran affiche la liste et
  -- demande, jeu par jeu, « Confirmer 0 » ou « Corriger la saisie ». Le
  -- brouillon écrit ci-dessus est conservé ; rien n'est tracé.
  v_a_confirmer := public.fdj_stocks_finaux_a_confirmer(p_shift_id, p_comptages, false);
  if jsonb_array_length(v_a_confirmer) > 0 then
    return jsonb_build_object(
      'confirme', false,
      'motif', 'stocks_finaux_a_confirmer',
      'jeux', v_a_confirmer,
      'message', 'Stock final non renseigné pour : '
        || (select string_agg(x.v->>'libelle', ', ' order by x.n)
              from jsonb_array_elements(v_a_confirmer) with ordinality x(v, n))
        || '. Indiquez son stock final, ou 0 s''il n''en reste aucun.'
    );
  end if;

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

  -- Fins vides restantes : à stock nul, ou confirmées à 0 par l'employé
  -- (stock_final_confirme_zero). Elles deviennent un 0 explicite, tracé
  -- (fdj_audit_log) : le quart suivant ne lit jamais une fin NULL. L'écart
  -- est recalculé si une fin a été posée ici.
  v_n := public.fdj_poser_stocks_finaux_confirmes(
    p_shift_id, p_comptages, 'fdj_confirmer_caisse', v_uid, false, true
  );
  if v_n > 0 then
    v_calc := public.fdj_calculer_caisse(p_shift_id, p_caisse_reelle, p_regularisations);
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
  -- Fin précédente absente alors qu'il restait du stock : la reprise n'a
  -- pas pu conclure (alerte posée par fdj_completer_continuite_quart).
  v_stock_a_verifier := exists (
    select 1 from public.fdj_alertes a
     where a.shift_id = p_shift_id
       and a.type = 'continuite_stock_a_verifier'
       and not a.resolue_automatiquement
  );
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
        'continuite_stock_a_verifier', v_stock_a_verifier
      ),
      -- caractereRelevecloture({ chaineInterrompue, continuiteStockAVerifier })
      case when (v_chaine->>'rompue')::boolean or v_stock_a_verifier then 'provisoire' else 'definitif' end,
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
$function$;

-- ----------------------------------------------------------------------------
-- 5. Correction d'une caisse confirmée.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fdj_corriger_caisse_confirmee(p_shift_id uuid, p_motif text, p_commentaire text DEFAULT NULL::text, p_comptages jsonb DEFAULT NULL::jsonb, p_lots_payes_grattage numeric DEFAULT NULL::numeric, p_caisse_tirages numeric DEFAULT NULL::numeric, p_caisse_reelle numeric DEFAULT NULL::numeric, p_regularisations numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

  -- decision-1 du 11/10/2026 : une correction des comptages obéit aux mêmes
  -- règles que la confirmation (check_violation : rien n'est écrit).
  if p_comptages is not null then
    perform public.fdj_exiger_stocks_finaux_determines(
      p_shift_id, p_comptages, 'fdj_corriger_caisse_confirmee', v_uid, true
    );
  end if;

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
$function$;

-- ----------------------------------------------------------------------------
-- 6. Comptages manager (saisie et régularisation).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fdj_manager_enregistrer_comptages(p_shift_id uuid, p_comptages jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_shift public.fdj_shifts;
  v_ligne jsonb;
  v_game  uuid;
  v_n     int := 0;
begin
  v_shift := public.fdj_quart_du_manager(p_shift_id);
  if p_comptages is null or jsonb_typeof(p_comptages) <> 'array' then
    raise exception 'Comptages attendus sous forme de tableau.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(p_comptages) loop
    v_game := nullif(v_ligne->>'game_id', '')::uuid;
    perform public.fdj_exiger_jeu_du_site(v_game, v_shift.site);
    insert into public.fdj_shift_counts as c (
      site, shift_id, game_id, stock_initial, appro, stock_final,
      ventes_qte, ventes_valeur, stock_initial_auto, updated_at
    ) values (
      v_shift.site, p_shift_id, v_game,
      nullif(v_ligne->>'stock_initial', '')::numeric,
      coalesce(nullif(v_ligne->>'appro', '')::numeric, 0),
      nullif(v_ligne->>'stock_final', '')::numeric,
      nullif(v_ligne->>'ventes_qte', '')::numeric,
      nullif(v_ligne->>'ventes_valeur', '')::numeric,
      coalesce((v_ligne->>'stock_initial_auto')::boolean, false),
      now()
    )
    on conflict (shift_id, game_id) do update
      set stock_initial      = excluded.stock_initial,
          appro              = excluded.appro,
          stock_final        = excluded.stock_final,
          ventes_qte         = excluded.ventes_qte,
          ventes_valeur      = excluded.ventes_valeur,
          stock_initial_auto = excluded.stock_initial_auto,
          updated_at         = excluded.updated_at;
    v_n := v_n + 1;
  end loop;

  -- decision-1 du 11/10/2026 (règles 5 et 6). Quart validé : aucune fin
  -- indéterminée parmi les jeux envoyés (check_violation : rien n'est
  -- écrit) ; une fin vide à stock nul devient 0, tracée. Quart brouillon :
  -- seules les confirmations explicites sont posées ; les règles
  -- s'appliquent au passage à 'valide'.
  if v_shift.statut = 'valide' then
    perform public.fdj_exiger_stocks_finaux_determines(
      p_shift_id, p_comptages, 'fdj_manager_enregistrer_comptages', (select auth.uid()), true
    );
  else
    perform public.fdj_poser_stocks_finaux_confirmes(
      p_shift_id, p_comptages, 'fdj_manager_enregistrer_comptages', (select auth.uid()), true, false
    );
  end if;

  return jsonb_build_object('shift_id', p_shift_id, 'comptages', v_n);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 7. Modification d'un quart par le manager.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fdj_manager_modifier_quart(p_shift_id uuid, p_date date, p_quart text, p_statut text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_avant public.fdj_shifts;
  v_shift public.fdj_shifts;
begin
  v_avant := public.fdj_quart_du_manager(p_shift_id);
  if p_date is null or p_quart is null or p_statut is null then
    raise exception 'Date, quart et statut sont requis.'
      using errcode = 'invalid_parameter_value';
  end if;

  -- decision-1 du 11/10/2026 (règle 5) : un quart ne passe à 'valide' que
  -- si aucune fin ne reste indéterminée. La date et le quart sont posés
  -- d'abord (la continuité se lit sur le quart précédent de la nouvelle
  -- date) ; le quart est encore brouillon pendant la complétion.
  if p_statut = 'valide' and v_avant.statut is distinct from 'valide' then
    update public.fdj_shifts set date = p_date, quart = p_quart where id = p_shift_id;
    perform public.fdj_completer_continuite_quart(p_shift_id, 'fdj_manager_modifier_quart');
    perform public.fdj_exiger_stocks_finaux_determines(
      p_shift_id, null, 'fdj_manager_modifier_quart', (select auth.uid()), false
    );
  end if;

  update public.fdj_shifts
     set date = p_date, quart = p_quart, statut = p_statut,
         -- 10/10/2026 : la date initiale de validation est préservée.
         valide_le = case when p_statut = 'valide' then coalesce(valide_le, now()) end
   where id = p_shift_id
  returning * into v_shift;
  return to_jsonb(v_shift);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 8. Changement de statut par le manager.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fdj_manager_changer_statut_quart(p_shift_id uuid, p_statut text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_avant public.fdj_shifts;
  v_shift public.fdj_shifts;
begin
  v_avant := public.fdj_quart_du_manager(p_shift_id);

  -- decision-1 du 11/10/2026 (règle 5) : même garde que la modification.
  if p_statut = 'valide' and v_avant.statut is distinct from 'valide' then
    perform public.fdj_completer_continuite_quart(p_shift_id, 'fdj_manager_changer_statut_quart');
    perform public.fdj_exiger_stocks_finaux_determines(
      p_shift_id, null, 'fdj_manager_changer_statut_quart', (select auth.uid()), false
    );
  end if;

  update public.fdj_shifts set statut = p_statut
   where id = p_shift_id
  returning * into v_shift;
  return to_jsonb(v_shift);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 9. Création d'un quart par le manager.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fdj_manager_creer_quart(p_date date, p_quart text, p_employee_id uuid, p_statut text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_site  text;
  v_shift public.fdj_shifts;
begin
  v_site := public.fdj_site_du_manager();
  if p_date is null or p_quart is null or p_statut is null then
    raise exception 'Date, quart et statut sont requis.'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_employee_id is not null and not exists (
    select 1 from public.employees e where e.id = p_employee_id and e.site_id = v_site
  ) then
    raise exception 'Le titulaire désigné n''appartient pas à ce site.'
      using errcode = 'insufficient_privilege';
  end if;

  -- decision-1 du 11/10/2026 (règle 5) : un quart demandé 'valide' naît
  -- brouillon, est complété, contrôlé, puis validé.
  insert into public.fdj_shifts (
    site, date, quart, employee_id, statut, ouvert_le, valide_le,
    created_by, ouverture_source
  ) values (
    v_site, p_date, p_quart, p_employee_id,
    case when p_statut = 'valide' then 'brouillon' else p_statut end,
    now(), null,
    (select auth.uid()), 'creation_manager'
  )
  returning * into v_shift;

  if p_statut = 'valide' then
    perform public.fdj_completer_continuite_quart(v_shift.id, 'fdj_manager_creer_quart');
    perform public.fdj_exiger_stocks_finaux_determines(
      v_shift.id, null, 'fdj_manager_creer_quart', (select auth.uid()), false
    );
    update public.fdj_shifts set statut = 'valide', valide_le = now()
     where id = v_shift.id
    returning * into v_shift;
  end if;

  return to_jsonb(v_shift);
end;
$function$;

-- ----------------------------------------------------------------------------
-- 10. Contrôles d'accès et commentaires.
-- ----------------------------------------------------------------------------
revoke all on function public.fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean) from public;
revoke all on function public.fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean) from anon;
revoke all on function public.fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean) from authenticated;
grant execute on function public.fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean) to service_role;

revoke all on function public.fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean) from public;
revoke all on function public.fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean) from anon;
revoke all on function public.fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean) from authenticated;
grant execute on function public.fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean) to service_role;

revoke all on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) from public;
revoke all on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) from anon;
revoke all on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) from authenticated;
grant execute on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) to service_role;

revoke all on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) from public;
revoke all on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) from anon;
grant execute on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) to service_role;

revoke all on function public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric) from public;
revoke all on function public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric) from anon;
grant execute on function public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric) to service_role;

revoke all on function public.fdj_manager_enregistrer_comptages(uuid, jsonb) from public;
revoke all on function public.fdj_manager_enregistrer_comptages(uuid, jsonb) from anon;
grant execute on function public.fdj_manager_enregistrer_comptages(uuid, jsonb) to authenticated;
grant execute on function public.fdj_manager_enregistrer_comptages(uuid, jsonb) to service_role;

revoke all on function public.fdj_manager_modifier_quart(uuid, date, text, text) from public;
revoke all on function public.fdj_manager_modifier_quart(uuid, date, text, text) from anon;
grant execute on function public.fdj_manager_modifier_quart(uuid, date, text, text) to authenticated;
grant execute on function public.fdj_manager_modifier_quart(uuid, date, text, text) to service_role;

revoke all on function public.fdj_manager_changer_statut_quart(uuid, text) from public;
revoke all on function public.fdj_manager_changer_statut_quart(uuid, text) from anon;
grant execute on function public.fdj_manager_changer_statut_quart(uuid, text) to authenticated;
grant execute on function public.fdj_manager_changer_statut_quart(uuid, text) to service_role;

revoke all on function public.fdj_manager_creer_quart(date, text, uuid, text) from public;
revoke all on function public.fdj_manager_creer_quart(date, text, uuid, text) from anon;
grant execute on function public.fdj_manager_creer_quart(date, text, uuid, text) to authenticated;
grant execute on function public.fdj_manager_creer_quart(date, text, uuid, text) to service_role;

comment on function public.fdj_stocks_finaux_a_confirmer(uuid, jsonb, boolean) is
  'Jeux d''un quart dont le stock final reste indéterminé : fin vide alors qu''il restait du stock (début + appro > 0) ou que le début est inconnu, hors confirmés à 0 (stock_final_confirme_zero). decision-1 du 11/10/2026.';
comment on function public.fdj_poser_stocks_finaux_confirmes(uuid, jsonb, text, uuid, boolean, boolean) is
  'Pose un stock final 0 explicite sur les fins vides confirmées à 0 (et, si demandé, sur les fins vides à stock nul) ; ventes recalculées ; journal confirmation_stock_final_zero / stock_final_zero_automatique. Ne remplace jamais une quantité saisie. decision-1 du 11/10/2026.';
comment on function public.fdj_exiger_stocks_finaux_determines(uuid, jsonb, text, uuid, boolean) is
  'Refuse (check_violation, detail = jeux) tant qu''un stock final reste indéterminé ; sinon pose les 0 explicites. decision-1 du 11/10/2026.';
comment on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) is
  'Mandat §3.2/§3.3 — « Confirmer ma caisse et la transmettre au manager ». Événement immuable, idempotent, renvoie l''écart provisoire. decision-1 du 11/10/2026 : refus stocks_finaux_a_confirmer tant qu''un stock final reste indéterminé ; 0 explicite tracé sinon.';
comment on function public.fdj_corriger_caisse_confirmee(uuid, text, text, jsonb, numeric, numeric, numeric, numeric) is
  'Mandat §3.4 — « Corriger ma saisie ». Refusée après validation manager. Trace complète dans fdj_caisse_evenements. decision-1 du 11/10/2026 : comptages corrigés soumis à la détermination des stocks finaux.';
comment on function public.fdj_manager_enregistrer_comptages(uuid, jsonb) is
  'Comptages manager. Quart validé : refus (check_violation) si un stock final envoyé reste indéterminé. decision-1 du 11/10/2026.';
comment on function public.fdj_manager_modifier_quart(uuid, date, text, text) is
  'Modification d''un quart par le manager. Passage à valide : continuité complétée, puis refus (check_violation) si un stock final reste indéterminé. decision-1 du 11/10/2026.';
comment on function public.fdj_manager_changer_statut_quart(uuid, text) is
  'Changement de statut par le manager. Passage à valide : continuité complétée, puis refus (check_violation) si un stock final reste indéterminé. decision-1 du 11/10/2026.';
comment on function public.fdj_manager_creer_quart(date, text, uuid, text) is
  'Création d''un quart par le manager. Demandé valide : créé brouillon, complété, contrôlé (check_violation si un stock final reste indéterminé), puis validé. decision-1 du 11/10/2026.';
