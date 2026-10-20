---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R2-EMPREINTE-DECISION-20261020
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6297752074
---
# Décision sur request-3.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39471674528), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6297752074. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R2-EMPREINTE-DECISION-20261020`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `3aa6a1808db0947f3a05659e0fcdbb6b224d464b`, `HEAD` = `3aa6a1808db0947f3a05659e0fcdbb6b224d464b`, SHA du run `3aa6a1808db0947f3a05659e0fcdbb6b224d464b`, tête du rail `3aa6a1808db0947f3a05659e0fcdbb6b224d464b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED.**

Les conditions de `decision-2.md` sont satisfaites : séquence rouge→vert conservée, périmètre limité à `outils/`, concordance contrôlée avec le commentaire désigné et son corps canonique, échecs explicites sans consommation, limites de la preuve documentées, et aucun câblage de workflow, permission ou mécanisme d’armement.

Le correctif F9/F9b traite précisément l’enveloppe ajoutée par le relais sans tolérer d’autres altérations. Le risque lié à l’identité partagée de `github-actions[bot]` demeure correctement qualifié comme limite et n’empêche pas la clôture de R2. Les acquis `OUTILLAGE_A_POSTERIORI` et `PALIER_HUMAIN_RESTREINT` s’appliquent. Aucun motif de palier Frédéric n’est déclenché.

RAIL_LU: 3aa6a1808db0947f3a05659e0fcdbb6b224d464b
NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: GOV-R2-EMPREINTE-DECISION-20261020
REQUEST: request-3.md
HEAD: 3aa6a1808db0947f3a05659e0fcdbb6b224d464b
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision de clôture sur le rail avec outils/handoff.js decision --auteur ChatGPT.
