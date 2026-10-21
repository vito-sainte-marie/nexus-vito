---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R4-VIGIE-MAIN-20261020
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6304913240
---
# Décision sur request-3.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39521199845), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6304913240. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R4-VIGIE-MAIN-20261020`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `88cfc280120933afeafeddf266b387a8d0017676`, `HEAD` = `88cfc280120933afeafeddf266b387a8d0017676`, SHA du run `88cfc280120933afeafeddf266b387a8d0017676`, tête du rail `88cfc280120933afeafeddf266b387a8d0017676`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Ouvrir uniquement une PR brouillon de gov-r4-vigie-main-20261020 vers main; conserver un diff limité à .github/workflows/vigie-cloture.yml identique au blob f396f2a7; ne pas activer l’auto-merge et ne pas fusionner; rapporter toute CI rouge avant toute demande de fusion; ne modifier aucun secret ni aucune permission de workflow dans ce lot. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Décision : APPROVED_WITH_CONDITIONS.**

La limitation mesurée de `github-actions-claude` est reconnue. Conformément à l’acquis `LIMITATION_CANAL_NON_STOP`, elle ne justifie ni arrêt ni réveil de Frédéric. Le canal suivant est `session-claude-habilitee`, où l’approbation interactive d’une commande constitue une contrainte technique du canal, pas un GO humain.

L’ouverture d’une PR brouillon vers `main` n’est ni une fusion ni un déploiement. Aucun nouveau câblage CI, secret ou élargissement de permissions n’est autorisé dans ce lot : il n’est pas nécessaire puisque le routage vers une session habilitée suffit.

RAIL_LU: 88cfc280120933afeafeddf266b387a8d0017676

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: GOV-R4-VIGIE-MAIN-20261020
REQUEST: request-3.md
HEAD: 88cfc280120933afeafeddf266b387a8d0017676
LEASE: aucun
GATE_STATE: G1, CI de PR non déclenchée
PROOF_STATE: PROOF_VALID
CONDITIONS: Ouvrir uniquement une PR brouillon de `gov-r4-vigie-main-20261020` vers `main`; conserver un diff limité à `.github/workflows/vigie-cloture.yml` identique au blob `f396f2a7`; ne pas activer l’auto-merge et ne pas fusionner; rapporter toute CI rouge avant toute demande de fusion; ne modifier aucun secret ni aucune permission de workflow dans ce lot.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: CANAL_PUBLICATION
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Ouvrir depuis `session-claude-habilitee` la PR brouillon de `gov-r4-vigie-main-20261020` vers `main` avec les conditions ci-dessus.
