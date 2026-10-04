<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-VAGUE1-REPRISE-20261003/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FDJ-VAGUE1-REPRISE-20261003
seq: 2
author: Frédéric Bragance
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision — `request-2.md` : option A retenue, strictement sur `nexus-test`

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Arbitrage de Frédéric Bragance, donné le 04/10/2026, en réponse à l'arbitrage demandé au §3 de
`request-2.md` :

> Je choisis l'option A recommandée, strictement sur nexus-test.

## Ce qui est autorisé

Appliquer **durablement** sur `nexus-test` les 12 migrations `20260916220000` →
`20260916221100` correspondant au candidat qualifié `9ffee7e`, dans une transaction unique,
puis exécuter la recette FDJ Cas 1 à 5 (§ « Critères de recette Test précis et causalement
bornés » de `request-1.md`) sur l'alias Test associé à ce candidat.

## Conditions obligatoires, cumulatives

1. Aucune écriture, migration, fusion ou déploiement Production.
2. Aucune modification de données FDJ réelles Production.
3. Vérifier, avant toute écriture, que la cible est bien le projet `nexus-test`
   (`udljdqxerrbbbajxubfn`) attendu. STOP si l'identité du projet est ambiguë.
4. Consigner explicitement, dans le compte rendu, la divergence temporaire Test/rail
   introduite par ces 12 migrations (déjà nommée au §2.1 de `request-2.md`).
5. Ne pas inventer de rollback inverse. Si l'application des 12 migrations échoue en cours de
   transaction, STOP avec la preuve exacte de l'échec (migration en cause, message d'erreur) —
   la transaction unique garantit qu'aucun état partiel ne reste si elle échoue.
6. Après application, mesurer `schema_migrations` et prouver que les 12 versions
   `20260916220000` à `20260916221100` y sont présentes (requête exacte, résultat exact).
7. Exécuter les Cas 1 à 5 demandés par le lot (`request-1.md`) et rapporter chaque résultat,
   les erreurs console/réseau pertinentes rencontrées, et tout défaut P0/P1 constaté.
8. Requalifier uniquement les contrôles affectés causalement par ce geste ; ne pas rejouer
   inutilement les preuves déjà acquises (geste 1 et geste 3 de `decision-1.md`, déjà mesurés
   et rapportés par `request-2.md`).
9. Si la recette est verte et qu'aucun P0/P1 causal ne subsiste, revenir par le prochain
   `request-N.md` canonique avec les preuves et la proposition de suite. STOP avant toute
   question de Production : cette décision n'autorise aucune fusion de #62 ni de son
   successeur, aucun déploiement, et aucune promotion Production. Ces gates restent distinctes
   et explicites, comme le pose déjà `decision-1.md`.

## Ce que cette décision ne change pas

Les six écarts `a_regulariser` terrain observés au geste 3 de `request-2.md` (dont les cinq
nouveaux apparus depuis le dossier du 17/09) ne doivent **pas** être corrigés dans ce lot — ce
sont des écarts réels du terrain, à traiter par un manager, hors du périmètre technique de
`FDJ-VAGUE1-REPRISE-20261003`.

Les interdits permanents de `decision-1.md` restent entiers : aucun droit sur un site réel,
aucun élargissement général de `nexus_ci_recette`, aucun force ni skip, aucune
reclassification d'un nouveau rouge en dette connue.

## Suite

Le lot reste ouvert : la suite attendue est le compte rendu mesuré du geste A (application des
12 migrations et recette Cas 1 à 5).
