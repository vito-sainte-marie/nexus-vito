---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-ANON5-20261004
seq: 1
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED
closes: false
in_reply_to: request-1.md
---
# decision-1 — GO migration Production anon5 (geste 1 seulement)

`APPROVED`, `closes: false`.

Frédéric Bragance a rendu cet arbitrage en session, le 04/10/2026. Verbatim :

> GO migration Production anon5 au SHA 7b96872

## Ce que la décision autorise

Le **geste 1 seulement** du §10 de `request-1.md`, au SHA candidat `7b96872aef5f3de00949cdb56b0340721104a5ad` :

- appliquer en Production (projet `uzhjpqpctpvxytxpxoqz`) `supabase/migrations/20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql`, à l'octet près du fichier au SHA candidat (sha256 `43489265936d14bcc06b4804d31f8e511505605d296c694bd39b70d8e74730b1`), en une seule transaction avec son estampille ;
- les lectures seules AVANT et APRÈS ;
- les contrôles par rôle C01 à C05 et C12, sous `begin` … `rollback`.

Si `origin/claude/securite-anon-5-fonctions-20261004` ne vaut plus `7b96872` au moment d'écrire, l'autorisation tombe.

## Ce qu'elle n'autorise pas

- La fusion vers `production` (geste 2) : GO séparé.
- Le déploiement GitHub Pages (geste 3, non applicable au sens servi) : GO séparé si la fusion déclenche la gate.
- Aucune modification de `nexus_identifiant_de_connexion`, ni de `run_scheduled_inventory_reviews`, aucun élargissement de `nexus_ci_recette`.

## Suite

Le résultat sera rapporté par `request-2.md`.
