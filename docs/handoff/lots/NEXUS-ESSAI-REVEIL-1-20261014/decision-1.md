---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-ESSAI-REVEIL-1-20261014
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38645920055), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6179662228. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-ESSAI-REVEIL-1-20261014`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `c1392239ca5b68f70255af7a546a5c6658e06774`, `HEAD` = `c1392239ca5b68f70255af7a546a5c6658e06774`, SHA du run `c1392239ca5b68f70255af7a546a5c6658e06774`, tête du rail `c1392239ca5b68f70255af7a546a5c6658e06774`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Lease valide avant écriture; une seule ligne de preuve avec lot, run, SHA de décision et horodatage UTC; écritures limitées au rail et aux artefacts protocolaires nécessaires; aucun accès ou changement Production, main, secret ou permission; scénario B interdit avant PASS explicite de A. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le scénario A est un essai borné, sans effet métier, limité au rail et sans mutation de Production, secret, permission ou ref protégée. Il ne constitue pas l’armement d’une boucle ouverte agissant au nom de Frédéric : l’action autorisée est unique, contrôlée et traçable.

Les acquis `DELEGATION_ARBITRE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent. Aucun nouveau GO humain n’est requis.

Conditions :
1. Acquérir un lease valide avant toute écriture sur le rail.
2. Écrire exactement une ligne de preuve dans le fichier désigné, contenant le lot, l’identifiant du run, le SHA de la décision matérialisée et l’horodatage UTC.
3. Ne modifier que les artefacts protocolaires nécessaires à la matérialisation, à la consommation et au compte rendu, ainsi que ce fichier de preuve.
4. Ne toucher ni `main`, ni `production`, ni aux permissions, secrets, déploiements, migrations ou bases Production.
5. Ne lancer le scénario B qu’après constat explicite du PASS du scénario A.

RAIL_LU: c1392239ca5b68f70255af7a546a5c6658e06774

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-ESSAI-REVEIL-1-20261014
REQUEST: request-1.md
HEAD: c1392239ca5b68f70255af7a546a5c6658e06774
LEASE: aucun
GATE_STATE: G0, CI non démarrée pour l’action approuvée
PROOF_STATE: PROOF_VALID
CONDITIONS: Lease valide avant écriture; une seule ligne de preuve avec lot, run, SHA de décision et horodatage UTC; écritures limitées au rail et aux artefacts protocolaires nécessaires; aucun accès ou changement Production, main, secret ou permission; scénario B interdit avant PASS explicite de A.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Sous lease valide, écrire la ligne de preuve prescrite dans preuve-reveil.txt, puis consommer la décision et rendre le compte rendu du scénario A.
