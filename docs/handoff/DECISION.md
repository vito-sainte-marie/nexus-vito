<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FERMETURE-PISTE-20261031/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FERMETURE-PISTE-20261031
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6547586712
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41230479538), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6547586712. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `FERMETURE-PISTE-20261031`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `c1a9f4fb61ec3241e64001fbefad82e35bc27afc`, `HEAD` = `c1a9f4fb61ec3241e64001fbefad82e35bc27afc`, SHA du run `c1a9f4fb61ec3241e64001fbefad82e35bc27afc`, tête du rail `c1a9f4fb61ec3241e64001fbefad82e35bc27afc`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« La recette Guardian sur Test doit confirmer qu’un pompiste du matin clôturant après 13 h reste sur le quart du matin ; aucune réparation des données Production du 31/10 ; aucune fusion, promotion ou clôture du lot avant cette recette ; la fusion de la PR #167 vers Production reste réservée à Frédéric au titre de PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La régression est diagnostiquée et le correctif reste circonscrit au fil de fermeture : le motif `REGRESSION_PRODUIT_IMPORTANTE_INEXPLIQUEE` ne s’applique pas. Conformément à `REGRESSION_PRODUIT_VS_BANC`, les sept défaillances préexistantes n’imposent pas d’escalade.

Le périmètre du lot est complété par le correctif de la PR #167. Le lot reste ouvert jusqu’à la recette Test puis la fusion Production, laquelle demeure exclusivement soumise au palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` et n’est pas autorisée par la présente décision.

RAIL_LU: c1a9f4fb61ec3241e64001fbefad82e35bc27afc
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: FERMETURE-PISTE-20261031
REQUEST: request-4.md
BRANCHE_DU_LOT: fermeture-piste-correctif-quart-20261031
HEAD: c1a9f4fb61ec3241e64001fbefad82e35bc27afc
LEASE: aucun
GATE_STATE: G2, CI non renseignée ; banc local avec seulement 7 défaillances préexistantes
PROOF_STATE: PROOF_VALID
CONDITIONS: La recette Guardian sur Test doit confirmer qu’un pompiste du matin clôturant après 13 h reste sur le quart du matin ; aucune réparation des données Production du 31/10 ; aucune fusion, promotion ou clôture du lot avant cette recette ; la fusion de la PR #167 vers Production reste réservée à Frédéric au titre de PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
