---
protocol: nexus-handoff/2
kind: decision
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6417833960
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40335016295), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6417833960. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `OUTILLAGE-REGULARISATION-20261026`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `e34db3ac7981e14c568a0136783769ea6f6830c4`, `HEAD` = `e34db3ac7981e14c568a0136783769ea6f6830c4`, SHA du run `e34db3ac7981e14c568a0136783769ea6f6830c4`, tête du rail `e34db3ac7981e14c568a0136783769ea6f6830c4`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Environnement Test uniquement ; conserver Test A ; obtenir trois runs verts consécutifs ; exécuter l’épreuve d’isolation et sa mutation avant tout retrait de Test A ; ne créer aucun compte Auth ; n’écrire ni sur main ni en Production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La correction de capacité est fondée : l’action suivante écrit uniquement la décision sur le rail. Les acquis `PREAUTORISATIONS_CLAUDE`, `COMMIT_PUSH_RAIL_SANS_GO` et `CHATGPT_DECIDE_CLAUDE_MATERIALISE` s’appliquent. Aucun motif de STOP n’est constitué.

RAIL_LU: e34db3ac7981e14c568a0136783769ea6f6830c4

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: OUTILLAGE-REGULARISATION-20261026
REQUEST: request-4.md
BRANCHE_DU_LOT: handoff-continuite-20260920
HEAD: e34db3ac7981e14c568a0136783769ea6f6830c4
LEASE: aucun
GATE_STATE: G1, CI de matérialisation à exécuter
PROOF_STATE: PROOF_VALID
CONDITIONS: Environnement Test uniquement ; conserver Test A ; obtenir trois runs verts consécutifs ; exécuter l’épreuve d’isolation et sa mutation avant tout retrait de Test A ; ne créer aucun compte Auth ; n’écrire ni sur main ni en Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec `outils/handoff.js decision --auteur ChatGPT`.
