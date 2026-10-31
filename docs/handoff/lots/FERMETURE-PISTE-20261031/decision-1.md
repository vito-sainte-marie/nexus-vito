---
protocol: nexus-handoff/2
kind: decision
lot_id: FERMETURE-PISTE-20261031
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6543232529
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41200080746), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6543232529. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `FERMETURE-PISTE-20261031`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `dec17c02f1341c8cfff75242f69997f007e41f48`, `HEAD` = `dec17c02f1341c8cfff75242f69997f007e41f48`, SHA du run `dec17c02f1341c8cfff75242f69997f007e41f48`, tête du rail `dec17c02f1341c8cfff75242f69997f007e41f48`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Utiliser le pointage de départ existant avec le libellé « Pointer mon départ », sans écriture dans shifts ni migration ; lire les horaires dans station_config.horaires selon le régime normal/étendu et le fuseau de la station, sans constante locale ; conserver la formule matinale validée et omettre toute sous-ligne le soir plutôt que d’inventer une formule ; éprouver sur Test la clôture anticipée et, si inventaire_quarts la refuse, revenir avec la preuve précise sans contournement ni mutation Production ; couvrir les huit épreuves annoncées et préserver l’écran de choix du manager. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Verdict : **APPROVED_WITH_CONDITIONS**.

Le périmètre de développement est retenu selon les choix conservateurs déjà supportés par le produit :

- l’écran C utilise **« Pointer mon départ »** et conduit au pointage de départ existant, sans écriture directe dans `shifts` ;
- les horaires proviennent exclusivement de `station_config.horaires`, avec la règle normal/étendu et le fuseau de la station ;
- la formule du matin est retenue ; aucune formule métier n’est inventée pour le soir : la sous-ligne est omise ;
- l’acceptation d’une clôture anticipée doit être vérifiée sur Test avant toute adaptation.

Les acquis `DELEGATION_ARBITRE`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent. Cette décision n’autorise ni fusion vers Production, ni déploiement, ni mutation de la base Production.

RAIL_LU: dec17c02f1341c8cfff75242f69997f007e41f48

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: FERMETURE-PISTE-20261031
REQUEST: request-1.md
BRANCHE_DU_LOT: fermeture-piste-20261031
HEAD: dec17c02f1341c8cfff75242f69997f007e41f48
LEASE: aucun
GATE_STATE: G0, CI non exécutée avant développement
PROOF_STATE: PROOF_VALID
CONDITIONS: Utiliser le pointage de départ existant avec le libellé « Pointer mon départ », sans écriture dans shifts ni migration ; lire les horaires dans station_config.horaires selon le régime normal/étendu et le fuseau de la station, sans constante locale ; conserver la formule matinale validée et omettre toute sous-ligne le soir plutôt que d’inventer une formule ; éprouver sur Test la clôture anticipée et, si inventaire_quarts la refuse, revenir avec la preuve précise sans contournement ni mutation Production ; couvrir les huit épreuves annoncées et préserver l’écran de choix du manager.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision avec outils/handoff.js decision --auteur ChatGPT.
