---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: NEEDS_EVIDENCE
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — NEEDS_EVIDENCE

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38981501655), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6226611659. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `3d5d618f5f8a9b5d53f0ff05019057baf2c635c3`, `HEAD` = `3d5d618f5f8a9b5d53f0ff05019057baf2c635c3`, SHA du run `3d5d618f5f8a9b5d53f0ff05019057baf2c635c3`, tête du rail `3d5d618f5f8a9b5d53f0ff05019057baf2c635c3`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La condition 3 de `decision-1.md` reste non satisfaite : le brief intégral n’est pas présent dans les éléments lus. Il manque précisément la suite après « Élégante, contemporaine », notamment les règles de persistance, d’intégration et de recette. Aucune implémentation substantielle ne doit être inventée entre-temps.

Il ne s’agit pas, en l’état, d’une nouvelle décision métier à arbitrer, mais d’une preuve documentaire manquante. Aucun motif du palier Frédéric n’est donc déclenché. Les acquis `PALIER_HUMAIN_RESTREINT` et `DELEGATION_ARBITRE` s’appliquent.

RAIL_LU: 3d5d618f5f8a9b5d53f0ff05019057baf2c635c3

NEXT_ACTION_CONTRACT
DECISION: NEEDS_EVIDENCE
CLOSES: false
LOT: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
REQUEST: request-2.md
HEAD: 3d5d618f5f8a9b5d53f0ff05019057baf2c635c3
LEASE: aucun
GATE_STATE: G0, CI non applicable faute d’implémentation
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: Texte intégral du brief absent après « L’interface doit être : – Élégante, contemporaine », incluant les critères d’interface restants, la persistance prévue ou explicitement exclue, les règles d’intégration au parcours de prise et fin de poste, les critères de recette et les interdits.
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision NEEDS_EVIDENCE sur le rail et maintenir le lot sans implémentation jusqu’au dépôt du brief intégral.
