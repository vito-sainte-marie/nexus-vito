<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-2-20261022/decision-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-2-20261022
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6346476913
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39818781032), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6346476913. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-2-20261022`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `47b54cd5780e91097c9d831ee2557d1a57bb62f7`, `HEAD` = `47b54cd5780e91097c9d831ee2557d1a57bb62f7`, SHA du run `47b54cd5780e91097c9d831ee2557d1a57bb62f7`, tête du rail `47b54cd5780e91097c9d831ee2557d1a57bb62f7`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Implémenter sur une branche applicative distincte du rail et ouvrir uniquement une PR brouillon ; limiter le changement à la capture guidée réservée au jaugeage, sans modifier le lecteur Vision ni l’environnement iMac ; conserver à l’identique le comportement observable des appels Pointage et Relevés Piste, avec une épreuve dédiée ; inclure dans le recadrage l’en-tête date/heure et le repère 2 × 2 ; documenter dans la source les proportions et leur preuve de confirmation ainsi que les seuils de netteté/reflet ; établir des épreuves rouges puis vertes et des mutations couvrant cadrage, recadrage, rejet qualité et non-régression ; mesurer le délai inférieur à 2 secondes sur le navigateur de test sans le présenter comme une preuve iPhone ; ne déclarer les seuils définitifs qu’après recette iPhone et calibration sur les quinze photos ; l’étape B peut avancer en parallèle, mais les quinze photos et leur calibration suivent la validation de la capture ; aucune fusion, écriture Production ou mise en service. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

L’étape de capture guidée est approuvée hors Production. Elle ne relève d’aucun motif d’escalade humaine. Conformément à `PALIER_HUMAIN_RESTREINT`, l’arbitrage présent tient lieu de GO ; conformément à `COMMIT_PUSH_RAIL_SANS_GO`, la branche de travail, les commits, les tests et la PR brouillon ne demandent aucun GO supplémentaire.

Ordre fixé :

1. réaliser la capture guidée et sa recette navigateur au format téléphone ;
2. mener l’étape B sur l’iMac après ou en parallèle, puisqu’elle est indépendante ;
3. valider la capture sur iPhone réel ;
4. prendre les quinze photos ;
5. calibrer les seuils OCR sur ces photos.

Aucune fusion, promotion ou mise en Production n’est autorisée par cette décision.

RAIL_LU: 47b54cd5780e91097c9d831ee2557d1a57bb62f7
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-OCR-2-20261022
REQUEST: request-4.md
HEAD: 47b54cd5780e91097c9d831ee2557d1a57bb62f7
LEASE: aucun
GATE_STATE: G1, CI non exécutée car code de cette étape encore absent
PROOF_STATE: PROOF_VALID
CONDITIONS: Implémenter sur une branche applicative distincte du rail et ouvrir uniquement une PR brouillon ; limiter le changement à la capture guidée réservée au jaugeage, sans modifier le lecteur Vision ni l’environnement iMac ; conserver à l’identique le comportement observable des appels Pointage et Relevés Piste, avec une épreuve dédiée ; inclure dans le recadrage l’en-tête date/heure et le repère 2 × 2 ; documenter dans la source les proportions et leur preuve de confirmation ainsi que les seuils de netteté/reflet ; établir des épreuves rouges puis vertes et des mutations couvrant cadrage, recadrage, rejet qualité et non-régression ; mesurer le délai inférieur à 2 secondes sur le navigateur de test sans le présenter comme une preuve iPhone ; ne déclarer les seuils définitifs qu’après recette iPhone et calibration sur les quinze photos ; l’étape B peut avancer en parallèle, mais les quinze photos et leur calibration suivent la validation de la capture ; aucune fusion, écriture Production ou mise en service.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
