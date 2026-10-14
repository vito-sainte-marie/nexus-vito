<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-INCIDENTS-CI-1-20261014/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-INCIDENTS-CI-1-20261014
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38613956387), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6175273246. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-INCIDENTS-CI-1-20261014`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `2bbad043898f1d81fc7770a922728be70fce534e`, `HEAD` = `2bbad043898f1d81fc7770a922728be70fce534e`, SHA du run `2bbad043898f1d81fc7770a922728be70fce534e`, tête du rail `2bbad043898f1d81fc7770a922728be70fce534e`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Transporter uniquement les trois changements de l’item 1 sur la tête courante du rail, sans force, sans modification de permission et sans toucher main ni production; conserver lease, concurrence dédiée, idempotence, absence de relance et classement NON_ENREGISTRE des arrêts de sécurité; obtenir ensuite la CI rail verte avant clôture. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS — lot maintenu ouvert.**

Les items 2 et 3 sont validés comme livrés au commit `5faa4cce`. L’item 1 reste une condition de clôture : sa simulation est recevable, mais son contenu doit encore être transporté sur le rail et validé par la CI du rail.

Conformément à `LIMITATION_CANAL_NON_STOP`, le refus du jeton actuel est une limitation de canal, pas un STOP. Le transport est routé vers `session-claude-habilitee`, qui détient `DEPOT_ECRITURE_RAIL`. Aucun élargissement de permission n’est demandé. `COMMIT_PUSH_RAIL_SANS_GO` et `PREAUTORISATIONS_CLAUDE` autorisent ce transport sous lease, sans nouveau GO humain.

RAIL_LU: 2bbad043898f1d81fc7770a922728be70fce534e

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-INCIDENTS-CI-1-20261014
REQUEST: request-2.md
HEAD: 2bbad043898f1d81fc7770a922728be70fce534e
LEASE: 2bbad043898f1d81fc7770a922728be70fce534e
GATE_STATE: G0, items 2 et 3 livrés; item 1 simulé vert mais CI rail non encore exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Transporter uniquement les trois changements de l’item 1 sur la tête courante du rail, sans force, sans modification de permission et sans toucher main ni production; conserver lease, concurrence dédiée, idempotence, absence de relance et classement NON_ENREGISTRE des arrêts de sécurité; obtenir ensuite la CI rail verte avant clôture.
BLOCKER: aucun; la limitation du jeton github-actions-claude est routée vers un exécutant disposant de DEPOT_ECRITURE_RAIL
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Reproduire les changements de l’item 1 issus de aeff14c1 sur le HEAD du rail sous lease puis les pousser sans force.
