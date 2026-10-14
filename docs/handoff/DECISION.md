<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REPARATION-HANDOFF-1-20261014/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REPARATION-HANDOFF-1-20261014
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38587248558), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6171642203. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REPARATION-HANDOFF-1-20261014`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `0bdbac4d7e5d1054f44c944f17a7b1be806efc0e`, `HEAD` = `0bdbac4d7e5d1054f44c944f17a7b1be806efc0e`, SHA du run `0bdbac4d7e5d1054f44c944f17a7b1be806efc0e`, tête du rail `0bdbac4d7e5d1054f44c944f17a7b1be806efc0e`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Étendre watchdog-stagnation.js plutôt que créer un classeur indépendant; appliquer le seuil provisoire de 30 minutes; exclure les décisions humaines; limiter P6 à une détection et une traçabilité non bloquantes; n’effectuer aucune relance automatique d’action sensible; couvrir P3 par des tests et conserver la CI du rail verte. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**APPROVED_WITH_CONDITIONS.**

P1 et P2 sont acceptés comme partie matérialisée : intégration ordonnée sur le rail, CI verte et rejeu sans nouvelle régression. Les neuf échecs déjà diagnostiqués restent couverts par l’acquis `REGRESSION_PRODUIT_VS_BANC`.

P3 doit être réalisé comme **extension de `outils/watchdog-stagnation.js`**, avec possibilité d’extraire un module partagé interne, mais sans créer un second classeur indépendant concurrent. Le câblage doit rester limité à la détection, au classement, à la traçabilité et aux tests : aucune relance automatique d’action sensible.

L’appel OpenAI réel n’est pas autorisé par cette décision. Son déclenchement avec `OPENAI_API_KEY` et `NEXUS_RELAIS_OPENAI` devra faire l’objet d’un routage séparé relevant de `SECRET_PERMISSION_SURFACE_SECURITE` et, si une boucle agissant au nom de Frédéric est effectivement armée, de `ARMEMENT_BOUCLE_AU_NOM_DE_FREDERIC`. Cela ne bloque pas la réalisation de P3 par Claude.

RAIL_LU: 0bdbac4d7e5d1054f44c944f17a7b1be806efc0e

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-REPARATION-HANDOFF-1-20261014
REQUEST: request-2.md
HEAD: 0bdbac4d7e5d1054f44c944f17a7b1be806efc0e
LEASE: aucun
GATE_STATE: G1, CI du rail verte
PROOF_STATE: PROOF_VALID
CONDITIONS: Étendre watchdog-stagnation.js plutôt que créer un classeur indépendant; appliquer le seuil provisoire de 30 minutes; exclure les décisions humaines; limiter P6 à une détection et une traçabilité non bloquantes; n’effectuer aucune relance automatique d’action sensible; couvrir P3 par des tests et conserver la CI du rail verte.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Implémenter et tester P3 comme extension de outils/watchdog-stagnation.js sur le rail.
