<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/GOV-TEST-MUTATION-ROBUSTE-20261020/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: GOV-TEST-MUTATION-ROBUSTE-20261020
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=ff19b8a0 production=d3244d86
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: code-mutation
    classe: VERIFIED
    valeur: 2b3e2be2
  - id: rouge-vert
    classe: VERIFIED
    valeur: 172-puis-1477
---
# GOV-TEST-MUTATION-ROBUSTE-20261020 : request-1, arbitrage a posteriori d'un correctif de test

**Domaine :** outillage de test, aucun workflow, aucune permission, aucune donnée. **Demande :** arbitrage a posteriori (le code est déjà sur le rail).

## Constat

Le run 39496410955 (`dc0c2cbc`) a été rouge sur `test_fixtures_hors_depot_20260910.js:156` (`preuveMutation`) : fenêtre fixe de 4 s, 7 balayages seulement sur le runner, aucun ENOENT observé ; `cd9e7b5f`, même code, vert. Ce n'est pas une régression du dépôt (le fichier ne lit aucune référence distante) mais un fait d'ordonnancement : la course n'a pas eu lieu dans la fenêtre.

## Changement (`2b3e2be2`, un seul fichier de test)

`preuveMutation` boucle jusqu'à observation de l'ENOENT, plafond 30 s. Si rien n'est observé au plafond, elle écrit « mutation non observée sur ce runner », sans échec ni succès muet. Les contrôles de non-nuisance et la contre-épreuve restent inchangés. Une variable `NEXUS_FIXTURE_ECRIVAIN_INERTE` (test seulement) neutralise l'écrivain pour exercer la branche.

## Preuves

- Rouge avant : écrivain inerte + ancienne logique → ÉCHEC (172 balayages, 4000 ms).
- Vert après : normal → mutation observée, 8 vérifications ; écrivain inerte → « NON OBSERVÉ… » après 1477 balayages en 30 s, 7 vérifications, sortie 0.
- Guardian QA : 0 finding sur 353 épreuves.

## Hors périmètre

Workflows, permissions, Production, Supabase, voie B, ETAPE5 : intouchés.

## Demande à l'arbitre

Approuver et clore : DECISION APPROVED, CLOSES true, CONDITIONS aucune, STOP_REQUIRED non.
