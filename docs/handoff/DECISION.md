<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/MENU-ACCUEIL-EMPLOYE-20261030/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6523282911
---
# Décision sur request-3.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41058267598), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6523282911. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `MENU-ACCUEIL-EMPLOYE-20261030`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `2f19684a71ff384a778a119afa2f23a51dfeaac6`, `HEAD` = `2f19684a71ff384a778a119afa2f23a51dfeaac6`, SHA du run `2f19684a71ff384a778a119afa2f23a51dfeaac6`, tête du rail `2f19684a71ff384a778a119afa2f23a51dfeaac6`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

DECISION: APPROVED.

L’option B, décision métier attribuée à Frédéric, remplace la condition 1 de `decision-1.md` pour le seul lien Inventaire du renfort. Les autres conditions restent satisfaites. Les sept échecs identiques à la base ne constituent pas une régression nouvelle selon l’acquis `REGRESSION_PRODUIT_VS_BANC`. Aucune action Production, migration ou extension de sécurité n’est autorisée par cette décision.

RAIL_LU: 2f19684a71ff384a778a119afa2f23a51dfeaac6

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: MENU-ACCUEIL-EMPLOYE-20261030
REQUEST: request-3.md
BRANCHE_DU_LOT: menu-accueil-employe-20261030
HEAD: 2f19684a71ff384a778a119afa2f23a51dfeaac6
LEASE: aucun
GATE_STATE: G2, tests ciblés verts et suite complète sans nouvel échec par rapport à la base
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision APPROVED sur le rail avec `outils/handoff.js decision --auteur ChatGPT`.
