---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-A6-ECRITURE-DIRECTE-20261011
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-2.md
---
# Décision — Lot A6 (PR #99) : clos sur les GO de Frédéric

## Verdict

**APPROVED_WITH_CONDITIONS — lot clos.**

request-2 demandait le GO TEST. L'arbitre ChatGPT y a répondu vers 03:20Z le 11/10 par `BLOCKED`, `STOP_REQUIRED: SECRET_PERMISSION_SURFACE_SECURITE`, `OWNER_NEXT: Frédéric` : la migration révoque des droits et accorde EXECUTE, ce qui relève du palier humain. Cette réponse n'a pas été matérialisée sur le rail. Frédéric a ensuite donné, étape par étape, tous les GO du lot. La présente décision les consigne et ferme le lot.

## GO donnés et preuves

| Étape | GO | Preuve |
|---|---|---|
| Migration Test | GO TEST | `20261011090000` appliquée à 10:42:10Z, registre Test 317 → 318 ; sonde Employé Test A `42501` sur les 3 tables ; épreuve rejouée 129 essais, 0 écart |
| Recette Test | — | employé (11:07Z, commentaire #99 6108383480) et manager (11:11Z, commentaire 6108412655) : les 4 RPC prouvées, aucun `42501` légitime |
| Fusion | GO fusion #99 | `ccfd46edc60a93026b267c9d2d374547ecdb844d` dans `production` à 11:14:25Z |
| Déploiement | approbation `github-pages` | run 38134830727, servi à 11:15:34Z (`ccfd46e`, génération `85c9a29ea116`) |
| Migration Production | GO migration Production A6 | ~11:18Z, transaction gardée ; registre 306 → 307, max `20261011090000` ; 4 RPC secdef `search_path=""` ; ACL des 3 tables `{postgres=arwdDxtm,authenticated=r,service_role=arwdDxtm}` ; décomptes 191 / 260 / 619 inchangés |
| Recette Production sans écriture | GO recette Production A6 | sonde anonyme `42501` (insert, select, rpc) ; écrans servis conformes à `ccfd46e` |

## Condition restante

Frédéric a écarté toute recette qui écrit en Production (11:25Z). Reste un **constat passif** au premier quart FDJ réel : l'audit postérieur à 11:18Z doit porter `via` ∈ {`fdj_journaliser_ouverture_validee`, `fdj_manager_journaliser`}. Une ligne sans `via` serait un contournement. Critères et requête consignés sur #99 (commentaire 6108518291). Ce constat ne rouvre pas le lot ; un écart ouvrirait un lot nouveau.

## Hors du lot

- `fdj_alertes`, `fdj_corrections` et les autres tables `fdj_*` encore écrivables directement : lot suivant, sur GO distinct.
- Défaut préexistant : l'édition manager omet un jeu inactif qui porte des ventes (faux écart).

## Livrées hors Handoff (mention)

- **#98** (continuité des stocks FDJ Q1/Q2) : fusionnée `8e34c9a`, déployée, migration Production appliquée (308) le 11/10 ; recette à faire.
- **#100** (garde de page sans extension) : fusionnée et déployée `9f2e7ec` le 11/10.

Aucun lot n'est créé après coup pour elles. Refs constatées au dépôt de cette décision : `main` = `c516322`, `production` = `9f2e7ec`.
