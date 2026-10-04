<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-ANON5-20261004/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-ANON5-20261004
seq: 3
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-3.md
---
# decision-3 — GO option A anon5 (rapatriement de 7b96872 sur le rail)

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO option A anon5

## Ce que la décision autorise

L'option A du §4 de `request-3.md`, telle qu'elle est écrite :

- ne rien fusionner vers `production` ;
- rapatrier `7b96872aef5f3de00949cdb56b0340721104a5ad` sur `handoff-continuite-20260920` **par avance rapide**, au motif que « son parent est la tête du rail » ;
- puis clore le lot.

Si `origin/claude/securite-anon-5-fonctions-20261004` ne vaut plus `7b96872`, l'autorisation tombe.

## Ce qu'elle n'autorise pas

- Une fusion vers `production`, une écriture Production, la gate Pages.
- Un autre mécanisme que l'avance rapide (commit de fusion, cherry-pick, rebase), un force.

## Suite

Le résultat sera rapporté par `request-4.md`.
