<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-TEST-MUTATION-ROBUSTE-20261020/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-TEST-MUTATION-ROBUSTE-20261020
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6303426676
---
# Décision sur request-1.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39509883325), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6303426676. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-TEST-MUTATION-ROBUSTE-20261020`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `e190156f4bbcbb9e6c5db523330bd83f520b5179`, `HEAD` = `e190156f4bbcbb9e6c5db523330bd83f520b5179`, SHA du run `e190156f4bbcbb9e6c5db523330bd83f520b5179`, tête du rail `e190156f4bbcbb9e6c5db523330bd83f520b5179`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Le correctif est approuvé et le lot peut être clos. Il relève de l’arbitrage a posteriori prévu par `OUTILLAGE_A_POSTERIORI`. Le rouge est diagnostiqué comme un aléa du banc, sans régression produit, conformément à `REGRESSION_PRODUIT_VS_BANC`. Les preuves rouge/vert et Guardian QA sont valides, et aucun motif d’escalade humaine n’est constitué.

RAIL_LU: e190156f4bbcbb9e6c5db523330bd83f520b5179

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: GOV-TEST-MUTATION-ROBUSTE-20261020
REQUEST: request-1.md
HEAD: e190156f4bbcbb9e6c5db523330bd83f520b5179
LEASE: aucun
GATE_STATE: G3, CI verte sur les preuves rouge/vert et Guardian QA fournies
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision APPROVED sur le rail avec `outils/handoff.js decision --auteur ChatGPT`.
