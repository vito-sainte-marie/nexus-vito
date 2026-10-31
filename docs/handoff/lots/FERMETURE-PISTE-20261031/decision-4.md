---
protocol: nexus-handoff/2
kind: decision
lot_id: FERMETURE-PISTE-20261031
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-5.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6547656583
---
# Décision sur request-5.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41230980538), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6547656583. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `FERMETURE-PISTE-20261031`, `REQUEST` = `request-5.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `54a4e3b4175e52e8141a9b80bcdaa49f6177959b`, `HEAD` = `54a4e3b4175e52e8141a9b80bcdaa49f6177959b`, SHA du run `54a4e3b4175e52e8141a9b80bcdaa49f6177959b`, tête du rail `54a4e3b4175e52e8141a9b80bcdaa49f6177959b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Le lot reste ouvert sans réveil autonome jusqu’à une recette Guardian sur Test confirmant qu’un pompiste du matin clôturant après 13 h reste sur le quart du matin ; aucune réparation Production, fusion, promotion ou clôture avant cette preuve. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La recette reste assignée à Guardian : l’acquis `PREAUTORISATIONS_CLAUDE` autorise une recette navigateur Test, mais ne transforme pas cette capacité générale en substitution d’un exécutant nommément désigné. Son indisponibilité actuelle n’est pas un motif de réveil humain selon `PALIER_HUMAIN_RESTREINT`.

Le lot reste ouvert sans réveil autonome jusqu’à réception d’une recette Guardian concluante. Frédéric n’intervient qu’ensuite pour l’éventuelle fusion ou promotion Production, au titre de `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

RAIL_LU: 54a4e3b4175e52e8141a9b80bcdaa49f6177959b

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: FERMETURE-PISTE-20261031
REQUEST: request-5.md
BRANCHE_DU_LOT: fermeture-piste-correctif-quart-20261031
HEAD: 54a4e3b4175e52e8141a9b80bcdaa49f6177959b
LEASE: aucun
GATE_STATE: G2, CI sans recette navigateur Test exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Le lot reste ouvert sans réveil autonome jusqu’à une recette Guardian sur Test confirmant qu’un pompiste du matin clôturant après 13 h reste sur le quart du matin ; aucune réparation Production, fusion, promotion ou clôture avant cette preuve.
BLOCKER: Recette Guardian sur Test non disponible, Guardian n’étant pas encore câblé.
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail puis laisser le lot en attente de la recette Guardian.
