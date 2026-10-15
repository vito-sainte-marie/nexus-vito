<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-FDJ-STOCK-Q1-ABSENT-20261015/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38721630091), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6190147349. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-FDJ-STOCK-Q1-ABSENT-20261015`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `34c3a24cedf9dbffbc0f98ecc2b6f35878e63459`, `HEAD` = `34c3a24cedf9dbffbc0f98ecc2b6f35878e63459`, SHA du run `34c3a24cedf9dbffbc0f98ecc2b6f35878e63459`, tête du rail `dcfdcea25371f8b2294d73452fa561129beed322`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Limiter la suite aux écrans employé et manager annoncés, au moteur, aux épreuves avec mutations, à la recette SQL versionnée et à l’entrée nexus-incidents ; préserver distinctement absence opérationnelle, valeur physique et valeur reconstituée ; corriger l’assertion de date et tester sur Test l’artefact final exact, commentaire compris, avec A–F et nettoyage constaté ; compléter la preuve RLS par deux contextes de site distincts démontrant lecture autorisée, lecture intersite refusée, écriture directe refusée et appel intersite refusé ; fixer le search_path de la fonction SECURITY DEFINER, révoquer son exécution à PUBLIC et n’accorder que les rôles strictement nécessaires ; régénérer les manifestes et empreintes attendus puis obtenir une CI verte avant toute demande de promotion ; aucune mutation Production ni écriture sur main ou production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.** La poursuite de l’implémentation hors Production est autorisée. L’écart de base depuis `origin/production` est accepté pour cette branche de travail ; il ne confère aucune autorité sur les refs protégées.

Les acquis `DELEGATION_ARBITRE`, `COMMIT_PUSH_RAIL_SANS_GO` et `PREAUTORISATIONS_CLAUDE` s’appliquent. Aucun motif STOP n’est constitué à ce stade.

Les preuves A–F soutiennent la conception, mais la preuve finale doit être rafraîchie sur l’artefact versionné exact : l’assertion de date erronée, le commentaire omis et l’absence d’une seconde session RLS empêchent de les considérer comme preuve finale de promotion. La fonction `SECURITY DEFINER` devra également démontrer une surface d’exécution explicitement fermée.

RAIL_LU: 34c3a24cedf9dbffbc0f98ecc2b6f35878e63459

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
REQUEST: request-2.md
HEAD: 34c3a24cedf9dbffbc0f98ecc2b6f35878e63459
LEASE: aucun
GATE_STATE: G1, CI finale non exécutée
PROOF_STATE: PROOF_REFRESH_REQUIRED
CONDITIONS: Limiter la suite aux écrans employé et manager annoncés, au moteur, aux épreuves avec mutations, à la recette SQL versionnée et à l’entrée nexus-incidents ; préserver distinctement absence opérationnelle, valeur physique et valeur reconstituée ; corriger l’assertion de date et tester sur Test l’artefact final exact, commentaire compris, avec A–F et nettoyage constaté ; compléter la preuve RLS par deux contextes de site distincts démontrant lecture autorisée, lecture intersite refusée, écriture directe refusée et appel intersite refusé ; fixer le search_path de la fonction SECURITY DEFINER, révoquer son exécution à PUBLIC et n’accorder que les rôles strictement nécessaires ; régénérer les manifestes et empreintes attendus puis obtenir une CI verte avant toute demande de promotion ; aucune mutation Production ni écriture sur main ou production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
