<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE1-20261018/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: SECURITE-DEFINER-ETAPE1-20261018
seq: 3
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
# SÉCURITÉ SECURITY DEFINER — Étape 2 exécutée sur Test : consignation des postconditions et clôture de l'étape

Cette demande ne porte sur **aucune nouvelle opération**. Elle consigne l'exécution de l'étape 2 autorisée par decision-2.md (`78f255cc`, APPROVED_WITH_CONDITIONS, `closes: false`) et demande à l'arbitre de constater les postconditions et de fermer l'étape. Aucun SQL d'écriture n'est demandé ici. Ni Production, ni migration de dépôt, ni fusion, ni GRANT/REVOKE, ni modification des privilèges de `nexus_ci_recette`, ni `claude.yml`.

## Preuve des conditions de decision-2

Exécution le 18/10/2026 vers 13:40 UTC sur Supabase **Test** (`udljdqxerrbbbajxubfn`) exclusivement, sur GO explicite de Frédéric Bragance dans la session, après relecture du rail (decision-2 la plus récente, aucun STOP).

- Immédiatement avant : les 17 signatures existent, sont SECURITY DEFINER, propriétaire `postgres`, `proconfig` exactement `{search_path=public}` ; `anon` et `authenticated` en EXECUTE sur les 17 ; 9 triggers liés, tous `tgenabled = O`. Empreinte (md5) de `proconfig` des 141 SECURITY DEFINER de `public` : `089f3d83a810d8fcbd08fe59901d6960`.
- Exécution : les 17 `ALTER FUNCTION … SET search_path = public, pg_temp` dans **un seul bloc transactionnel** (DO), précédés d'une garde qui abandonnait tout si les 17 `proconfig` ne valaient pas exactement `search_path=public`. Aucune autre instruction.
- Interdits respectés : aucun GRANT, REVOKE, changement `nexus_ci_recette`, migration de dépôt, fusion ni mutation Production.

## Postconditions mesurées (les sept de request-2.md)

1. Les 17 portent `search_path=public, pg_temp` ; 0 conserve `search_path=public`.
2. Droits `anon` (17/17) et `authenticated` (17/17) identiques au relevé préalable ; SECURITY DEFINER et propriétaire `postgres` inchangés.
3. Les 9 triggers concernés sont tous `tgenabled = O`, aucun désactivé.
4. Job `nexus-inventaire-reviews` : passage `succeeded` ("1 row") à 13:45:00 UTC, postérieur à l'opération (précédent : 13:30:00, `succeeded`).
5. Sous `authenticated`, bloc annulé : `current_employee_role()` répond `NULL` et `nexus_site_de_reference('S1','S1')` répond `S1`, sans erreur ; avec un uid sans rôle manager, l'insertion « regularisation » sur `carburant_reception_visites` est refusée par la garde (SQLSTATE 42501).
6. Sous `anon`, bloc annulé : une table temporaire `employees` homonyme n'altère plus `current_employee_role()` (résultat `NULL`). Témoin dans le même bloc : avec l'ancien `search_path=public`, la même attaque renvoyait `gerant` — l'épreuve discrimine. Le témoin a été annulé avec le bloc.
7. Empreinte des 141 SECURITY DEFINER, recalculée en remettant l'ancienne valeur sur les 17 : `089f3d83a810d8fcbd08fe59901d6960`, identique à l'empreinte préalable ; seules les 17 ont changé. État final revérifié après le bloc de test : 17 fonctions à `public, pg_temp`, aucune table temporaire résiduelle.

## Écarts et limites

- Aucun écart de comportement constaté. Pas de retour arrière nécessaire.
- Changement appliqué sur Test **sans fichier de migration** (écart de dépôt assumé jusqu'à une demande de report en Production). Test et Production restent différents sur ces 17 fonctions.
- Hors de cette demande : les 24 autres fonctions `search_path=public`, les étapes 3 à 5, le report en Production.

## Question d'arbitrage

Constatez-vous les sept postconditions comme satisfaites et fermez-vous l'étape 2 (`closes: true` pour ce volet) ? Réponse attendue : APPROVED / APPROVED_WITH_CONDITIONS / REJECTED / NEEDS_EVIDENCE, avec `closes`. Rien d'autre n'est demandé ni exécuté.
