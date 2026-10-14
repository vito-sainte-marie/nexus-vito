<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REPARATION-HANDOFF-1-20261014/decision-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REPARATION-HANDOFF-1-20261014
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-4.md
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38606012180), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6174203864. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REPARATION-HANDOFF-1-20261014`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `9437eda341ef9f88b794bc4259d9c39a4c2ffb57`, `HEAD` = `9437eda341ef9f88b794bc4259d9c39a4c2ffb57`, SHA du run `9437eda341ef9f88b794bc4259d9c39a4c2ffb57`, tête du rail `9437eda341ef9f88b794bc4259d9c39a4c2ffb57`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Transférer dans un lot successeur distinct le câblage CI rail-only de la condition 4, le compteur append-only des répétitions et le skill nexus-incidents ; prouver lease, concurrence dédiée, idempotence, absence de récursion ou relance et absence de permission nouvelle ou élargie. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

P8/1 et P8/2 sont validées sur les preuves fournies et la CI verte. L’enregistrement manuel suffit à valider le cas réel, mais ne remplace pas la condition 4.

Le lot actuel peut être clos par transfert explicite du reliquat vers un lot successeur distinct :

- câblage CI de l’enregistrement automatique sur le rail, sous lease et `concurrency`, sans récursion ni redéclenchement ;
- compteur append-only des répétitions ;
- skill `nexus-incidents`.

Ce câblage est autorisé par `COMMIT_PUSH_RAIL_SANS_GO`, `OUTILLAGE_A_POSTERIORI` et `PREAUTORISATIONS_CLAUDE`. Il ne doit toutefois introduire aucune permission nouvelle ni élargir une permission existante. Si un tel élargissement devient nécessaire, il relève alors de `SECRET_PERMISSION_SURFACE_SECURITE`.

RAIL_LU: 9437eda341ef9f88b794bc4259d9c39a4c2ffb57
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: NEXUS-REPARATION-HANDOFF-1-20261014
REQUEST: request-4.md
HEAD: 9437eda341ef9f88b794bc4259d9c39a4c2ffb57
LEASE: aucun
GATE_STATE: G3, CI Tests success sur d359ccac, run 38603628075
PROOF_STATE: PROOF_VALID
CONDITIONS: Transférer dans un lot successeur distinct le câblage CI rail-only de la condition 4, le compteur append-only des répétitions et le skill nexus-incidents ; prouver lease, concurrence dédiée, idempotence, absence de récursion ou relance et absence de permission nouvelle ou élargie.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Créer sur le rail le lot successeur portant les trois reliquats et leur périmètre de preuve.
