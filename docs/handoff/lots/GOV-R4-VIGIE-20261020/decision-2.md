---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R4-VIGIE-20261020
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6304285412
---
# Décision sur request-2.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39516341520), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6304285412. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R4-VIGIE-20261020`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `fd8c0a77857c82875b12af61b0909c3fcab1577a`, `HEAD` = `fd8c0a77857c82875b12af61b0909c3fcab1577a`, SHA du run `fd8c0a77857c82875b12af61b0909c3fcab1577a`, tête du rail `fd8c0a77857c82875b12af61b0909c3fcab1577a`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Décision : APPROVED — clôture du lot.**

La V1 respecte le périmètre autorisé d’outillage en lecture seule et les conditions de `decision-1`. Les 9 échecs connus sont diagnostiqués et ne constituent pas une régression produit inexpliquée, conformément à `REGRESSION_PRODUIT_VS_BANC`. L’arbitrage a posteriori est couvert par `OUTILLAGE_A_POSTERIORI`.

Limite actée : le workflow planifié reste inerte tant qu’il demeure uniquement sur le rail. Son éventuel portage sur `main`, ainsi que sa première exécution réelle, relèvent d’un palier distinct et ne sont pas autorisés par cette décision.

RAIL_LU: fd8c0a77857c82875b12af61b0909c3fcab1577a

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: GOV-R4-VIGIE-20261020
REQUEST: request-2.md
HEAD: fd8c0a77857c82875b12af61b0909c3fcab1577a
LEASE: aucun
GATE_STATE: G0, banc local vert et CI planifiée non observée car absente de la branche par défaut
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision APPROVED avec clôture du lot sur le rail.
