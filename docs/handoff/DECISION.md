<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-PHOTO-20261021/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-PHOTO-20261021
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6315052521
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39593674563), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6315052521. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-PHOTO-20261021`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `a2f54df27410f00e46f7280ccb679a786d867c7a`, `HEAD` = `a2f54df27410f00e46f7280ccb679a786d867c7a`, SHA du run `a2f54df27410f00e46f7280ccb679a786d867c7a`, tête du rail `a2f54df27410f00e46f7280ccb679a786d867c7a`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Publier uniquement sur l’aperçu Test ; consigner une recette iPhone couvrant caméra en page, repli natif, upload redimensionné, restauration d’état et lien profond ; ne créer aucune PR vers production avant le GO explicite de Frédéric sous PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le périmètre Test est autorisé. Les sept échecs de suite complète sont diagnostiqués comme préexistants et identiques sur `origin/production` ; conformément à `REGRESSION_PRODUIT_VS_BANC`, ils ne constituent pas une régression produit ni un STOP.

La recette iPhone doit précéder toute PR vers `production`. La présente décision n’autorise ni PR, ni fusion, ni déploiement vers Production : cette étape devra être soumise à Frédéric sous le code `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`. Les commits et pushs sur le rail restent libres conformément à `COMMIT_PUSH_RAIL_SANS_GO`.

RAIL_LU: a2f54df27410f00e46f7280ccb679a786d867c7a

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-PHOTO-20261021
REQUEST: request-1.md
HEAD: a2f54df27410f00e46f7280ccb679a786d867c7a
LEASE: aucun
GATE_STATE: G2, épreuves ciblées vertes et 7 échecs de suite complète diagnostiqués comme préexistants sur origin/production
PROOF_STATE: PROOF_VALID
CONDITIONS: Publier uniquement sur l’aperçu Test ; consigner une recette iPhone couvrant caméra en page, repli natif, upload redimensionné, restauration d’état et lien profond ; ne créer aucune PR vers production avant le GO explicite de Frédéric sous PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: CANAL_PUBLICATION
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Publier sur l’aperçu Test le commit 168674c03ccdec2a3187a4c2dd8d61ad4fd46edc et consigner son URL pour la recette iPhone.
