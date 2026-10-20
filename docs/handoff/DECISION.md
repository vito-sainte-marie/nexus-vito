<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-R1-IDENTITES-PROVENANCE-20261019/decision-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: GOV-R1-IDENTITES-PROVENANCE-20261019
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-5.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6289948010
---
# Décision sur request-5.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39415851016), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6289948010. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `GOV-R1-IDENTITES-PROVENANCE-20261019`, `REQUEST` = `request-5.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `d973e1a4d0d0da04d06320f2a543521f00398b4a`, `HEAD` = `d973e1a4d0d0da04d06320f2a543521f00398b4a`, SHA du run `d973e1a4d0d0da04d06320f2a543521f00398b4a`, tête du rail `d973e1a4d0d0da04d06320f2a543521f00398b4a`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**APPROVED.** Les conditions de `decision-3.md` sont satisfaites : séquence rouge/verte consignée, 16/16 épreuves finales avec cas de contrôle, garde API sans repli silencieux, non-régression diagnostiquée et périmètre respecté. La divergence d’environnement est attribuée et ne constitue pas une régression produit, conformément à `REGRESSION_PRODUIT_VS_BANC`. L’exécution a posteriori de cet outillage relève de `OUTILLAGE_A_POSTERIORI`. Aucun motif d’escalade humaine n’est constitué.

RAIL_LU: d973e1a4d0d0da04d06320f2a543521f00398b4a

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: GOV-R1-IDENTITES-PROVENANCE-20261019
REQUEST: request-5.md
HEAD: d973e1a4d0d0da04d06320f2a543521f00398b4a
LEASE: aucun
GATE_STATE: G2, épreuves ciblées et non-régression vertes
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser sur le rail la décision APPROVED fermant le lot en réponse à request-5.md.
