<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-SAISIE-DIRECTE-20261022/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6344102529
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39801665260), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6344102529. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-SAISIE-DIRECTE-20261022`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `d8110ae969bd1406665e1625e7638caeed376ef9`, `HEAD` = `d8110ae969bd1406665e1625e7638caeed376ef9`, SHA du run `d8110ae969bd1406665e1625e7638caeed376ef9`, tête du rail `d8110ae969bd1406665e1625e7638caeed376ef9`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Ouvrir uniquement une PR brouillon vers production; ne réaliser aucune fusion, aucun déploiement ni aucune promotion; consigner ensuite la recette iPhone chronométrée sur l’aperçu Test avant toute demande de passage en Production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La limitation de la session est une limitation de canal, non une gate humaine, conformément à `LIMITATION_CANAL_NON_STOP`. Les sept échecs préexistants sont diagnostiqués et n’indiquent aucune régression introduite par ce lot, conformément à `REGRESSION_PRODUIT_VS_BANC`.

L’ouverture d’une PR brouillon vers `production` est approuvée. Elle n’autorise ni fusion, ni déploiement, ni promotion. Après construction de l’aperçu Test, la recette iPhone chronométrée devra être consignée avant toute demande de passage en Production.

RAIL_LU: d8110ae969bd1406665e1625e7638caeed376ef9

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-SAISIE-DIRECTE-20261022
REQUEST: request-2.md
HEAD: d8110ae969bd1406665e1625e7638caeed376ef9
LEASE: aucun
GATE_STATE: G0, tests ciblés 14/14 verts et suite complète 290/297 avec 7 échecs préexistants diagnostiqués
PROOF_STATE: PROOF_VALID
CONDITIONS: Ouvrir uniquement une PR brouillon vers production; ne réaliser aucune fusion, aucun déploiement ni aucune promotion; consigner ensuite la recette iPhone chronométrée sur l’aperçu Test avant toute demande de passage en Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: CANAL_PUBLICATION
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Ouvrir une PR brouillon de lot-jaugeage-saisie-directe-20261022 vers production.
