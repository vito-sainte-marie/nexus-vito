---
protocol: nexus-handoff/2
kind: request
lot_id: FERMETURE-PISTE-20261031
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=840bb0c6
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 169-fichiers
  - id: pr167
    classe: DECLARED
    valeur: ouverte
---
# FERMETURE-PISTE-20261031 : request-4 — demande rectificative (quart de service dans le fil)

BRANCHE_DU_LOT: fermeture-piste-correctif-quart-20261031

Cette demande ne réécrit pas request-3 : elle consigne un correctif ordonné par Frédéric (relais Guardian, #160, 6547510392) à intégrer au lot avant sa clôture.

## Régression constatée en Production (31/10, Guardian #160 6547470929)
Samedi (horaires étendus), après l'index de fin de quart, l'étape 2 du fil a créé un quart du soir ; les 5 comptages de clôture du pompiste du matin y sont tombés ; il a refait la clôture sur le quart du matin via le menu. Cause : `NEXUS-Inventaire-v1.html` choisissait le quart d'après l'horloge de la station, et n'imposait le quart du service qu'après avoir créé quart, quart-employé, missions et plan.

## Décisions de Frédéric
1. Aucune réparation des données Production du quart du soir du 31/10.
2. Correctif dans le lot : le fil ouvre et clôt le quart du service, jamais celui de l'heure.
3. Guardian fait la recette sur Test ; Frédéric fusionne et clôt le lot.

## Correctif
PR #167 (base `production`) : https://github.com/vito-sainte-marie/nexus-vito/pull/167 — quart du service imposé dès la résolution du rôle, avant toute création ; inclut dd89e844 (tri de la plage « Fermeture »). Hors fil : inchangé.

## Preuve des conditions
- Épreuves avec mutations : pompiste du matin samedi 14 h 15 → matin ; lundi 13 h → matin ; pompiste du soir 14 h 15 → soir ; ordre avant toute création (4 mutations tuées, 32 au total).
- `node run-tests.js` : seules les 7 défaillances préexistantes.
- Recette Test à faire par Guardian : Employé Test B, pompiste du matin, clôture après 13 h (Test n'a que les horaires normaux).

## À arbitrer
Le périmètre de request-3 est-il complété par ce correctif, la clôture (CLOSES) restant conditionnée à la recette Guardian et à la fusion de #167 par Frédéric ? Aucune opération en Production.
