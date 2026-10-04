---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-ANON5-20261004
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-2.md
---
# decision-2 — GO fusion anon5 (geste 2 seulement)

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO fusion anon5 au SHA 7b96872

## Ce que la décision autorise

Le **geste 2 seulement** du §6 de `request-2.md` : fusionner `claude/securite-anon-5-fonctions-20261004` (`7b96872aef5f3de00949cdb56b0340721104a5ad`) vers `production` par PR, une fois les deux checks requis verts, sans force ni skip.

Si `origin/claude/securite-anon-5-fonctions-20261004` ne vaut plus `7b96872` au moment de fusionner, l'autorisation tombe.

## Ce qu'elle n'autorise pas

- L'approbation de la gate GitHub Pages, si la fusion la déclenche : GO séparé.
- Toute écriture en Production.
- La résolution de conflits, ou tout candidat autre que 7b96872 : un autre SHA exige un autre GO.

## Suite

Le résultat sera rapporté par `request-3.md`.
