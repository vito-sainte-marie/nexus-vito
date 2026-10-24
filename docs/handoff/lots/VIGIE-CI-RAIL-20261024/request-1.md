---
protocol: nexus-handoff/2
kind: request
lot_id: VIGIE-CI-RAIL-20261024
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=d76e9c07
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# VIGIE-CI-RAIL-20261024 : alerte quand la CI du rail reste rouge plus d'une heure

*Déposé sur instruction de Frédéric (24/10/2026, « Vigie de la CI du rail en premier »). Il accorde pour ce lot la permission `actions: read` au workflow de la vigie, en lecture seule, et la modification de `main` par PR, fusionnée sur son GO.*

## Constat
Une CI rouge sur le rail peut rester inaperçue : aucune vigie ne la regarde. La vigie existante (`vigie-cloture.yml`, cron `17 * * * *`) ne lit que les clôtures.

## Ce qui est fait
- `outils/vigie-ci-rail.js` : lit les derniers runs du workflow `Tests` sur le rail (`gh run list`, `gh run view --log-failed`, lecture seule). Dernier run terminé rouge depuis **plus de 60 min** : `::error` qui nomme le commit, le run et la première ligne rouge, sortie 1. Un run vert plus récent, un run en cours ou annulé ne lèvent ni n'ouvrent d'alerte. `gh` en panne : alerte « aveugle » (une vigie qui ne voit pas le dit).
- `.github/workflows/vigie-cloture.yml` : `actions: read` en plus de `contents: read`, et l'étape `Surveiller la CI du rail` (`if: always()`, `github.token` seul, aucun `secrets.`).
- Rail : commit `6a882c8f`, CI verte. Le workflow planifié tourne depuis `main` : même fichier porté par la **PR #154 (brouillon)**, à fusionner sur le GO de Frédéric.

## Preuves
- `test_vigie_ci_rail_20261024.js` avec un faux `gh` : **rouge à 61 min : alerte ; à 59 min et à 60 min : muet** ; vert après rouge : muet ; en cours : ne lève pas ; annulé : ignoré ; aucun run : muet ; `gh` en panne : alerte ; appels `gh` en lecture seule uniquement (`run list|view`), rail seul visé ; permissions du workflow exactement `contents: read` + `actions: read`, aucun droit d'écriture.
- Épreuve de morsure : 5 mutants du script, tous détectés.
- `test_vigie_cloture_ci_20261020.js` (V5) adapté volontairement à la permission accordée : elle n'accepte que ces deux lectures et `github.token`.
- Guardian QA : 355 épreuves, 0 finding. Tests CI du rail : succès sur `6a882c8f`.

## Limites
Pas de preuve en conditions réelles avant la fusion de #154 : le premier cron après fusion est la seule épreuve réelle. Aucune écriture Production, aucune fusion sans GO.

## À arbitrer
1. Approuver le lot.
2. Exécutant à désigner pour la suite (fusion de #154 sur GO de Frédéric).
