---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 10
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-10.md
---
# Décision — clôture du lot, les quatre gestes ont reçu leur GO séparé

`APPROVED_WITH_CONDITIONS`, `closes: true`, en réponse à `request-10.md`.

ChatGPT a rendu cet arbitrage le 05/10/2026, après lecture de `request-10.md`,
du constat de clôture et revalidation de l'état réel du registre (lot actif
FDJ attendu, `request-10.md` active, rail `handoff-continuite-20260920` à
`3761220`, `production` à `c259476` — aucune divergence incompatible trouvée).

## Ce que la décision prend acte

- Les quatre gestes demandés au §8 de `request-10.md` ont reçu leurs GO
  séparés : migration Test, migration Production, fusion, déploiement.
- Le candidat a bougé **`3822649` → `4d59e34`** avant la fusion
  (`qualification : 20261005090000 deja appliquee en Production (garde #70)`,
  commit de qualification posé par Frédéric sur la branche). Un nouveau GO
  explicite a été rendu sur ce SHA déplacé — le GO initial sur `3822649`
  ne valait plus, conformément à la règle posée par `request-10.md` elle-même
  (« Chacun est indépendant. Si le SHA bouge, le GO tombe »).
- La fusion a eu lieu par la PR #75 (`77cca9d`), et `production` porte
  désormais la migration `20261005090000_fdj_reconciliation_canonique_caisse.sql`.
- La recette navigateur Test B/C/M (§7.1 de `request-10.md`) n'a pas été
  faite, parce que **Test ne servait pas le candidat** au moment du geste.
  C'est une limite acceptée et documentée, pas une preuve manquante niée.

## Ce qui ferme, et ce qui ne ferme pas

Ce lot se clôt. Clore ne signifie **pas** que les besoins FDJ restants sont
abandonnés ou résolus : ils sortent du lot et redeviennent dette/suite
explicite, non close par ce verdict :

a. **« Vérifié » à trois états** (détectée / examinée / réellement résolue).
   Seule la séparation `vue` ≠ `resolue_automatiquement` existe aujourd'hui —
   le panneau à trois états n'est pas construit.
b. **Renommage des libellés de jeux** avec une identité technique stable,
   distincte du libellé affiché.
c. **« Théo. Caisse »** affiche aujourd'hui les carnets confiés sans déduire
   les activations — à corriger dans un lot causal dédié.
d. **Observation en lecture seule du premier vrai chemin de réconciliation
   automatique Production.** Le constat mesure encore **0** mouvement
   `source = 'reconciliation_automatique'` en Production. Cette observation
   reste à faire après le premier mouvement réel ; si elle révèle un défaut,
   un nouveau lot causal s'ouvre — aucun de ces quatre points n'est déclaré
   résolu par cette clôture.

## Ce que cette décision n'autorise pas

Aucune nouvelle écriture, migration ou réparation Production ; aucune
fusion ou déploiement Production supplémentaire ; aucune mutation Test ;
aucune modification applicative FDJ. Ces quatre interdictions valent pour
la suite de ce rail, pas seulement pour ce lot.

## Prochain geste autorisé

Le lot `FDJ-CARNETS-LEDGER-AUDIT-1-20261004` est clos (`closes: true`). La
suite immédiate autorisée est le dépôt de `request-1.md` du lot
`GOUVERNANCE-REFERENCE-CODE-20261005`, correspondant à l'option 3 choisie
par Frédéric (séparation des autorités rail/production), puis **STOP** en
attente d'arbitrage sur cette nouvelle demande.
