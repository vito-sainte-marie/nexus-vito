# NEXUS — Instructions Claude

Avant tout nouveau lot de travail sur NEXUS, lire et appliquer `docs/handoff/PROTOCOL.md`.

À la fin de tout lot nécessitant arbitrage de ChatGPT :

1. Mettre à jour `docs/handoff/CURRENT.md` avec un `LOT_ID` unique, le statut, le constat, les modifications ou propositions, les preuves, les risques et les questions d'arbitrage.
2. Pousser ce fichier sur la branche de travail autorisée.
3. Ne pas poursuivre le lot suivant tant que `docs/handoff/DECISION.md` ne contient pas une décision portant exactement le même `LOT_ID`.
4. Lire cette décision avant de reprendre.

Interdictions permanentes :
- aucune modification de `main` ou `production` sans autorisation humaine explicite ;
- aucune décision de recette ne vaut autorisation de production ;
- ne jamais contourner les gates sécurité, intégrité, isolation Test/Production ou validation humaine définies par NEXUS.

GitHub est le canal de handoff entre Claude et ChatGPT.
