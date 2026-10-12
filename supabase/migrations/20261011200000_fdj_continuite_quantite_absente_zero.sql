-- ============================================================================
-- FDJ — continuité des stocks : quantité absente traitée comme 0 (handoff
-- MISSION PATRIMOINE du 11/10/2026, Frédéric).
--
-- Cause racine. Une saisie manager crée la ligne d'un jeu avec un stock de
-- départ et une fin NULL (MISSION PATRIMOINE, 539e87bc : début 0, fin vide).
-- L'écran employé n'hérite que des fins non NULL (chargerDernierStockFinal),
-- puis n'envoie que les jeux dont le début et la fin sont connus : le jeu
-- disparaît sans invite du quart suivant, et de tous les suivants. Aucune
-- commande serveur n'appliquait « quantité absente = 0 » : la continuité
-- reposait entièrement sur le navigateur.
--
-- 1. fdj_stock_initial_herite(p_shift_id, p_game_id) — AUTORITÉ MÉTIER
--    Stock de départ hérité d'un jeu, lu dans la base, jamais dans le
--    navigateur. Remonte au dernier quart 'valide' du site, antérieur au
--    quart, qui porte une ligne non vide pour ce jeu :
--      · fin renseignée                          -> cette fin
--                                                   ('stock_final_precedent') ;
--      · fin absente, début + appro = 0           -> 0
--                                                   ('quantite_absente_zero') ;
--      · fin absente, il restait du stock         -> NULL ('inconnu') ;
--      · aucune ligne, mais un quart précédent    -> 0 ('jamais_compte') ;
--      · aucun quart précédent                    -> NULL
--                                                   ('sans_quart_precedent').
--    « inconnu » n'est pas 0 : traiter comme 0 une fin absente alors qu'il
--    restait du stock fabriquerait une vente. Écart assumé par rapport à la
--    règle littérale, soumis à l'arbitre (0 cas en Production le 11/10).
--
-- 2. fdj_completer_continuite_quart(p_shift_id, p_source, p_game_id)
--    Sur un quart 'brouillon' seulement, pour chaque jeu actif sans ligne et
--    chaque ligne sans stock de départ : pose le stock hérité
--    (stock_initial_auto = true). Ne remplace JAMAIS une valeur saisie (seuls
--    les débuts NULL sont touchés), n'écrit ni appro ni fin, n'écrit aucun
--    mouvement. Journal : fdj_audit_log 'correction_stock_initial' avec
--    metadata.source (commande appelante), complete_par, regle et
--    quart_source ; ligne créée -> écrite ici, ligne existante -> par le
--    déclencheur (point 3). « inconnu » -> alerte
--    'continuite_stock_a_verifier' (une seule par quart et par jeu), aucune
--    valeur posée. Rend le nombre de jeux complétés.
--    Un quart 'valide' n'est jamais touché : aucun recalcul financier d'une
--    caisse confirmée ou certifiée.
--
-- 3. fdj_tracer_correction_stock_initial (déclencheur) : quand la reprise
--    vient de fdj_completer_continuite_quart, motif et metadata le disent
--    (réglage transactionnel nexus.fdj_reprise_stock_initial). Sinon,
--    inchangé.
--
-- 4. fdj_ecrire_saisies_caisse, 5. fdj_valider_ouverture_quart,
-- 6. fdj_incrementer_appro_shift_count : appellent la complétion après leur
--    propre écriture. Le chemin employé est ainsi couvert à l'ouverture, à
--    l'approvisionnement et à la clôture, quel que soit l'écran servi.
--    fdj_valider_ouverture_quart rend en plus 'jeux_completes'.
--
-- 7. fdj_confirmer_caisse :
--    · refuse ('saisie_incomplete', liste 'jeux') un jeu dont la fin est
--      absente alors que début + appro > 0 — cas d'un jeu complété par la
--      base à l'insu de l'écran ; recharger l'écran de clôture le fait
--      apparaître. Une fin absente à stock nul passe : elle vaut 0 ;
--    · le relevé porte continuite_stock_a_verifier (alerte non résolue sur
--      le quart) au lieu de false en dur, et devient alors 'provisoire'.
--
-- Non modifiées : fdj_manager_enregistrer_comptages et les autres commandes
-- manager (un quart 'valide' n'est pas complété ; un brouillon l'est à
-- l'écriture employé suivante). Une fin NULL reste NULL : aucune valeur
-- fictive n'est écrite dans le quart précédent ; elle est lue comme 0 par
-- l'héritage.
--
-- Contrôles d'accès : ceux des commandes appelantes, inchangés
-- (fdj_quart_ouvert_de_l_employe, fdj_quart_de_l_employe,
-- fdj_exiger_jeu_du_site). Les deux nouvelles fonctions ne sont exécutables
-- que par service_role : elles ne sont appelées que par des commandes
-- SECURITY DEFINER. ACL des commandes redéfinies réaffirmées à l'identique
-- (A6, 20261010150000) ; celle du déclencheur n'est pas touchée.
--
-- Prérequis : registre ≥ 20261011090000 (Test 318). Aucune donnée
-- existante n'est réécrite par la migration elle-même : elle ne fait que
-- (re)définir des fonctions. Idempotente (create or replace).
--
-- Retour arrière :
--   drop function public.fdj_completer_continuite_quart(uuid, text, uuid);
--   drop function public.fdj_stock_initial_herite(uuid, uuid);
--   puis rétablir (create or replace, définitions identiques à celles
--   servies le 11/10 sur Test) :
--     fdj_confirmer_caisse, fdj_ecrire_saisies_caisse  <- 20260916220600 ;
--     fdj_valider_ouverture_quart,
--     fdj_incrementer_appro_shift_count                 <- 20261010150000 ;
--     fdj_tracer_correction_stock_initial               <- 20260830222700
--       (l'ACL de la fonction de déclencheur est conservée ; le
--       déclencheur n'est pas recréé).
--   Les lignes de journal et d'alerte écrites entre-temps restent
--   (historique immuable).
-- ============================================================================

-- 1. Autorité métier du stock de départ hérité.
create or replace function public.fdj_stock_initial_herite(
  p_shift_id uuid,
  p_game_id  uuid,
  out valeur          numeric,
  out regle           text,
  out shift_source_id uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_shift public.fdj_shifts;
  v_src   record;
begin
  select * into v_shift from public.fdj_shifts s where s.id = p_shift_id;
  if not found then
    raise exception 'Quart FDJ introuvable : %', p_shift_id using errcode = 'no_data_found';
  end if;

  -- Dernier quart validé du site, antérieur, portant une ligne non vide
  -- pour ce jeu. Une ligne entièrement vide ne dit rien : on remonte.
  select s.id, c.stock_initial, c.appro, c.stock_final
    into v_src
    from public.fdj_shifts s
    join public.fdj_shift_counts c on c.shift_id = s.id and c.game_id = p_game_id
   where s.site = v_shift.site
     and s.statut = 'valide'
     and (s.date < v_shift.date or (s.date = v_shift.date and s.quart < v_shift.quart))
     and (c.stock_final is not null or c.stock_initial is not null or coalesce(c.appro, 0) <> 0)
   order by s.date desc, s.quart desc
   limit 1;

  if found then
    shift_source_id := v_src.id;
    if v_src.stock_final is not null then
      valeur := v_src.stock_final;
      regle  := 'stock_final_precedent';
    elsif v_src.stock_initial is not null and v_src.stock_initial + coalesce(v_src.appro, 0) = 0 then
      -- Quantité absente traitée comme 0 : il ne restait rien à vendre.
      valeur := 0;
      regle  := 'quantite_absente_zero';
    else
      -- Il restait du stock et la fin manque : 0 fabriquerait une vente.
      valeur := null;
      regle  := 'inconnu';
    end if;
    return;
  end if;

  if exists (
    select 1 from public.fdj_shifts s
     where s.site = v_shift.site
       and s.statut = 'valide'
       and (s.date < v_shift.date or (s.date = v_shift.date and s.quart < v_shift.quart))
  ) then
    valeur := 0;
    regle  := 'jamais_compte';
  else
    valeur := null;
    regle  := 'sans_quart_precedent';
  end if;
end;
$$;

-- 2. Complétion de la continuité d'un quart en brouillon.
create or replace function public.fdj_completer_continuite_quart(
  p_shift_id uuid,
  p_source   text,
  p_game_id  uuid default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift  public.fdj_shifts;
  v_jeu    record;
  v_herite record;
  v_motif  text;
  v_id     uuid;
  v_n      int := 0;
begin
  select * into v_shift from public.fdj_shifts s where s.id = p_shift_id;
  -- Un quart validé n'est jamais complété : sa caisse est confirmée.
  if not found or v_shift.statut <> 'brouillon' then
    return 0;
  end if;

  for v_jeu in
    select g.id as game_id, g.prix, c.id as count_id
      from public.fdj_games g
      left join public.fdj_shift_counts c on c.shift_id = p_shift_id and c.game_id = g.id
     where g.site = v_shift.site
       and (p_game_id is null or g.id = p_game_id)
       and ((c.id is null and g.actif) or (c.id is not null and c.stock_initial is null))
     order by g.ordre_affichage, g.nom
  loop
    select * into v_herite from public.fdj_stock_initial_herite(p_shift_id, v_jeu.game_id);

    if v_herite.regle = 'inconnu' then
      if not exists (
        select 1 from public.fdj_alertes a
         where a.shift_id = p_shift_id
           and a.game_id = v_jeu.game_id
           and a.type = 'continuite_stock_a_verifier'
           and not a.resolue_automatiquement
      ) then
        insert into public.fdj_alertes (
          site, type, shift_id, shift_precedent_id, game_id,
          valeur_quart_precedent, valeur_saisie, employee_id, motif
        ) values (
          v_shift.site, 'continuite_stock_a_verifier', p_shift_id, v_herite.shift_source_id, v_jeu.game_id,
          null, null, v_shift.employee_id,
          'Stock final du quart précédent non renseigné alors qu''il restait du stock'
        );
      end if;
      continue;
    end if;

    if v_herite.valeur is null then
      continue;  -- sans quart précédent : rien à hériter
    end if;

    v_motif := case v_herite.regle
                 when 'stock_final_precedent' then 'Reprise du stock final du quart précédent'
                 when 'quantite_absente_zero' then 'Reprise du stock du quart précédent : quantité absente traitée comme 0'
                 else 'Jeu jamais compté : stock de départ 0'
               end;

    if v_jeu.count_id is null then
      v_id := null;
      insert into public.fdj_shift_counts as c (
        site, shift_id, game_id, stock_initial, appro, stock_final, stock_initial_auto, updated_at
      ) values (
        v_shift.site, p_shift_id, v_jeu.game_id, v_herite.valeur, 0, null, true, now()
      )
      on conflict (shift_id, game_id) do nothing
      returning c.id into v_id;
      if v_id is not null then
        insert into public.fdj_audit_log (
          site, shift_id, entite_type, entite_id, action,
          ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata
        ) values (
          v_shift.site, p_shift_id, 'fdj_shift_counts', v_id, 'correction_stock_initial',
          jsonb_build_object('stock_initial', null),
          jsonb_build_object('stock_initial', v_herite.valeur),
          (select auth.uid()),
          v_motif,
          jsonb_build_object(
            'game_id', v_jeu.game_id, 'source', p_source,
            'complete_par', 'fdj_completer_continuite_quart', 'ligne_creee', true,
            'regle', v_herite.regle, 'quart_source', v_herite.shift_source_id
          )
        );
        v_n := v_n + 1;
      end if;
    else
      -- Ligne existante sans début (créée par l'approvisionnement ou par une
      -- saisie partielle) : le déclencheur journalise, avec ce contexte.
      perform set_config('nexus.fdj_reprise_stock_initial',
        jsonb_build_object(
          'motif', v_motif, 'source', p_source,
          'complete_par', 'fdj_completer_continuite_quart',
          'regle', v_herite.regle, 'quart_source', v_herite.shift_source_id
        )::text, true);
      update public.fdj_shift_counts c
         set stock_initial      = v_herite.valeur,
             stock_initial_auto = true,
             ventes_qte         = case when c.stock_final is null then null
                                       else v_herite.valeur + coalesce(c.appro, 0) - c.stock_final end,
             ventes_valeur      = public.fdj_ventes_jeu(v_herite.valeur, coalesce(c.appro, 0), c.stock_final, v_jeu.prix),
             updated_at         = now()
       where c.id = v_jeu.count_id
         and c.stock_initial is null;
      if found then
        v_n := v_n + 1;
      end if;
      perform set_config('nexus.fdj_reprise_stock_initial', '', true);
    end if;
  end loop;

  return v_n;
end;
$$;

-- 3. Déclencheur de journal : reprise automatique distinguée.
CREATE OR REPLACE FUNCTION public.fdj_tracer_correction_stock_initial()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- Posé par fdj_completer_continuite_quart le temps de son update : la
  -- reprise automatique est journalisée avec sa règle et son quart source,
  -- pas comme une correction de l'employé.
  v_reprise jsonb := nullif(current_setting('nexus.fdj_reprise_stock_initial', true), '')::jsonb;
begin
  if old.stock_initial is distinct from new.stock_initial then
    insert into public.fdj_audit_log (
      site, shift_id, entite_type, entite_id, action,
      ancienne_valeur, nouvelle_valeur, acteur_id, motif, metadata
    ) values (
      new.site,
      new.shift_id,
      'fdj_shift_counts',
      new.id,
      'correction_stock_initial',
      jsonb_build_object('stock_initial', old.stock_initial),
      jsonb_build_object('stock_initial', new.stock_initial),
      auth.uid(),
      coalesce(v_reprise->>'motif', 'Correction du stock de départ avant clôture'),
      jsonb_build_object('game_id', new.game_id, 'source', 'fdj_shift_counts_trigger')
        || coalesce(v_reprise - 'motif', '{}'::jsonb)
    );
  end if;
  return new;
end;
$function$;

-- 4. Comptages de clôture : complétion après l'upsert.
CREATE OR REPLACE FUNCTION public.fdj_ecrire_saisies_caisse(p_shift_id uuid, p_site text, p_auteur_id uuid, p_comptages jsonb, p_lots_payes_grattage numeric, p_caisse_tirages numeric)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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

      -- stock_initial_auto N'EST VOLONTAIREMENT NI INSÉRÉE NI MISE À JOUR.
      -- Ce n'est pas un oubli, c'est la seule écriture correcte des deux côtés :
      --   · ligne existante (le jeu a été compté à l'ouverture) — le `do update`
      --     ne cite pas la colonne, donc la valeur posée à l'ouverture SURVIT.
      --     Un employé qui a corrigé lui-même son stock de départ l'a passée à
      --     false ; la clôture ne doit pas la remettre à true et rendre sa
      --     saisie réécrasable par les outils de reprise.
      --   · ligne créée ici (jeu compté seulement à la clôture) — la colonne est
      --     `not null default false` depuis 20260817004129, et false veut dire
      --     « valeur d'un humain, ne pas la réécrire automatiquement ». C'est le
      --     défaut prudent : présumer l'inverse autoriserait un outil à écraser
      --     un chiffre que personne n'a hérité de nulle part.
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

  -- Continuité : tout jeu actif sans ligne, ou ligne sans stock de départ,
  -- reçoit le stock de départ hérité du quart précédent (quantité absente
  -- traitée comme 0). Jamais une valeur saisie : seuls les débuts NULL.
  perform public.fdj_completer_continuite_quart(p_shift_id, 'fdj_ecrire_saisies_caisse');

  -- Deux rapports distincts, comme le front servi (upsert par
  -- (shift_id, type_rapport)).
  --
  -- NULL veut dire « non fourni », jamais « efface ce qui est enregistré » —
  -- c'est déjà la règle de la boucle de comptages ci-dessus (`if p_comptages
  -- is not null`) et celle que fdj_corriger_caisse_confirmee documente pour
  -- chacun de ses arguments. Deux commandes sœurs ne peuvent pas donner deux
  -- sens opposés au même NULL (Article 11).
  --
  -- La première rédaction écrasait sans condition. Comme cette procédure est
  -- appelée AVANT le contrôle de complétude de fdj_confirmer_caisse, et que ce
  -- contrôle refuse par un `return` (donc sans annuler la transaction), une
  -- confirmation incomplète effaçait les montants du brouillon puis rendait un
  -- refus : un refus qui détruisait la saisie qu'il reprochait d'être
  -- incomplète. Prouvé sur nexus-test le 17/09/2026, dans une transaction
  -- annulée.
  --
  -- La garde ci-dessous ne cherche pas à empêcher toute écriture sur le chemin
  -- du refus : ce qui est écrit là, ce sont les montants que l'employé vient de
  -- saisir, et les conserver est précisément ce qu'il faut faire — il relit son
  -- écran, complète ce qui manque et reconfirme. Ce qu'il ne faut pas faire,
  -- c'est effacer. C'est donc la destruction qui disparaît, pas l'écriture.
  if p_lots_payes_grattage is not null then
    insert into public.fdj_reports (site, shift_id, type_rapport, lots_payes_grattage, saisi_par)
    values (p_site, p_shift_id, 'journalier', p_lots_payes_grattage, p_auteur_id)
    on conflict (shift_id, type_rapport) do update
      set lots_payes_grattage = excluded.lots_payes_grattage,
          saisi_par           = excluded.saisi_par;
  end if;

  if p_caisse_tirages is not null then
    insert into public.fdj_reports (site, shift_id, type_rapport, caisse_tirages, saisi_par)
    values (p_site, p_shift_id, 'temps_reel', p_caisse_tirages, p_auteur_id)
    on conflict (shift_id, type_rapport) do update
      set caisse_tirages = excluded.caisse_tirages,
          saisi_par      = excluded.saisi_par;
  end if;
end;
$function$;

-- 5. Ouverture validée : complétion après la boucle.
CREATE OR REPLACE FUNCTION public.fdj_valider_ouverture_quart(p_shift_id uuid, p_comptages jsonb)
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
  v_completes int;
begin
  v_shift := public.fdj_quart_ouvert_de_l_employe(p_shift_id);
  if p_comptages is not null and jsonb_typeof(p_comptages) <> 'array' then
    raise exception 'Comptages attendus sous forme de tableau.'
      using errcode = 'invalid_parameter_value';
  end if;

  for v_ligne in select * from jsonb_array_elements(coalesce(p_comptages, '[]'::jsonb)) loop
    v_game := nullif(v_ligne->>'game_id', '')::uuid;
    perform public.fdj_exiger_jeu_du_site(v_game, v_shift.site);
    insert into public.fdj_shift_counts as c (
      site, shift_id, game_id, stock_initial, appro, stock_final,
      stock_initial_auto, updated_at
    ) values (
      v_shift.site, p_shift_id, v_game,
      nullif(v_ligne->>'stock_initial', '')::numeric,
      coalesce(nullif(v_ligne->>'appro', '')::numeric, 0),
      nullif(v_ligne->>'stock_final', '')::numeric,
      coalesce((v_ligne->>'stock_initial_auto')::boolean, false),
      now()
    )
    on conflict (shift_id, game_id) do update
      set stock_initial      = excluded.stock_initial,
          appro              = excluded.appro,
          stock_final        = excluded.stock_final,
          stock_initial_auto = excluded.stock_initial_auto,
          updated_at         = excluded.updated_at;
    v_n := v_n + 1;
  end loop;

  -- Continuité : les jeux que l'écran n'a pas envoyés (fin précédente
  -- absente, jeu jamais compté) reçoivent leur stock de départ hérité.
  v_completes := public.fdj_completer_continuite_quart(p_shift_id, 'fdj_valider_ouverture_quart');

  update public.fdj_shifts
     set ouverture_validee = true, ouverture_validee_le = now()
   where id = p_shift_id;

  return jsonb_build_object('shift_id', p_shift_id, 'comptages', v_n, 'jeux_completes', v_completes);
end;
$function$;

-- 6. Approvisionnement : stock de départ hérité pour une ligne neuve.
CREATE OR REPLACE FUNCTION public.fdj_incrementer_appro_shift_count(p_site text, p_shift_id uuid, p_game_id uuid, p_delta numeric)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_shift public.fdj_shifts;
  v_nouvel_appro numeric;
begin
  v_shift := public.fdj_quart_ouvert_de_l_employe(p_shift_id);
  if p_site is distinct from v_shift.site then
    raise exception 'Site incohérent avec le quart FDJ.'
      using errcode = 'insufficient_privilege';
  end if;
  perform public.fdj_exiger_jeu_du_site(p_game_id, v_shift.site);
  if p_delta is null then
    raise exception 'Quantité d''appro manquante.'
      using errcode = 'invalid_parameter_value';
  end if;

  insert into public.fdj_shift_counts (site, shift_id, game_id, appro, updated_at)
  values (v_shift.site, p_shift_id, p_game_id, p_delta, now())
  on conflict (shift_id, game_id) do update
    set appro = coalesce(public.fdj_shift_counts.appro, 0) + excluded.appro,
        updated_at = now()
  returning appro into v_nouvel_appro;
  -- Une ligne créée par l'approvisionnement n'a pas de stock de départ :
  -- il est hérité du quart précédent, sinon la clôture ignorerait le jeu.
  perform public.fdj_completer_continuite_quart(p_shift_id, 'fdj_incrementer_appro_shift_count', p_game_id);
  return v_nouvel_appro;
end;
$function$;

-- 7. Confirmation de caisse : fin absente à stock restant refusée ;
--    continuité à vérifier reportée au relevé.
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
  v_jeux_sans_fin   jsonb;
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

  -- Un jeu dont il restait du stock (début + appro > 0) et dont la fin est
  -- absente ne se clôt pas : sa fin vide serait lue comme « inconnu » par
  -- le quart suivant. Cas d'un jeu complété par la base à l'insu de
  -- l'écran (fdj_completer_continuite_quart) : recharger l'écran le fait
  -- apparaître. Une fin absente à stock nul passe : elle vaut 0.
  select coalesce(jsonb_agg(g.nom order by g.ordre_affichage, g.nom), '[]'::jsonb)
    into v_jeux_sans_fin
    from public.fdj_shift_counts c
    join public.fdj_games g on g.id = c.game_id
   where c.shift_id = p_shift_id
     and c.stock_final is null
     and c.stock_initial is not null
     and c.stock_initial + coalesce(c.appro, 0) > 0;
  if jsonb_array_length(v_jeux_sans_fin) > 0 then
    return jsonb_build_object(
      'confirme', false,
      'motif', 'saisie_incomplete',
      'jeux', v_jeux_sans_fin,
      'message', 'Stock final non renseigné pour : '
        || (select string_agg(x, ', ') from jsonb_array_elements_text(v_jeux_sans_fin) x)
        || '. Rechargez l''écran de clôture : le stock de départ de ce jeu a été repris du quart précédent ; indiquez son stock final.'
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

-- 8. Contrôles d'accès.
revoke all on function public.fdj_stock_initial_herite(uuid, uuid) from public;
revoke all on function public.fdj_stock_initial_herite(uuid, uuid) from anon;
revoke all on function public.fdj_stock_initial_herite(uuid, uuid) from authenticated;
grant execute on function public.fdj_stock_initial_herite(uuid, uuid) to service_role;

revoke all on function public.fdj_completer_continuite_quart(uuid, text, uuid) from public;
revoke all on function public.fdj_completer_continuite_quart(uuid, text, uuid) from anon;
revoke all on function public.fdj_completer_continuite_quart(uuid, text, uuid) from authenticated;
grant execute on function public.fdj_completer_continuite_quart(uuid, text, uuid) to service_role;

revoke all on function public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric) from public;
revoke all on function public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric) from anon;
revoke all on function public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric) from authenticated;
grant execute on function public.fdj_ecrire_saisies_caisse(uuid, text, uuid, jsonb, numeric, numeric) to service_role;

revoke all on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) from public;
revoke all on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) from anon;
grant execute on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) to authenticated;
grant execute on function public.fdj_confirmer_caisse(uuid, jsonb, numeric, numeric, numeric, numeric) to service_role;

revoke all on function public.fdj_valider_ouverture_quart(uuid, jsonb) from public;
revoke all on function public.fdj_valider_ouverture_quart(uuid, jsonb) from anon;
grant execute on function public.fdj_valider_ouverture_quart(uuid, jsonb) to authenticated;
grant execute on function public.fdj_valider_ouverture_quart(uuid, jsonb) to service_role;

revoke all on function public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric) from public;
revoke all on function public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric) from anon;
grant execute on function public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric) to authenticated;
grant execute on function public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric) to service_role;

comment on function public.fdj_stock_initial_herite(uuid, uuid) is
  'Stock de départ hérité d''un jeu pour un quart : fin du dernier quart validé portant une ligne non vide ; fin absente à stock nul -> 0 ; jamais compté -> 0 ; fin absente avec stock restant -> NULL (inconnu). Autorité métier de la continuité (handoff MISSION PATRIMOINE, 11/10/2026).';
comment on function public.fdj_completer_continuite_quart(uuid, text, uuid) is
  'Pose le stock de départ hérité (fdj_stock_initial_herite) sur les jeux actifs sans ligne et les lignes sans début d''un quart en brouillon. Ne remplace jamais une valeur saisie ; journalisé ; « inconnu » -> alerte continuite_stock_a_verifier.';
