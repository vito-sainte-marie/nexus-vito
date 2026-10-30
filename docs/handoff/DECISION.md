<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/MENU-ACCUEIL-EMPLOYE-20261030/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 5
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: true
in_reply_to: request-6.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6528110196
---
# Décision sur request-6.md — APPROVED, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41091730616), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6528110196. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `MENU-ACCUEIL-EMPLOYE-20261030`, `REQUEST` = `request-6.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `17af8de20d3373689217bd5280a53f1305cd7cb1`, `HEAD` = `17af8de20d3373689217bd5280a53f1305cd7cb1`, SHA du run `17af8de20d3373689217bd5280a53f1305cd7cb1`, tête du rail `17af8de20d3373689217bd5280a53f1305cd7cb1`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La fusion et le déploiement Production sont des faits passés, attribués à Frédéric et vérifiés verts. Leur consignation n’autorise aucune nouvelle opération Production. L’acquis `MOUVEMENT_REF_ATTRIBUE` s’applique.

Conformément à `STATE.json`, la dernière décision enregistrée est `decision-3.md`, et non `decision-4.md`; le présent verdict clôt donc le lot sans dépendre de cette référence historique divergente. Les sujets explicitement hors lot ne bloquent pas, selon `SUJET_ETRANGER_NE_BLOQUE_PAS`.

BRANCHE_DU_LOT: menu-accueil-employe-20261030

RAIL_LU: 17af8de20d3373689217bd5280a53f1305cd7cb1

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: true
LOT: MENU-ACCUEIL-EMPLOYE-20261030
REQUEST: request-6.md
HEAD: 17af8de20d3373689217bd5280a53f1305cd7cb1
LEASE: aucun
GATE_STATE: G3, CI Production verte
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision de clôture sur le rail avec `outils/handoff.js decision --auteur ChatGPT`.
