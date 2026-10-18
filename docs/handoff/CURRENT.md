<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE1-20261018/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE1-20261018
seq: 2
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
# SÉCURITÉ SECURITY DEFINER — Étape 2 : épingler `pg_temp` en dernier dans le `search_path` des 17 fonctions exposées à `anon` (TEST exclusivement)

Suite de l'étape 1 (decision-1 `c8227985`, deux `REVOKE` exécutés sur Test le 18/10/2026, vérifiés : `anon` fermé, job `nexus-inventaire-reviews` `succeeded` à 13:30 UTC, garde de trigger toujours active). Cette demande ne porte que sur l'**étape 2**. Les étapes 3 à 5 (fonctions de trigger, `nexus_identifiant_de_connexion`, report en Production) auront chacune leur demande. **Aucun SQL d'écriture n'a été exécuté pour cette demande** ; seules des lectures de catalogue (SELECT) ont servi aux mesures, sur Test et sur Production (lecture seule). Ni Production, ni migration de dépôt, ni fusion, ni nouveau GRANT, ni modification des privilèges de `nexus_ci_recette`, ni `claude.yml`.

## Preuve des conditions de decision-1

Exécution des deux `REVOKE` sur Supabase Test le 18/10/2026 (~13:24 UTC), sans autre instruction. Vérifications faites ensuite, par lecture de catalogue et du journal du job :

- Conditions avant exécution : rail relu (decision-1 c8227985 présente, aucune décision contraire) ; signatures exactes et EXECUTE `anon` vrai avant ; job `nexus-inventaire-reviews` actif, utilisateur `postgres` ; droits `authenticated` relevés avant.
- Après : `anon` sans EXECUTE sur `run_scheduled_inventory_reviews()` et `nexus_garde_regularisation_reception()` ; droits `authenticated` inchangés ; fonctions SECURITE DEFINER hors lot exposées à `anon` passées de 19 à 17, ensemble identique à Production.
- Job `nexus-inventaire-reviews` : passage `succeeded` à 13:30:00 UTC, postérieur à l'opération.
- Garde de trigger toujours active (refus 42501 confirmé).
- Aucun GRANT, aucun ALTER FUNCTION, aucune modification pour `nexus_ci_recette`, rien en Production, pas de retour arrière nécessaire.

## Constat mesuré

Les 17 fonctions SECURITY DEFINER de `public` encore exécutables par `anon` portent toutes `search_path=public`, sur Test comme sur Production (liste identique). Le schéma `public` n'est pas modifiable par `anon` ni `authenticated` (`CREATE` refusé), mais `anon` détient le droit `TEMP` sur la base. Or, quand `pg_temp` n'est pas nommé dans le `search_path`, PostgreSQL le cherche **en premier** pour les relations : un appelant peut créer une table temporaire du même nom qu'une table de `public` et la faire lire à une fonction qui s'exécute avec les droits de son propriétaire (`postgres`). C'est le correctif classique recommandé par PostgreSQL pour les fonctions SECURITY DEFINER : nommer `pg_temp` en dernier.

| Répartition SECURITY DEFINER de `public` | Test | Production |
|---|---|---|
| `search_path=""` (déjà le plus strict) | 89 | 89 |
| `search_path=public` | 41 | 41 |
| `search_path=pg_catalog, public, pg_temp` | 11 | 0 |

Parmi les 41 `search_path=public`, 17 sont exposées à `anon` : c'est le périmètre de cette étape. Les 24 autres (non exposées à `anon`, exécutables par `authenticated` seulement ou par personne) seront traitées dans une demande ultérieure. Les 11 de Test en `pg_catalog, public, pg_temp` sont déjà correctes (écart de Test, non touché ici).

Les 17 fonctions, toutes propriétaires `postgres`, aucune ne cite `pg_temp` ni de table temporaire dans son corps :

- Fonctions de trigger (8) : `carburant_resoudre_prix_achat_snapshot()`, `fdj_sync_releve_apres_cash_control()`, `fdj_tracer_correction_stock_initial()`, `flag_modification_apres_validation()`, `flag_mouvement_non_justifie()`, `nexus_forcer_site_unique()`, `nexus_inventaire_detecter_conditionnement()`, `nexus_site_supprimable()`.
- Fonctions de contrôle d'accès/identité (9) : `current_employee_role()`, `current_employee_site_id()`, `est_pompiste_du_jour(text)`, `est_receptionniste_livraison_du_jour(text,date)`, `je_suis_createur()`, `nexus_clients_ecriture_ok(text)`, `nexus_clients_lecture_ok(text)`, `nexus_identifiant_de_connexion(text)`, `nexus_site_de_reference(text,text)`.

## Effet attendu : aucun changement de comportement

