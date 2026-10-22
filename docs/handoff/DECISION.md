<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-2-20261022/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-2-20261022
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6345444393
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39811295411), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6345444393. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-2-20261022`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `e43f96329f1f6bed20f7aecd6d0f3eceb6b5a512`, `HEAD` = `e43f96329f1f6bed20f7aecd6d0f3eceb6b5a512`, SHA du run `e43f96329f1f6bed20f7aecd6d0f3eceb6b5a512`, tête du rail `e43f96329f1f6bed20f7aecd6d0f3eceb6b5a512`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Conserver l’étape B dans ce lot ; versionner un protocole reproductible de commandes unitaires ; compiler puis exécuter les tests synthétiques sur l’iMac et consigner sorties, versions et latences ; diagnostiquer les 4 min 30 avant tout correctif ; ne modifier ni plist, ni service, ni PATH, ni environnement, et ne mettre aucun composant en service ; maintenir les PDF sur ocrmypdf et Vision pour toutes les images ; ne pas ajouter Paddle ou un venv 2.x ; réserver la calibration du seuil aux quinze photos réelles tracées et sans donnée personnelle. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**APPROVED_WITH_CONDITIONS — closes: false.**

L’étape A est livrée conformément à `decision-1.md` : sources et tests synthétiques sont versionnés avec leurs empreintes, sans intervention sur l’iMac, Production, `main`, secrets ni mise en service.

L’étape B reste dans ce lot. Aucun nouveau lot ni GO humain n’est requis pour sa préparation : application de `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO`. La disponibilité matérielle de l’iMac n’est pas un motif de STOP. En revanche, compilation, essais réels et diagnostic restent à prouver avant toute intégration ou bascule.

RAIL_LU: e43f96329f1f6bed20f7aecd6d0f3eceb6b5a512

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-OCR-2-20261022
REQUEST: request-2.md
HEAD: e43f96329f1f6bed20f7aecd6d0f3eceb6b5a512
LEASE: aucun
GATE_STATE: G1, CI non exécutée pour les tests Swift réservés à l’iMac
PROOF_STATE: PROOF_VALID
CONDITIONS: Conserver l’étape B dans ce lot ; versionner un protocole reproductible de commandes unitaires ; compiler puis exécuter les tests synthétiques sur l’iMac et consigner sorties, versions et latences ; diagnostiquer les 4 min 30 avant tout correctif ; ne modifier ni plist, ni service, ni PATH, ni environnement, et ne mettre aucun composant en service ; maintenir les PDF sur ocrmypdf et Vision pour toutes les images ; ne pas ajouter Paddle ou un venv 2.x ; réserver la calibration du seuil aux quinze photos réelles tracées et sans donnée personnelle.
BLOCKER: aucun pour préparer l’étape B ; son exécution réelle attend la disponibilité de l’iMac et les preuves locales.
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Versionner sur le rail le protocole reproductible de l’étape B, limité à la lecture diagnostique, à la compilation et aux tests sans mise en service.
