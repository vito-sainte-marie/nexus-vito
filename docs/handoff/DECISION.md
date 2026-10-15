<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-LOT-RECONCILER-1-20261014/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-LOT-RECONCILER-1-20261014
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: NEEDS_EVIDENCE
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — NEEDS_EVIDENCE

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38662187122), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6181813660. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-LOT-RECONCILER-1-20261014`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `637703844e6022c6dc1bce881e7b29a9898d1791`, `HEAD` = `637703844e6022c6dc1bce881e7b29a9898d1791`, SHA du run `637703844e6022c6dc1bce881e7b29a9898d1791`, tête du rail `637703844e6022c6dc1bce881e7b29a9898d1791`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La demande établit correctement l’impossibilité d’exécuter `decision-1.md` sans inventer les six fichiers. La matière source reste toutefois indispensable : il faut l’archive annoncée correspondant à l’empreinte fournie, ou ses six fichiers exacts et lisibles depuis le rail. Cette preuve précise manque ; le lot reste donc en HOLD, sans escalade humaine. L’acquis `PALIER_HUMAIN_RESTREINT` s’applique.

RAIL_LU: 637703844e6022c6dc1bce881e7b29a9898d1791
NEXT_ACTION_CONTRACT
DECISION: NEEDS_EVIDENCE
CLOSES: false
LOT: NEXUS-LOT-RECONCILER-1-20261014
REQUEST: request-2.md
HEAD: 637703844e6022c6dc1bce881e7b29a9898d1791
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: L’archive source nexus-lot-reconciler.zip correspondant à l’empreinte annoncée, ou les six fichiers source exacts qu’elle contient, n’est lisible sur aucune branche ou pièce accessible.
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision NEEDS_EVIDENCE sur le rail.
