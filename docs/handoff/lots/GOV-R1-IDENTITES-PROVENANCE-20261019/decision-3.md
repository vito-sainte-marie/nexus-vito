---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39412471899), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6289480798. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R1-IDENTITES-PROVENANCE-20261019`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `ae927148c5bd29fbcdd48c06f8f6bebca0674f02`, `HEAD` = `ae927148c5bd29fbcdd48c06f8f6bebca0674f02`, SHA du run `ae927148c5bd29fbcdd48c06f8f6bebca0674f02`, tête du rail `ae927148c5bd29fbcdd48c06f8f6bebca0674f02`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Exécuter et consigner E1 à E5 rouges avant tout code, puis vertes après le code avec le cas de contrôle vert; utiliser le champ provenance défini ci-dessus; vérifier E5 par l’API sans repli silencieux; ne modifier ni tests.yml, workflow d’armement, permission, secret, identité, connecteur, Production, règle des niveaux, voie B ou ETAPE5; ne clore le lot qu’après dépôt des preuves vertes. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

La voie A relève de l’outillage réversible sur le rail, sans Production, secret, permission, identité ni workflow d’armement. Aucun palier réservé n’est déclenché. Les acquis `DELEGATION_ARBITRE`, `OUTILLAGE_A_POSTERIORI` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent.

La forme retenue pour l’enveloppe est un objet YAML de premier niveau :

```yaml
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: <URL canonique immuable du commentaire GitHub désigné>
```

Pour `author: ChatGPT`, l’outil doit vérifier par l’API que la référence désigne un commentaire de `github-actions[bot]`, que ce commentaire cite un run de `tests.yml` dont l’étape de relais a réussi, et que son contrat correspond exactement à la décision. Les valeurs de l’enveloppe ne suffisent jamais seules. L’indisponibilité de l’API entraîne un arrêt explicite. Le niveau 3 ne doit pas être revendiqué par cette voie, compte tenu du risque résiduel consigné.

Le lot reste ouvert jusqu’au dépôt des preuves rouges puis vertes et du cas de contrôle vert.

RAIL_LU: ae927148c5bd29fbcdd48c06f8f6bebca0674f02

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: GOV-R1-IDENTITES-PROVENANCE-20261019
REQUEST: request-4.md
HEAD: ae927148c5bd29fbcdd48c06f8f6bebca0674f02
LEASE: aucun
GATE_STATE: G1, CI non exécutée pour la mise en œuvre
PROOF_STATE: PROOF_REFRESH_REQUIRED
CONDITIONS: Exécuter et consigner E1 à E5 rouges avant tout code, puis vertes après le code avec le cas de contrôle vert; utiliser le champ provenance défini ci-dessus; vérifier E5 par l’API sans repli silencieux; ne modifier ni tests.yml, workflow d’armement, permission, secret, identité, connecteur, Production, règle des niveaux, voie B ou ETAPE5; ne clore le lot qu’après dépôt des preuves vertes.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
