---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 16
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=55f41318
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 176-fichiers
  - id: ordre-16-1
    classe: VERIFIED
    valeur: 7b6954881cf4cedd059951d9dc72ad775f5a9150f9f4a71e54a3578b383cd899
  - id: executant-16-1
    classe: DECLARED
    valeur: session-claude-habilitee-pour-SUPABASE_PRODUCTION_ECRITURE
  - id: recette-guardian
    classe: HUMAN
    valeur: #160 6619165763
  - id: go-production
    classe: HUMAN
    valeur: absent — GO écrit de Frédéric SUPABASE_PRODUCTION_MUTATION requis sur #160 avant toute application
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-16 — passage en Production de la clôture serveur du quart (#176 puis #177)

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

Frédéric veut passer en Production ce soir (Guardian #160 6619262144, 03/11 20:37). Cette request demande à l'arbitre de juger le passage et ne constitue **aucune autorisation** : rien n'est appliqué en Production avant le GO écrit de Frédéric (`SUPABASE_PRODUCTION_MUTATION`), cité sur #160. `closes: false`.

Trois gestes distincts, dans cet ordre strict :
1. migration `20261103190000` appliquée en Production, puis relue ;
2. fusion de #176 (`1d32b9033388e4d63eae7e94ae0888f4d92d5c7e`, base `production`, brouillon, CI verte) ;
3. fusion puis déploiement de #177 (`e231067147b50ee65aac3e5c27ff178055d6093d`, base `production`, brouillon, CI verte).

Pas d'auto-merge. Ordre inverse (front avant migration) exclu : dès que #177 est servie, le front n'écrit plus `inventaire_quarts` et personne ne clôt le quart.

## Texte exact de la migration (supabase/migrations/20261103190000_cloture_quart_inventaire_anticipee_et_repli.sql, blob git `089fff6a53af125ec9f31db4032d10e4742d4a81`)

```sql
-- Clôture serveur du quart d'inventaire (lot INVENTAIRE-CAISSE-RENFORT-20261102).
-- Règle : request-14 + request-15, verdict de l'arbitre APPROVED_WITH_CONDITIONS
-- (issue #28, commentaire 6617300941) ; choix C1 et « prise de poste » de Frédéric
-- (03/11/2026, #160 6616736762 et 6617056409).
--
--   1. Population = lignes inventaire_quart_employes du quart dont le shift a le
--      même `quart` que le quart. shifts.quart fait seule foi du rattachement.
--      Toutes ont a_valide_cloture = true -> clôture anticipée, cloture_le = dernier
--      heure_depart. Population vide -> aucune clôture anticipée.
--   2. Repli : fin planifiée + closureDelayMinutes (30 par défaut) ;
--      cloture_le = fin planifiée + délai, exactement. Alerte `cloture_incomplete`
--      si des produits obligatoires du plan n'ont pas été comptés.
--   3. Aucune donnée existante n'est corrigée : les lignes divergentes sont
--      comptées et consignées dans l'audit, jamais déplacées.
--   4. Le cron ignore les quarts déjà clos ; filtre par site à chaque lecture et
--      écriture ; garde de statut ; unicité des alertes. Aucune politique, aucun
--      grant, aucune fonction employé n'est touché (CREATE OR REPLACE conserve les
--      droits de la fonction).
create or replace function public.run_scheduled_inventory_reviews()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record; q record; p record;
  v_fuseau text;
  v_now_local timestamp; v_today date; v_isodow int;
  v_params jsonb; v_review_time time; v_window_start timestamp; v_window_end timestamp;
  v_period_start date; v_period_end date; v_summary jsonb; v_exists boolean;
  v_quart_cle text; v_fin_normal text; v_delai int; v_deadline timestamp; v_alerte_existe boolean;
  v_population int; v_validees int; v_divergentes int; v_dernier_depart timestamptz;
  v_non_comptes int; v_cloture_le timestamptz; v_mode text; v_modifie int;
begin
  for r in select * from station_config loop
    -- A3-3 : le fuseau du site courant, jamais un fuseau global.
    select s.timezone into v_fuseau from sites s where s.site_id = r.site;
    if v_fuseau is null then
      raise warning 'Synthèse inventaire ignorée pour le site % : aucun fuseau déclaré. NEXUS ne traite pas un site à l''heure d''un autre.', r.site;
      continue;
    end if;
    v_now_local := now() at time zone v_fuseau;
    v_today := v_now_local::date;
    v_isodow := extract(isodow from v_now_local);

    v_params := coalesce(r.parametres_inventaire, '{}'::jsonb);
    v_review_time := coalesce(nullif(v_params->>'reviewTime','')::time, '20:00'::time);
    v_window_start := v_today + v_review_time;
    v_window_end := v_window_start + interval '15 minutes';

    if v_params->>'reviewFrequency' = 'daily' and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_start := v_today; v_period_end := v_today;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'daily' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'daily');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'daily', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    if v_params->>'reviewFrequency' = 'weekly' and v_isodow = coalesce(nullif(v_params->>'weeklyReviewDay','')::int, 0) + 1
       and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_end := v_today - 1; v_period_start := v_period_end - 6;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'weekly' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'weekly');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'weekly', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    if v_params->>'reviewFrequency' = 'monthly'
       and extract(day from v_now_local)::int = least(coalesce(nullif(v_params->>'monthlyReviewDay','')::int, 1), extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int)
       and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_start := date_trunc('month', v_today - interval '1 month')::date;
      v_period_end := (date_trunc('month', v_today) - interval '1 day')::date;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'monthly' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'monthly');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'monthly', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    v_delai := coalesce(nullif(v_params->>'closureDelayMinutes','')::int, 30);
    for q in select * from inventaire_quarts where site = r.site and statut <> 'cloture' and date >= v_today - 2 loop
      v_quart_cle := case q.quart when 'matin' then 'quart1' when 'soir' then 'quart2' else null end;
      v_fin_normal := case when v_quart_cle is not null and r.horaires ? v_quart_cle then r.horaires->v_quart_cle->>'fin_normal' else null end;
      v_deadline := case when v_fin_normal is not null then q.date + v_fin_normal::time + (v_delai || ' minutes')::interval else null end;

      -- Clôture anticipée (C1) : seul le shift de même quart fait foi.
      if q.statut in ('ouvert','cloture_en_cours') then
        select count(*) filter (where s.quart = q.quart),
               count(*) filter (where s.quart = q.quart and e.a_valide_cloture),
               count(*) filter (where s.quart is distinct from q.quart),
               max(e.heure_depart) filter (where s.quart = q.quart)
          into v_population, v_validees, v_divergentes, v_dernier_depart
          from inventaire_quart_employes e
          join inventaire_quarts qq on qq.id = e.quart_id and qq.site = r.site
          left join shifts s on s.id = e.shift_id and s.site = r.site
         where e.quart_id = q.id;

        if v_population > 0 and v_validees = v_population then
          v_cloture_le := coalesce(v_dernier_depart, now());
          v_mode := 'anticipee';
        elsif v_deadline is not null and v_now_local > v_deadline then
          v_cloture_le := v_deadline at time zone v_fuseau;
          v_mode := 'repli';
        else
          v_mode := null;
        end if;

        v_non_comptes := 0;
        if v_mode is not null then
          if v_mode = 'repli' then
            select count(*) into v_non_comptes
              from inventaire_plan_items i
              join inventaire_plans_comptage pl on pl.id = i.plan_id
             where pl.site = r.site and pl.date = q.date and pl.quart = q.quart
               and i.site = r.site and i.obligatoire and i.statut = 'a_faire' and i.comptage_id is null;
            if v_non_comptes > 0 then
              select exists(select 1 from inventaire_alertes where quart_id = q.id and type_alerte = 'cloture_incomplete' and statut in ('ouverte','en_cours')) into v_alerte_existe;
              if not v_alerte_existe then
                insert into inventaire_alertes (site, quart_id, type_alerte, gravite, valeur_constatee)
                values (r.site, q.id, 'cloture_incomplete', 'attention', v_non_comptes);
              end if;
            end if;
          end if;

          update inventaire_quarts
             set statut = 'cloture', cloture_le = v_cloture_le
           where id = q.id and site = r.site and statut in ('ouvert','cloture_en_cours');
          get diagnostics v_modifie = row_count;

          if v_modifie > 0 then
            insert into inventaire_audit_log (site, quart_id, entite_type, entite_id, action, ancienne_valeur, nouvelle_valeur, motif, metadata)
            values (r.site, q.id, 'inventaire_quart', q.id, 'cloture_serveur',
                    jsonb_build_object('statut', q.statut),
                    jsonb_build_object('statut', 'cloture', 'cloture_le', v_cloture_le),
                    case v_mode when 'anticipee' then 'Toute la population du quart a validé la clôture' else 'Repli : fin planifiée + délai de clôture' end,
                    jsonb_build_object('mode', v_mode, 'population', v_population, 'validees', v_validees,
                                       'lignes_divergentes', v_divergentes, 'produits_non_comptes', v_non_comptes));
            continue;
          end if;
        end if;
      end if;

      -- Alerte de clôture en retard (inchangée).
      if v_deadline is not null and v_now_local > v_deadline then
        select exists(select 1 from inventaire_alertes where quart_id = q.id and type_alerte = 'cloture_en_retard' and statut in ('ouverte','en_cours')) into v_alerte_existe;
        if not v_alerte_existe then
          insert into inventaire_alertes (site, quart_id, type_alerte, gravite) values (r.site, q.id, 'cloture_en_retard', 'critique');
        end if;
      end if;
    end loop;

    for p in
      select produit_id, count(*) as n from inventaire_alertes
      where site = r.site and produit_id is not null and cree_le >= (v_now_local - interval '7 days')
        and type_alerte not in ('anomalie_repetee','cloture_en_retard','cloture_incomplete','reassort_non_justifie','modification_apres_validation')
      group by produit_id having count(*) >= 3
    loop
      select exists(select 1 from inventaire_alertes where produit_id = p.produit_id and type_alerte = 'anomalie_repetee' and statut in ('ouverte','en_cours') and cree_le >= (v_now_local - interval '7 days')) into v_alerte_existe;
      if not v_alerte_existe then
        insert into inventaire_alertes (site, produit_id, type_alerte, gravite, valeur_constatee) values (r.site, p.produit_id, 'anomalie_repetee', 'attention', p.n);
      end if;
    end loop;
  end loop;
end;
$function$;

-- Restriction (GO de Frédéric 03/11 19:02, Guardian #160 6617703169) : la fonction
-- ferme des quarts sur tous les sites ; seul postgres (cron) doit l'exécuter, comme
-- en Production. Aucun grant n'est accordé.
revoke execute on function public.run_scheduled_inventory_reviews() from public, anon, authenticated;
```

Aucune table, aucune colonne, aucune policy, aucun grant, aucune donnée touchés. Le `revoke` est celui déjà appliqué sur Test (GO de Frédéric 03/11 19:02, #160 6617703169) ; il aligne le droit sur l'état constaté en Production (`proacl = {postgres=X/postgres}`).

## Preuves Test

- Migration appliquée sur Test (`udljdqxerrbbbajxubfn`), estampille `20261103224401`, revoke inclus.
- Épreuve SQL `outils/verifier-cloture-quart-serveur.sql` : couvre les deux ordres (A puis B, B puis A), population vide, repli, alerte `cloture_incomplete`, unicité des alertes, filtre par site, quart déjà clos ignoré.
- Cron réel (job 33, 15 min) sur Test : quart soir du 03/11 (`3f89bbee-c022-4ff9-ac58-7ffc4fb1e153`) clos `anticipee` par le passage de 00:30 UTC ; `cloture_le` = 2026-11-04 00:16:02.206+00 (dernier `heure_depart`) ; audit `cloture_serveur` : population 2, validées 2, lignes_divergentes 0, produits_non_comptes 0.
- Quart matin du 03/11 : clos `repli`, `cloture_le` = fin normale + 30 min (17:30 UTC = 13:30 station).
- Suite complète : 321/328, exactement les 7 rouges connus (CONNUS), aucun nouveau.
- CI de #176 et #177 : non-régression, artefact, Cloudflare verts ; garde « ordre migration → code » qualifiée (`docs/deploiement/qualification-ordre-migration-code.json`).

## Recette

Recette navigateur à deux comptes validée par Guardian : #160 6619165763 (retouches #177 : confirmations en page, plus aucun `confirm(` ni `alert(` natif, bouton retour masqué sur le fil caisse, carte « Commencer la clôture → »). Défaut hors périmètre : #178 (« Couverture du quart » à 0 après comptage), non corrigé ici, non bloquant pour la clôture serveur.

## Mesures Production (lecture seule, projet `uzhjpqpctpvxytxpxoqz`, 03/11/2026, GO 6618342213)

- 321 migrations au registre, dernière `20261101014700`, `20261103190000` absente.
- `run_scheduled_inventory_reviews()` : SECURITY DEFINER, corps md5 `a2477baed2ff3fc3b9ae5bfc26e179c7`, sans `cloture_serveur` ni `anticipee`, `proacl = {postgres=X/postgres}`.
- Aucune ligne de données lue. À re-mesurer immédiatement avant l'écriture (les cinq points ci-dessus) ; toute différence arrête l'application.
- Production a été mesurée à `55f41318` côté branche `production` au moment de ce dépôt.

## Procédure (docs/deploiement/procedure-cloture-quart-serveur-production-20261103.md, versionnée sur #176)

Lot INVENTAIRE-CAISSE-RENFORT-20261102. Migration
`supabase/migrations/20261103190000_cloture_quart_inventaire_anticipee_et_repli.sql`.
Ce document ne constitue aucune autorisation : l'application en Production, la
fusion de #176 et celle de #177 restent trois GO distincts de Frédéric.

## Ordre strict

1. **#176 appliquée en Production, puis relue** (ci-dessous).
2. **#177 fusionnée ensuite.** Dès que #177 est servie, le front n'écrit plus
   `inventaire_quarts` : sans la migration, personne ne clôt le quart.
3. Retour arrière de #177 seule : sans danger (le front d'avant ferme le quart).
   Retour arrière de #176 après #177 : interdit sans retirer #177.

## Ce que fait la migration

`create or replace` de `public.run_scheduled_inventory_reviews()` (SECURITY
DEFINER, search_path public) : clôture anticipée quand toute la population du
quart (shift de même `quart`) a validé ; repli à fin normale + `closureDelayMinutes`
avec `cloture_le` exact et alerte `cloture_incomplete` ; journal
`inventaire_audit_log` (`cloture_serveur`). Aucun DDL destructif, aucune table
touchée, aucune donnée corrigée. Elle finit par
`revoke execute ... from public, anon, authenticated` ; aucun grant.

## Relecture avant d'écrire (catalogue, lecture seule)

- la fonction existe, `prosecdef` vrai, corps sans `cloture_serveur` ni `anticipee` ;
- `proacl` = `{postgres=X/postgres}` (état constaté le 03/11/2026) ;
- les colonnes et contraintes citées par le corps existent (mesurées le 03/11/2026).

## Relecture après application

- corps contenant `cloture_serveur` et `anticipee` ;
- `proacl` toujours limité à `postgres` : aucun EXECUTE pour public, anon, authenticated ;
- job cron `nexus-inventaire-reviews` actif ;
- à fusionner #177 seulement si les trois points sont vrais.

## Plan de retour arrière

- Avant d'écrire : capturer en lecture seule la définition actuelle (`pg_get_functiondef`) et la déposer sur le rail ; elle doit avoir le md5 `a2477baed2ff3fc3b9ae5bfc26e179c7`, sinon arrêt.
- Retour arrière de la migration : `create or replace function public.run_scheduled_inventory_reviews()` avec cette définition capturée, puis relecture : md5 identique, `proacl = {postgres=X/postgres}`, job cron `nexus-inventaire-reviews` actif. Le `revoke` n'est pas à défaire (état d'origine).
- #177 seule : retour arrière sans danger (le front d'avant ferme le quart).
- #176 après #177 : interdit sans retirer #177.
- Quarts déjà clos par la fonction : aucune donnée à réparer (le journal `cloture_serveur` les identifie).

## Ce qui reste hors de ce passage

L2a (photo Decenium du soir, Test), L4a (défaut A, porte `SECURITE_RLS_SITE_ID`, GO requis), L3 (roulement renfort), #178. Ordre inverse (Test B d'abord) sur un autre quart : Guardian l'a jugé non bloquant.

## Décision demandée

Verdict de l'arbitre sur le passage de Production et sur le texte exact ci-dessus. Si APPROVED, Guardian présente ce texte à Frédéric pour son GO écrit ; l'exécution ne commence qu'une fois ce GO cité sur #160.
