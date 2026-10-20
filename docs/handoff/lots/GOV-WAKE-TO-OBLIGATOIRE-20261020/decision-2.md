---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-WAKE-TO-OBLIGATOIRE-20261020
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6301902069
---
# Décision sur request-2.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39500529594), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6301902069. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-WAKE-TO-OBLIGATOIRE-20261020`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `037ec925cb6caca2a61bff4be8c31202156249c3`, `HEAD` = `037ec925cb6caca2a61bff4be8c31202156249c3`, SHA du run `037ec925cb6caca2a61bff4be8c31202156249c3`, tête du rail `037ec925cb6caca2a61bff4be8c31202156249c3`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED.** Le garde `wake_to` est implémenté et couvert par W1–W6, le Guardian QA et une CI courante verte. Le rouge intermédiaire ne révèle aucune régression produit et ne justifie pas d’escalade selon `REGRESSION_PRODUIT_VS_BANC`. Les acquis `OUTILLAGE_A_POSTERIORI`, `COMMIT_PUSH_RAIL_SANS_GO` et `DELEGATION_ARBITRE` s’appliquent. Aucun motif STOP n’est caractérisé ; le lot peut être clôturé sans condition.

RAIL_LU: 037ec925cb6caca2a61bff4be8c31202156249c3

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: GOV-WAKE-TO-OBLIGATOIRE-20261020
REQUEST: request-2.md
HEAD: 037ec925cb6caca2a61bff4be8c31202156249c3
LEASE: aucun
GATE_STATE: G3, CI verte
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision de clôture avec `outils/handoff.js decision --auteur ChatGPT`.
