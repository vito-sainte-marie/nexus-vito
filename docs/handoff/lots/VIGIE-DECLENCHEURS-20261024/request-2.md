---
protocol: nexus-handoff/2
kind: request
lot_id: VIGIE-DECLENCHEURS-20261024
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=d76e9c07
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# VIGIE-DECLENCHEURS-20261024 : preuves réelles, demande de clôture

## Preuve des conditions de decision-1
- Changement limité à `.github/workflows/vigie-cloture.yml` : PR #155, fusionnée dans `main` sur le GO de Frédéric (`f56edb0d`).
- Exactement trois déclencheurs (`schedule`, `workflow_dispatch`, `workflow_run` sur « Tests » terminé, branche `handoff-continuite-20260920`) ; permissions inchangées (`contents: read`, `actions: read`) ; épreuve `test_vigie_declencheurs_20261024.js` 11/11, dont 10 mutations refusées (`f90738b2`).
- Preuves de fonctionnement, détaillées dans `docs/executions-lot-VIGIE-DECLENCHEURS-20261024.md` :
  - run **#18**, `workflow_dispatch`, vert, les deux étapes en succès, silencieux sur rail vert (`27371ee8`) ;
  - run **#19**, `workflow_run`, vert, démarré à la fin de « Tests » sur le dépôt `40d12018`, sans cron ni lancement manuel.

## Ce qui est prouvé, et ce qui ne l'est pas
Prouvé : les deux nouveaux déclencheurs partent, et la vigie passe en silence sur un rail vert. Non prouvé : l'alerte sur un rail rouge. Les épreuves de `outils/vigie-ci-rail.js` la couvrent avec un faux `gh` (15/15), mais aucun rail rouge réel n'a été observé. La limite de decision-1 demeure : un rail rouge et immobile n'est couvert que par le cron.

## À arbitrer
Clore VIGIE-DECLENCHEURS-20261024, et avec lui la preuve du premier passage réel reportée de VIGIE-CI-RAIL-20261024.
