---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-BOUCLE-CONTRAT-1-20261015
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38769890827), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6197138859. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-BOUCLE-CONTRAT-1-20261015`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `4d2c48a8529eb1dd0eacdf65ccf0a62235250312`, `HEAD` = `4d2c48a8529eb1dd0eacdf65ccf0a62235250312`, SHA du run `4d2c48a8529eb1dd0eacdf65ccf0a62235250312`, tête du rail `4d2c48a8529eb1dd0eacdf65ccf0a62235250312`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Travailler uniquement sur incident/INC-20261015-001, sans fusion ni modification de main ou production; réutiliser ATTENTE_CONSOMMATION_DECISION comme prise en charge et adapter tous ses lecteurs concernés; interdire DECISION_CONSOMMEE sans preuve d’action ou arrêt matérialisé; faire échouer et signaler tout tour vide; exécuter et consigner les épreuves avant/après sans déclarer clos les scénarios dépendant des lots 2 ou 3; préserver les contre-exemples PROPRETE et RECONCILER; ne jamais affecter une branche dédiée à github-actions-claude. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La cause racine à quatre défauts composés est validée comme base de correction, avec la réserve déjà formulée : H1 est confirmée par composition logique, non par lecture du transcript. Le classement des 17 scénarios reste provisoire jusqu’à l’épreuve avant/après.

Le lot 1 est autorisé sur `incident/INC-20261015-001`. La réutilisation de `ATTENTE_CONSOMMATION_DECISION` comme état de prise en charge est approuvée. Une décision ne peut devenir consommée qu’après preuve de l’action prescrite ou matérialisation d’un arrêt. Un tour vide doit échouer et produire une sortie observable.

Les lots 2 puis 3 constituent l’ordre retenu, mais ne sont pas autorisés par cette décision. Toute application sur `main`, notamment de `claude.yml`, reste hors de ce lot. La règle immédiate est retenue : une branche dédiée ne doit jamais être prescrite à `github-actions-claude`; une telle action doit être routée vers `session-claude-habilitee`.

Les acquis `OUTILLAGE_A_POSTERIORI`, `COMMIT_PUSH_RAIL_SANS_GO`, `PREAUTORISATIONS_CLAUDE` et `REGRESSION_PRODUIT_VS_BANC` permettent cette exécution sans nouveau GO humain.

RAIL_LU: 4d2c48a8529eb1dd0eacdf65ccf0a62235250312

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-BOUCLE-CONTRAT-1-20261015
REQUEST: request-1.md
HEAD: 4d2c48a8529eb1dd0eacdf65ccf0a62235250312
LEASE: aucun
GATE_STATE: G1, diagnostic validé et CI corrective à exécuter
PROOF_STATE: PROOF_VALID
CONDITIONS: Travailler uniquement sur incident/INC-20261015-001, sans fusion ni modification de main ou production; réutiliser ATTENTE_CONSOMMATION_DECISION comme prise en charge et adapter tous ses lecteurs concernés; interdire DECISION_CONSOMMEE sans preuve d’action ou arrêt matérialisé; faire échouer et signaler tout tour vide; exécuter et consigner les épreuves avant/après sans déclarer clos les scénarios dépendant des lots 2 ou 3; préserver les contre-exemples PROPRETE et RECONCILER; ne jamais affecter une branche dédiée à github-actions-claude.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Implémenter sur incident/INC-20261015-001 le correctif autonome du lot 1 avec ses épreuves avant/après, puis en déposer le retour d’exécution sur le rail.
