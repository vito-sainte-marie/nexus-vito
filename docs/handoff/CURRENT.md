<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE3-20261018/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE3-20261018
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=8e8b7ba2
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 157-fichiers
---
# SÉCURITÉ SECURITY DEFINER — Étape 3 : fermer l'exécution directe des 8 fonctions de trigger (TEST exclusivement)

Suite du lot `SECURITE-DEFINER-ETAPE1-20261018`, clos par decision-3 (`4c4a9fe0`, APPROVED, `closes: true`) après l'étape 1 (2 `REVOKE` anon) et l'étape 2 (17 `search_path = public, pg_temp`), toutes deux exécutées et vérifiées sur Test. Cette demande ne porte que sur l'**étape 3**. Les étapes 4 (`nexus_identifiant_de_connexion`) et 5 (report en Production), ainsi que les 24 autres fonctions `search_path=public`, auront chacune leur demande. **Aucun SQL d'écriture n'a été exécuté pour cette demande** ; seules des lectures de catalogue (SELECT) ont servi, sur Test et sur Production (lecture seule). Ni Production, ni migration de dépôt, ni fusion, ni `claude.yml`, ni modification des privilèges de `nexus_ci_recette`.

## Constat mesuré

Huit fonctions SECURITY DEFINER de `public` renvoient `trigger` (propriétaire `postgres`, `search_path = public, pg_temp` sur Test depuis l'étape 2). Leur ACL est identique sur Test et sur Production : `{=X/postgres, postgres=X/postgres, anon=X/postgres, authenticated=X/postgres, service_role=X/postgres}` — donc EXECUTE accordé à `PUBLIC`, `anon`, `authenticated` et `service_role`.

| Fonction | Trigger(s) lié(s) (tous `tgenabled = O` sur Test) |
|---|---|
| `carburant_resoudre_prix_achat_snapshot()` | `carburant_reception_visite_lignes.trg_carburant_resoudre_prix_achat_snapshot` |
| `fdj_sync_releve_apres_cash_control()` | `fdj_cash_controls.trg_fdj_sync_releve_apres_cash_control` |
| `fdj_tracer_correction_stock_initial()` | `fdj_shift_counts.trg_fdj_trace_correction_stock_initial` |
| `flag_modification_apres_validation()` | `inventaire_comptages.trg_flag_modification_apres_validation` |
| `flag_mouvement_non_justifie()` | `inventaire_mouvements.trg_flag_mouvement_non_justifie` |
| `nexus_forcer_site_unique()` | `mission_catalog.mission_catalog_site_unique`, `shifts.shifts_site_unique` |
| `nexus_inventaire_detecter_conditionnement()` | `inventaire_zone_produit.trg_inventaire_detecter_conditionnement` |
| `nexus_site_supprimable()` | `sites.nexus_site_supprimable` |

Une fonction de trigger ne peut pas être appelée comme une fonction ordinaire (PostgreSQL refuse : « trigger functions can only be called as triggers »), et le droit EXECUTE n'est contrôlé qu'à la création du trigger, pas à son déclenchement. Ces droits n'ont donc aucune utilité fonctionnelle ; ils élargissent seulement la surface exposée par PostgREST/les audits. Précédent sur Test : sur 22 fonctions de trigger SECURITY DEFINER de `public`, **13 sont déjà fermées** à `anon` et `authenticated`, 1 (`nexus_garde_regularisation_reception`, étape 1) est fermée à `anon` mais garde `authenticated` (hors périmètre ici), et ces 8 sont les seules encore ouvertes à `anon`. Aucune des 8 n'est référencée par une politique RLS (0 dépendance `pg_policy`) et aucune n'est appelée par le code du dépôt (`main`, recherche `rpc(` et appels directs : 0 occurrence).

## SQL proposé (NON exécuté)

```sql
revoke execute on function public.carburant_resoudre_prix_achat_snapshot() from public, anon, authenticated;
revoke execute on function public.fdj_sync_releve_apres_cash_control() from public, anon, authenticated;
revoke execute on function public.fdj_tracer_correction_stock_initial() from public, anon, authenticated;
revoke execute on function public.flag_modification_apres_validation() from public, anon, authenticated;
revoke execute on function public.flag_mouvement_non_justifie() from public, anon, authenticated;
revoke execute on function public.nexus_forcer_site_unique() from public, anon, authenticated;
revoke execute on function public.nexus_inventaire_detecter_conditionnement() from public, anon, authenticated;
revoke execute on function public.nexus_site_supprimable() from public, anon, authenticated;
```

Huit instructions, une seule transaction. `PUBLIC` est révoqué avec `anon`/`authenticated` parce qu'un `REVOKE` sur le seul `PUBLIC` ne retire pas les droits explicites d'`anon` (et inversement). `postgres` (propriétaire) et `service_role` sont **laissés tels quels** pour ne pas élargir le périmètre. Pas de `GRANT`, pas de `CREATE OR REPLACE`, pas de DDL de table. Cible : Supabase **Test** `udljdqxerrbbbajxubfn` exclusivement.

## Préconditions (à relire le jour de l'exécution)

1. Rail relu : une décision matérialisée couvre cette opération ; aucun STOP.
2. Les 8 signatures existent, sont SECURITY DEFINER, renvoient `trigger`, et ont l'ACL ci-dessus.
3. Relevé préalable enregistré : `has_function_privilege` anon/authenticated/public/service_role de chacune, `tgenabled` des 9 triggers, état du job `nexus-inventaire-reviews`.

## Postconditions (épreuves)

1. Les 8 n'ont plus EXECUTE pour `public`, `anon` ni `authenticated` ; `service_role` et `postgres` inchangés ; SECURITY DEFINER, propriétaire et `proconfig` inchangés.
2. Les 9 triggers restent `tgenabled = O`.
3. Épreuve fonctionnelle, dans un bloc annulé, sous `authenticated` : une écriture déclenchant chacun des triggers touchés reste évaluée (la garde ou l'écriture se comporte comme avant, sans erreur `permission denied for function`) — au minimum `nexus_forcer_site_unique` (insertion `shifts`) et `flag_mouvement_non_justifie` (mouvement d'inventaire), plus la garde de régularisation de l'étape 1 qui refuse toujours (42501).
4. Appel direct sous `anon` et `authenticated` : refusé (`permission denied` ou « can only be called as triggers »).
5. Le job `nexus-inventaire-reviews` a un passage `succeeded` après l'opération.
6. Comparaison avant/après : l'ACL des autres fonctions SECURITY DEFINER de `public` (141) est inchangée ; seules ces 8 diffèrent. Fonctions de trigger SECURITY DEFINER de `public` ouvertes à `anon` : 8 → 0 ; fermées aux deux rôles : 13 → 21 (la 22e, `nexus_garde_regularisation_reception`, inchangée).

## Risques

Très faible : aucun chemin d'exécution légitime n'invoque ces fonctions directement, et le déclenchement d'un trigger ne vérifie pas EXECUTE. Risque résiduel : une migration future qui ferait `DROP FUNCTION` puis `CREATE FUNCTION` rouvrirait l'ACL par défaut de `public` (default privileges) ; à garder en tête pour le report en Production, où la migration de dépôt devra porter les `REVOKE`.

## Retour arrière

```sql
grant execute on function public.<nom>() to public, anon, authenticated;
```

pour chacune des 8, ce qui rétablit l'ACL d'origine (le `service_role` n'a pas été touché).

## Ce qui reste hors de cette demande

Report en Production (sa propre demande, son GO et une migration de dépôt) ; `nexus_identifiant_de_connexion` (étape 4) ; les 24 autres fonctions `search_path=public` ; tout changement de `service_role`. Ce changement serait appliqué sur Test sans fichier de migration : écart de dépôt assumé jusqu'au report en Production, comme pour les étapes 1 et 2.

## Question d'arbitrage

Autorisez-vous ces 8 `REVOKE EXECUTE … FROM public, anon, authenticated` sur **Supabase Test seulement**, sous les préconditions et postconditions ci-dessus ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes` pour cette étape. Rien n'est appliqué avant une décision matérialisée.
