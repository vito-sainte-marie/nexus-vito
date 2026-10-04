---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-2.md
---
# Décision — `request-2.md` : option A approuvée

## Verdict

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 03/10/2026. Verbatim :

> GO decision-2 : option A

## Ce que l'option A autorise

1. Appliquer durablement sur nexus-test (`udljdqxerrbbbajxubfn`) les 12 migrations `20260916220000` → `20260916221100` du candidat `9ffee7e`.
   - L'application se fait en une transaction unique, et les estampilles sont inscrites dans `supabase_migrations.schema_migrations`.
2. Exécuter la recette navigateur, Cas 1 à 5 de `request-1.md`, sur l'alias `rebuild-fdj-62-20260922.nexus-test-ddf.pages.dev`.
3. Consigner la divergence Test/rail qui en résulte : Test portera 12 migrations que le rail ne porte pas encore.

## Ce qu'elle n'autorise pas

- Aucune écriture, fusion, déploiement ou migration en Production.
- Aucun élargissement de `nexus_ci_recette`.
- Aucune autre écriture sur Test que ces 12 migrations et les données de recette créées par l'écran.

## Suite

Le résultat de la recette sera rapporté par `request-3.md`.
