---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-WAKE-TO-OBLIGATOIRE-20261020
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6301110662
---
# Décision sur request-1.md — APPROVED

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39494525076), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6301110662. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-WAKE-TO-OBLIGATOIRE-20261020`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `0ba0e879355d6c71cd301f60e1beb4e575fc0b29`, `HEAD` = `0ba0e879355d6c71cd301f60e1beb4e575fc0b29`, SHA du run `0ba0e879355d6c71cd301f60e1beb4e575fc0b29`, tête du rail `0ba0e879355d6c71cd301f60e1beb4e575fc0b29`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Le périmètre est **APPROVED**. Le refus avant toute écriture, l’héritage explicite de l’adresse déjà déclarée et l’absence de valeur par défaut sont cohérents avec le protocole. Les épreuves W1–W6 couvrent correctement l’atomicité, la validation, l’héritage et la non-rétroactivité.

Les acquis `OUTILLAGE_A_POSTERIORI`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO` autorisent l’implémentation, l’adaptation des bancs et le push sur le rail sans nouveau GO humain. Aucun motif STOP_REQUIRED n’est présent.

RAIL_LU: 0ba0e879355d6c71cd301f60e1beb4e575fc0b29

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: false
LOT: GOV-WAKE-TO-OBLIGATOIRE-20261020
REQUEST: request-1.md
HEAD: 0ba0e879355d6c71cd301f60e1beb4e575fc0b29
LEASE: aucun
GATE_STATE: G0, CI d’implémentation non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision APPROVED sur le rail avec outils/handoff.js decision --auteur ChatGPT.
