---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 6
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-6.md
---
# Décision — `request-6.md` : geste 1 (12 migrations Production) approuvé

## Verdict

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO decision-6 : migrations Production

## Ce que la décision autorise

Le **geste 1 seulement** de `docs/deploiement/procedure-fdj-62-production.md`, au SHA candidat `f3e128e3e95b848150f43c5415697d3637c9ea64` :

- appliquer en Production (projet `uzhjpqpctpvxytxpxoqz`) les 12 migrations `20260916220000` → `20260916221100`, dans l'ordre du §3, chacune à l'octet près du fichier au SHA candidat ;
- les lectures seules AVANT et APRÈS du §3.

Si `origin/rebuild/fdj-62-20260922` ne vaut plus `f3e128e` au moment d'écrire, l'autorisation tombe.

## Ce qu'elle n'autorise pas

- `20261004120000` (geste 4) : GO séparé.
- La fusion de la PR #73 vers `production` (geste 2) : GO séparé.
- Le déploiement GitHub Pages (geste 3) : GO séparé.
- Aucune application ni modification de la Phase C, aucun élargissement de `nexus_ci_recette`.

## Suite

Le résultat sera rapporté par `request-7.md`.