`SET search_path = public, pg_temp` résout les mêmes noms dans le même ordre que `search_path=public` ; la seule différence est que `pg_temp` passe de « premier » à « dernier ». Aucune fonction n'utilise de table temporaire. `pg_catalog` reste implicitement consulté en premier, comme aujourd'hui. Les droits (`GRANT`/`REVOKE`) ne sont pas touchés par `ALTER FUNCTION … SET`.

## SQL proposé (NON exécuté)

```sql
alter function public.carburant_resoudre_prix_achat_snapshot() set search_path = public, pg_temp;
alter function public.current_employee_role() set search_path = public, pg_temp;
alter function public.current_employee_site_id() set search_path = public, pg_temp;
alter function public.est_pompiste_du_jour(text) set search_path = public, pg_temp;
alter function public.est_receptionniste_livraison_du_jour(text, date) set search_path = public, pg_temp;
alter function public.fdj_sync_releve_apres_cash_control() set search_path = public, pg_temp;
alter function public.fdj_tracer_correction_stock_initial() set search_path = public, pg_temp;
alter function public.flag_modification_apres_validation() set search_path = public, pg_temp;
alter function public.flag_mouvement_non_justifie() set search_path = public, pg_temp;
alter function public.je_suis_createur() set search_path = public, pg_temp;
alter function public.nexus_clients_ecriture_ok(text) set search_path = public, pg_temp;
alter function public.nexus_clients_lecture_ok(text) set search_path = public, pg_temp;
alter function public.nexus_forcer_site_unique() set search_path = public, pg_temp;
alter function public.nexus_identifiant_de_connexion(text) set search_path = public, pg_temp;
alter function public.nexus_inventaire_detecter_conditionnement() set search_path = public, pg_temp;
alter function public.nexus_site_de_reference(text, text) set search_path = public, pg_temp;
alter function public.nexus_site_supprimable() set search_path = public, pg_temp;
```

Dix-sept instructions, un seul lot, une seule transaction. Pas de `GRANT`, pas de `REVOKE`, pas de `CREATE OR REPLACE`, pas de DDL de table. Cible : Supabase **Test** `udljdqxerrbbbajxubfn` exclusivement.

## Préconditions (à relire le jour de l'exécution)

1. Rail relu : une décision matérialisée couvre cette opération.
2. Les 17 signatures existent, sont SECURITY DEFINER, et portent exactement `search_path=public`.
3. Relevé préalable enregistré : droits `anon` et `authenticated` de chacune des 17 (`has_function_privilege`), et état `tgenabled` des triggers qui les utilisent.

## Postconditions (épreuves)

1. Les 17 portent `search_path=public, pg_temp` ; plus aucune des 17 n'a `search_path=public` seul.
2. Droits `anon` et `authenticated` identiques au relevé préalable ; SECURITY DEFINER toujours vrai ; propriétaire inchangé.
3. Triggers concernés toujours activés (`tgenabled`).
4. Le job `nexus-inventaire-reviews` a un passage `succeeded` après l'opération.
5. Appel de contrôle sous `authenticated`, dans un bloc annulé : `current_employee_role()` et `nexus_site_de_reference(...)` répondent sans erreur ; la garde de régularisation de l'étape 1 refuse toujours (42501).
6. Épreuve du défaut corrigé : sous `anon`, créer une table temporaire homonyme d'une table lue par l'une des fonctions n'altère plus son résultat (bloc annulé).
7. Toute autre SECURITY DEFINER de Test inchangée (comparaison de `proconfig` avant/après sur les 141).

## Risques

Très faible : changement de configuration de fonction sans effet sur la résolution des noms, sans table temporaire dans les corps, sans modification de droits. Risque résiduel : un code externe au dépôt qui dépendrait d'un objet temporaire homonyme (aucun indice). `ALTER FUNCTION … SET` prend un verrou court sur la ligne de catalogue de la fonction, sans bloquer les tables.

## Retour arrière

Pour chacune des 17, rétablir la configuration exacte d'origine :

```sql
alter function public.<nom>(<arguments>) set search_path = public;
```

## Ce qui reste hors de cette demande

Report en Production (sa propre demande et son GO, dépôt d'une migration de dépôt à ce moment-là) ; les 24 autres fonctions `search_path=public` ; passage éventuel à `search_path = ""` ; étapes 3 à 5. Ce changement est appliqué sur Test sans fichier de migration : l'écart de dépôt est assumé jusqu'au report en Production.

## Question d'arbitrage

Autorisez-vous ces 17 `ALTER FUNCTION … SET search_path = public, pg_temp` sur **Supabase Test seulement**, sous les préconditions et postconditions ci-dessus ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED, avec `closes` pour cette étape. Rien n'est appliqué avant une décision matérialisée.
