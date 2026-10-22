<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-SAISIE-DIRECTE-20261022/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6343714682
---
# Décision sur request-1.md — APPROVED

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39798934649), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6343714682. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-SAISIE-DIRECTE-20261022`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `f0edc8d3472ba32f06265419995c507644701c5d`, `HEAD` = `f0edc8d3472ba32f06265419995c507644701c5d`, SHA du run `f0edc8d3472ba32f06265419995c507644701c5d`, tête du rail `f0edc8d3472ba32f06265419995c507644701c5d`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED.**

Le périmètre est borné à l’écran de jaugeage, sans OCR, SQL, RLS, mutation Supabase Production, fusion ni déploiement. La priorité donnée à la saisie directe provient de la demande métier de Frédéric ; elle ne constitue donc pas une `DECISION_METIER_NON_ARBITREE`.

`STATE.json` confirme que `JAUGEAGE-SAISIE-DIRECTE-20261022` est le lot actif en attente de décision ; l’ancien constat sur `lot_actif` est périmé. Les acquis `DELEGATION_ARBITRE`, `COMMIT_PUSH_RAIL_SANS_GO`, `PREAUTORISATIONS_CLAUDE` et `MOUVEMENT_REF_ATTRIBUE` permettent l’exécution sans geste humain supplémentaire avant la PR brouillon. Toute fusion ou tout déploiement vers Production restera soumis au palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

RAIL_LU: f0edc8d3472ba32f06265419995c507644701c5d

NEXT_ACTION_CONTRACT
DECISION: APPROVED
CLOSES: false
LOT: JAUGEAGE-SAISIE-DIRECTE-20261022
REQUEST: request-1.md
HEAD: f0edc8d3472ba32f06265419995c507644701c5d
LEASE: aucun
GATE_STATE: G0, CI non lancée
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
