<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/VIGIE-DECLENCHEURS-20261024/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: VIGIE-DECLENCHEURS-20261024
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c33ec337 production=d76e9c07
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# VIGIE-DECLENCHEURS-20261024 : déclencher la vigie sur la fin des Tests du rail, le cron restant en filet

*Déposée après la clôture de VIGIE-CI-RAIL-20261024 (decision-4, Frédéric, closes:true), qui lui reporte la preuve du premier passage réel de la vigie.*

## Constat
Le cron `17 * * * *` de `vigie-cloture.yml` ne passe pas toutes les heures : GitHub le déclenche toutes les 3 à 6 heures (17 passages sur 48 attendus en deux jours ; derniers passages relevés le 23/10 à 10:07, 15:07, 19:17, 23:10, puis le 24/10 à 01:37 et 07:20). Un rail rouge peut donc rester sans alerte plusieurs heures au-delà du seuil de 60 min. Le premier passage depuis #154 (fusionnée à 10:42 UTC) n'avait pas eu lieu à 11:35.

## Changement proposé (un seul fichier : `.github/workflows/vigie-cloture.yml`)
- Ajouter `workflow_dispatch` (déclenchement manuel).
- Ajouter `workflow_run` sur la fin du workflow « Tests », `types: [completed]`, `branches: [handoff-continuite-20260920]`.
- Garder le cron `17 * * * *` comme filet.
- Permissions inchangées : `contents: read`, `actions: read`. Aucun secret, aucune écriture.
Note : `workflow_run` ne s'exécute que depuis la branche par défaut (`main`) : le changement passe par une PR sur `main`, sur GO de Frédéric.

## Épreuve (à écrire avec le changement)
Le workflow déclare exactement ces trois déclencheurs (`schedule`, `workflow_dispatch`, `workflow_run`) et rien d'autre ; le `workflow_run` vise « Tests » et la branche du rail ; les permissions sont exactement `contents: read` + `actions: read`. Mutations : déclencheur supplémentaire (`push`), déclencheur retiré (cron), permission élargie, branche du `workflow_run` omise.

## Preuve reportée de VIGIE-CI-RAIL-20261024
Après la fusion sur `main`, lancer la vigie à la main (`workflow_dispatch`), lire le run et consigner : silence sur rail vert, ou alerte diagnostiquée. C'est le critère de clôture de ce lot.

## Limites
Un `workflow_run` lancé juste à la fin d'un run rouge ne dépasse pas encore 60 min : l'alerte vient du passage suivant (fin du run suivant ou cron). Le gain porte sur la fréquence des passages tant que le rail reçoit des pushes ; un rail rouge et immobile reste couvert par le seul cron.

## À arbitrer
Approuver ces trois déclencheurs et la limite ci-dessus.
