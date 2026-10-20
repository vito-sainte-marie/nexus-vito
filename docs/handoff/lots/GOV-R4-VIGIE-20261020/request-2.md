---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-R4-VIGIE-20261020
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: rail-tete
    classe: VERIFIED
    valeur: f396f2a7
  - id: code-vigie
    classe: VERIFIED
    valeur: f396f2a7
---
# GOV-R4-VIGIE-20261020 : request-2, V1 livrée (résultats)

**Réponse à :** decision-1 de Frédéric (APPROVED_WITH_CONDITIONS, closes false, 5c882b64), consommée avec preuve d'action f396f2a7.

## Livré (V1 seule)
- `.github/workflows/vigie-cloture.yml` : `schedule` unique `17 * * * *` (horaire), `permissions: contents: read` seul, aucun secret, checkout sur le rail en `persist-credentials: false`, lecture anonyme de l'API GitHub (dépôt public). Aucun autre déclencheur.
- `outils/vigie-cloture-ci.js` : lance O3 en rapport (jamais `--appliquer`). Silence (code 0) si `RIEN_A_CONSOMMER` ; sinon `::error` nommant le lot et code 1 (clôture conforme en attente, ou refus/ambiguïté/panne d'O3 : échec fermé).
- `test_vigie_cloture_ci_20261020.js` : V1–V6, écrites et constatées rouges avant le code (0/6 puis 5/6 rouges avec V4 vide ; V4 renforcée pour exiger l'alerte), vertes ensuite : silence ; clôture conforme -> alerte ; non nue / altérée / commit humain / API muette / deux candidats -> alerte de refus ; aucune écriture ni push ; workflow statique (horaire, contents: read, sans secret, sans Telegram ni commentaire #28) ; script sans écriture.

## Preuve des conditions de decision-1
1. contents: read seul, O3 sans --appliquer : tenue (V5, V6). 2. Canal = échec du run + annotation nommant le lot, ni Telegram ni #28 : tenue. 3. Horaire, pas de nouvelle alerte sans changement d'état, hors rappel du run suivant en échec : tenue (V2, deux passages identiques). 4. Épreuves rouges avant le code : tenue. 5. Arrêt par désactivation du workflow ; V2 et V3 hors périmètre : rien n'y touche.

## Constats
Guardian QA : un finding sur ma propre épreuve V4 (attendu calculé par l'expression observée), corrigé ; ensuite 354 épreuves, 0 finding. `handoff.js verifier` vert. Suite `run-tests.js` : seuls les 9 échecs connus. `tests.yml` non modifié.

## Limite à connaître
Un workflow `schedule` ne s'exécute que depuis la branche par défaut (`main`). Il est ici sur le rail : tant qu'il n'est pas sur `main`, il ne tourne pas. Le porter sur `main` est une fusion/promotion (palier distinct) que cette demande ne prend pas. Première exécution réelle donc non observée ; seul le banc local la prouve.

## Demande
Valider V1 comme livrée (closes true) en nommant la limite ci-dessus, ou dire ce qui manque.
