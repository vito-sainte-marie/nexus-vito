<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-20261021
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: NEEDS_EVIDENCE
closes: false
in_reply_to: request-5.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6327973383
---
# Décision sur request-5.md — NEEDS_EVIDENCE

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39686646904), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6327973383. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-20261021`, `REQUEST` = `request-5.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `2bd2f51d92c63841e44975bbde8b2f81ddad3363`, `HEAD` = `2bd2f51d92c63841e44975bbde8b2f81ddad3363`, SHA du run `2bd2f51d92c63841e44975bbde8b2f81ddad3363`, tête du rail `2bd2f51d92c63841e44975bbde8b2f81ddad3363`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision : HOLD — preuve matérielle précise manquante

Le blocage est établi : ni la copie à jour du worker ni les photographies de calibration ne sont accessibles depuis le canal `github-actions-claude`. Il ne faut pas reconstruire ces sources de mémoire ni contourner la comparaison iMac/iCloud prescrite.

Les preuves attendues sont :

1. Les copies iMac et iCloud du worker, avec leur provenance et leurs empreintes SHA-256, comprenant notamment `main.py`, `ocr_engine.py` et la source Swift.
2. Environ quinze photographies réelles de l’aperçu Test, accompagnées d’une consignation de provenance et d’une confirmation d’absence de donnée personnelle.
3. Pour tout fichier retenu, l’identification explicite de la copie canonique après comparaison des empreintes.

Frédéric est concrètement la personne pouvant **produire ou exporter** ces éléments puisqu’il détient l’accès physique et local nécessaire. Ce constat n’est ni une demande de GO ni un STOP : aucun des dix motifs d’escalade ne s’applique. `PALIER_HUMAIN_RESTREINT` demeure applicable.

Une fois ces éléments déposés sur le rail avec leur provenance, Claude peut, sans nouvel arbitrage intermédiaire :

- comparer les empreintes et identifier la copie canonique ;
- effectuer le scan de secrets et exclure binaires et données personnelles ;
- limiter les changements au polling d’une seconde et au lecteur Vision résident avec relance et fallback ponctuel ;
- exécuter les mesures Test demandées et consigner latence, exactitude par volume et recalibrage du seuil provisoire de 0,5.

Cette autonomie découle notamment de `COMMIT_PUSH_RAIL_SANS_GO` et `PREAUTORISATIONS_CLAUDE`. Les résultats devront ensuite être présentés comme preuves d’exécution des conditions de `decision-2.md`, sans solliciter une décision séparée pour chaque sous-étape.

RAIL_LU: 2bd2f51d92c63841e44975bbde8b2f81ddad3363

NEXT_ACTION_CONTRACT
DECISION: NEEDS_EVIDENCE
CLOSES: false
LOT: JAUGEAGE-OCR-20261021
REQUEST: request-5.md
HEAD: 2bd2f51d92c63841e44975bbde8b2f81ddad3363
LEASE: aucun
GATE_STATE: G1, CI de registre saine ; exécution applicative suspendue faute d’artefacts
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: Copies iMac et iCloud du worker avec provenance et empreintes SHA-256, ainsi qu’environ quinze photos réelles de calibration Test avec provenance et confirmation d’absence de donnée personnelle, non disponibles sur le rail
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision NEEDS_EVIDENCE sur le rail sans modifier le verdict.
