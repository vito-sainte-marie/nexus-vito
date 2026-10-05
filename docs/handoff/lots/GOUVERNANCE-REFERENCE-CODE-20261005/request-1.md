---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=c259476
  - id: diff-production-rail
    classe: VERIFIED
    valeur: 762-fichiers-115030-plus-39639-moins
  - id: migrations-rail-only
    classe: VERIFIED
    valeur: 20-migrations-absentes-de-production-confirme-par-git-diff
  - id: migrations-production-only
    classe: VERIFIED
    valeur: 2-migrations-fdj-fusionnees-hors-rail-pr75-pr76
  - id: fichiers-applicatifs-divergents
    classe: VERIFIED
    valeur: 91-ecrans-moteurs-nexus-diffs-production-vs-rail
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucune-migration-aucun-merge-aucun-deploiement
---
# request-1 — séparation des autorités : `origin/production` référence le code, le rail référence le Handoff

Ouverture du lot `GOUVERNANCE-REFERENCE-CODE-20261005`, à la demande de
ChatGPT (arbitrage posté dans l'issue #28 le 05/10/2026), après clôture de
`FDJ-CARNETS-LEDGER-AUDIT-1-20261004` (`decision-10.md`, `APPROVED_WITH_CONDITIONS`,
`closes: true`). Reprend l'option 3 déjà choisie par Frédéric.

## 0. Constat mesuré avant toute règle

Comparé `origin/production` (`c259476fa51e46f3b30fdd93918f2f78b88aec04`) à
`origin/handoff-continuite-20260920` (`3761220c5d17b2d30806de41b3b3f3b165ed690b`,
le HEAD de ce dépôt) :

- **762 fichiers diffèrent**, dont **91 fichiers applicatifs** (`NEXUS-*.html`,
  `nexus-*.js`) — écrans et moteurs, pas seulement de l'outillage Handoff.
- **`supabase/migrations/`** : **20 migrations existent sur le rail et pas en
  Production** (rail-only), et **2 migrations existent en Production et pas
  sur le rail** (`20261005090000_fdj_reconciliation_canonique_caisse.sql`,
  `20261005180000_fdj_ouverture_quart_caissiere_seule.sql` — fusionnées par
  PR #75/#76 depuis des branches basées directement sur `production`, hors
  rail).

Le rail Handoff et le code réellement servi ont donc divergé de façon
substantielle. Un lot ouvert aujourd'hui depuis le rail, sans garde,
risquerait de construire sur un écran ou un moteur que Production ne sert
plus — ou de republier par-dessus un correctif Production que le rail n'a
jamais vu.

## 1. Règle proposée (option 3 de Frédéric)

- **`origin/production`** est la référence du **code applicatif servi/exécuté** :
  écrans (`NEXUS-*.html`), moteurs (`nexus-*.js`), migrations
  (`supabase/migrations/`), tests applicatifs.
- **`handoff-continuite-20260920`** est la référence canonique du **protocole
  Handoff** : `docs/handoff/**`, `STATE.json`, les miroirs v1, `outils/handoff.js`,
  les gardes de registre.
- **Tout lot démarré depuis le rail doit déclarer**, dans son `request-N.md`
  d'ouverture : le `merge-base` exact avec `origin/production`, et la liste
  des fichiers **applicatifs** touchés par ce lot qui diffèrent entre le rail
  et `origin/production` à ce `merge-base`.
- **Liste non vide ⇒ lot refusé tel quel.** Deux issues seulement : reconstruire
  le travail du lot sur `origin/production`, ou arbitrage nominatif du fichier
  précis (fichier par fichier, jamais une levée générale).
- **Les 20 migrations rail-only restent HORS DÉCISION et non qualifiées** par
  ce lot. Ce dépôt ne les traite pas, ne les promeut pas, ne les rejette pas —
  il se limite à acter qu'elles existent et à poser la règle qui s'appliquera
  à leur sort dans un lot séparé, le jour où la question se posera.

## 2. Ce que ce lot ne fait pas

- Ne fusionne pas `production` vers le rail.
- Ne recopie pas l'applicatif Production sur le rail.
- Ne touche à aucune des 20 migrations rail-only ni aux 2 migrations
  Production-only.
- Ne modifie aucun fichier applicatif FDJ ni aucun autre fichier applicatif.
- N'écrit, ne migre, ne répare rien en Production. N'ouvre, ne fusionne, ne
  déploie rien en Production.
- Ne mute rien sur Test.

Cette règle acte une **séparation des autorités**, pas une réconciliation :
le rail garde son rôle de référence du protocole Handoff, et cesse de
prétendre arbitrer ce qu'est le code réellement servi.

## 3. Mécanique attendue (à construire dans un lot d'outillage séparé)

Non fait ici, posé pour mémoire : un contrôle outillé (`outils/handoff.js` ou
garde dédiée) qui calcule automatiquement, à l'ouverture d'un lot,
`git merge-base <rail> origin/production` et le diff applicatif correspondant,
plutôt que de laisser cette déclaration reposer sur une vérification manuelle
à chaque dépôt.

## 4. Preuves

Toutes mesurées par lecture git seule (`log`, `show`, `diff`), aucune
exécution, aucun accès Production au-delà de la lecture des refs déjà
présentes dans ce dépôt.

**STOP. Aucun autre geste avant arbitrage.**
