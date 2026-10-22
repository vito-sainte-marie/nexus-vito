---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6344687513
---
# Décision sur request-3.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39805764691), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6344687513. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-SAISIE-DIRECTE-20261022`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `7fd56d5f7dfd856239990ecf7aaca2c90b12a386`, `HEAD` = `7fd56d5f7dfd856239990ecf7aaca2c90b12a386`, SHA du run `7fd56d5f7dfd856239990ecf7aaca2c90b12a386`, tête du rail `7fd56d5f7dfd856239990ecf7aaca2c90b12a386`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« La PR #148 est l’unique PR canonique du lot; aucune PR ne doit être ouverte depuis lot-jaugeage-saisie-directe-20261022, qui reste non supprimée; avant toute demande de passage en Production, consigner une recette sur iPhone réel réalisée par un pompiste sans aide; aucune fusion, aucun déploiement, aucune promotion ni mutation de Production n’est autorisé par cette décision. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

La PR brouillon **#148** est désignée comme candidate canonique du lot. La branche `lot-jaugeage-saisie-directe-20261022` reste une trace non supprimée et ne doit donner lieu à aucune seconde PR.

Conformément à `STATE.json`, la dernière décision enregistrée est `decision-1.md` : la présente décision répond donc directement à `request-3.md`, sans tenir `decision-2.md` pour une autorité enregistrée. Cet écart est expliqué et ne constitue pas une `DIVERGENCE_AUTORITE_INEXPLIQUEE`.

La recette au format téléphone et les contrôles annoncés suffisent pour choisir la PR canonique, mais ne valent pas recette sur iPhone réel par un pompiste sans aide. Cette dernière reste exigée avant toute demande de passage en Production. La présente approbation n’autorise aucune fusion, aucun déploiement, aucune promotion ni mutation de Production. Les acquis `DELEGATION_ARBITRE` et `PALIER_HUMAIN_RESTREINT` permettent cet arbitrage sans réveiller Frédéric.

RAIL_LU: 7fd56d5f7dfd856239990ecf7aaca2c90b12a386

NEXT_ACTION_CONTRACT  
DECISION: APPROVED_WITH_CONDITIONS  
CLOSES: false  
LOT: JAUGEAGE-SAISIE-DIRECTE-20261022  
REQUEST: request-3.md  
HEAD: 7fd56d5f7dfd856239990ecf7aaca2c90b12a386  
LEASE: aucun  
GATE_STATE: G2, PR #148 brouillon ouverte; contrôles annoncés verts, CI non documentée dans request-3.md  
PROOF_STATE: PROOF_VALID  
CONDITIONS: La PR #148 est l’unique PR canonique du lot; aucune PR ne doit être ouverte depuis `lot-jaugeage-saisie-directe-20261022`, qui reste non supprimée; avant toute demande de passage en Production, consigner une recette sur iPhone réel réalisée par un pompiste sans aide; aucune fusion, aucun déploiement, aucune promotion ni mutation de Production n’est autorisé par cette décision.  
BLOCKER: aucun  
STOP_REQUIRED: non  
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL  
OWNER_NEXT: Claude  
EXECUTANT_NEXT: github-actions-claude  
ACTION_NEXT: Matérialiser cette décision sur le rail sans ouvrir de seconde PR.
