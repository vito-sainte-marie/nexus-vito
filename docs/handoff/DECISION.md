<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PROPRETE-1-20261014/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PROPRETE-1-20261014
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38664904517), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6182167446. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-PROPRETE-1-20261014`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `8661eaf1c0bbd4c23a20ae56fc1a7f1d7c3ff4a5`, `HEAD` = `8661eaf1c0bbd4c23a20ae56fc1a7f1d7c3ff4a5`, SHA du run `8661eaf1c0bbd4c23a20ae56fc1a7f1d7c3ff4a5`, tête du rail `8661eaf1c0bbd4c23a20ae56fc1a7f1d7c3ff4a5`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Classer exactement les 92 branches non classées avec une justification vérifiable par branche, sans assimiler automatiquement un squash-merge à une branche non intégrée ; limiter la correction du skill à la lecture de artefacts_hors_registre et à son épreuve ; ne supprimer ni déplacer aucune ref, ne fermer ni fusionner aucune PR, et ne toucher ni main, ni production, ni claude.yml, ni secrets ou permissions. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Le cadrage est approuvé sous conditions. Le classement documentaire des 92 branches est la première étape. La correction du skill pour lire `artefacts_hors_registre` entre dans ce lot, avec son épreuve dédiée.

Les suppressions de branches restent hors lot et relèvent de `OPERATION_IRREVERSIBLE_SIGNIFICATIVE`. Les fermetures de PR restent également hors lot, mais ne nécessitent pas automatiquement un GO humain : elles devront faire l’objet d’un arbitrage séparé, conformément à `PALIER_HUMAIN_RESTREINT`. Toute fusion ou promotion vers Production relève de `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

`COMMIT_PUSH_RAIL_SANS_GO` et `DECISION5_CONDITION5_LEVEE` autorisent les commits et pushs documentaires sur le rail sans nouveau GO humain.

RAIL_LU: 8661eaf1c0bbd4c23a20ae56fc1a7f1d7c3ff4a5

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-PROPRETE-1-20261014
REQUEST: request-1.md
HEAD: 8661eaf1c0bbd4c23a20ae56fc1a7f1d7c3ff4a5
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Classer exactement les 92 branches non classées avec une justification vérifiable par branche, sans assimiler automatiquement un squash-merge à une branche non intégrée ; limiter la correction du skill à la lecture de artefacts_hors_registre et à son épreuve ; ne supprimer ni déplacer aucune ref, ne fermer ni fusionner aucune PR, et ne toucher ni main, ni production, ni claude.yml, ni secrets ou permissions.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Classer documentairement les 92 branches dans docs/handoff/BRANCHES-CLASSEES.json avec leur justification vérifiable, sans modifier aucune ref distante.
