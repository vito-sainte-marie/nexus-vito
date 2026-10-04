---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-ANON5-20261004
seq: 4
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-4.md
---
# decision-4 — GO option A′ anon5 (fusion de 7b96872 dans le rail)

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO option A′ anon5

## Ce que la décision autorise

L'option A′ du §5 de `request-4.md` :

- fusionner `7b96872aef5f3de00949cdb56b0340721104a5ad` dans `handoff-continuite-20260920` par un commit de fusion (`--no-ff`), **sans conflit et sans force** ;
- pousser le rail, puis observer sa CI ;
- rendre compte par `request-5.md`, qui demandera la clôture du lot.

Le diff apporté au rail doit être celui du candidat à l'octet près (patch-id `d0b6f8db`, 4 fichiers, +293/−1). Si `origin/claude/securite-anon-5-fonctions-20261004` ne vaut plus `7b96872`, ou si la fusion produit un conflit, l'autorisation tombe.

## Ce qu'elle n'autorise pas

- Une fusion vers `production`, une écriture Production, la gate Pages.
- La résolution d'un conflit, un cherry-pick, un rebase, un force.
- Le reclassement d'un nouveau rouge de CI en dette connue.
