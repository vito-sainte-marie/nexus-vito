<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=13a4e56
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 146-fichiers
  - id: registre-production
    classe: VERIFIED
    valeur: 310
  - id: migration-220000
    classe: VERIFIED
    valeur: neuf-md5-egaux-a-test
  - id: code-deploye
    classe: VERIFIED
    valeur: main-production-13a4e56
---
## Objet

Compte rendu de la migration Production `20261011220000`, appliquée le 12/10/2026 sur GO de Frédéric (« go 220000 », reconfirmé après le déploiement de #102, main/production à `13a4e56`). Cette demande rend la décision matérialisable : decision-3 en est la réponse.

## Fait

- Préflight rejoué juste avant d'écrire : registre 309, version absente, trois aides absentes, six md5 attendus.
- Application par `execute_sql`, une transaction gardée, avec la ligne de registre. Garde passée, aucune exception.
- Constat en lecture seule : registre 310, dernière version `20261011220000` ; neuf md5 identiques à Test ; trois aides `service_role` seul ; six commandes `authenticated` + `service_role` ; `SECURITY DEFINER`, `search_path=""` ; quarts `a646dfd7` et `64138d8c` toujours en brouillon ; aucune ligne `confirmation_stock_final_zero` / `stock_final_zero_automatique`.

## Demandé

Matérialiser le GO déjà donné par Frédéric pour la seule migration `20261011220000`. Aucun autre GO n'est demandé ici.

## Non demandé

Recette Production, régularisation de `539e87bc`, retour arrière.
