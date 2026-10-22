<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-SAISIE-DIRECTE-20261022/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=ccedfa83
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 160-fichiers
---
# LOT : JAUGEAGE-SAISIE-DIRECTE-20261022 — arrêt : la recette iPhone réel reste un geste humain, rien d'autre à exécuter

## Prise en charge de decision-3

decision-3 (APPROVED_WITH_CONDITIONS, closes: false, en réponse à request-3.md)
a été prise en charge sur ce rail. Son `ACTION_NEXT` est : « Matérialiser
cette décision sur le rail sans ouvrir de seconde PR. » Elle ne prescrit
aucun autre geste de code.

## État local vérifié avant tout arrêt

- `origin/lot-jaugeage-saisie-directe-20261022` est toujours à `6c20b192` —
  inchangée depuis request-2.md, aucune PR n'en a été ouverte.
- `origin/jaug-saisie-directe` (branche de la PR #148) est toujours à
  `c3eda0c2` — inchangée depuis request-3.md.
- Aucune commande `gh` ni aucun appel réseau GitHub n'a été exécuté dans
  cette session : rien n'a donc pu créer de seconde PR, par construction.
- L'outillage `gh` de cette session reste bloqué par la passerelle
  d'autorisation (« This command requires approval »), sans humain présent
  pour l'accorder dans ce réveil autonome — même capacité absente que
  request-2.md, pas une gate NEXUS. Je n'ai donc pas relu l'état GitHub
  live de #148 ; je m'appuie sur l'état local du rail ci-dessus et sur la
  provenance déjà vérifiée par decision-3 (`RAIL_LU` = `HEAD` =
  `7fd56d5f7dfd856239990ecf7aaca2c90b12a386`).

## Preuve des conditions de decision-3

1. *« La PR #148 est l'unique PR canonique du lot ; aucune PR ne doit être
   ouverte depuis `lot-jaugeage-saisie-directe-20261022`, qui reste non
   supprimée »* — SATISFAITE par inaction : aucune commande d'écriture
   GitHub n'a été exécutée, la branche existe toujours sur `origin` à
   `6c20b192`, aucune seconde PR n'a été créée.
2. *« avant toute demande de passage en Production, consigner une recette
   sur iPhone réel réalisée par un pompiste sans aide »* — NON SATISFAITE,
   et hors de portée de cette session : c'est un geste humain (un téléphone
   réel, un pompiste réel). Aucune demande de passage en Production n'est
   faite par ce réveil ; la condition reste ouverte et devra être remplie
   avant qu'une telle demande soit formulée — pas avant.
3. *« aucune fusion, aucun déploiement, aucune promotion ni mutation de
   Production n'est autorisé par cette décision »* — SATISFAITE : rien de
   tout cela n'a été tenté.

## Ce qui arrête ce réveil

Au-delà de ne pas ouvrir de seconde PR — déjà vrai par inaction —
decision-3 n'autorise ni n'exige aucun autre geste de code sur ce lot. La
seule condition encore ouverte (recette iPhone réel par un pompiste sans
aide) est un geste humain que cette session ne peut pas produire, et elle
n'est de toute façon exigée qu'au moment d'une demande de passage en
Production, qu'aucun maillon ne formule ici. Consigner cet arrêt consomme
decision-3 (GOV-009, sortie 2 : demande déposée pendant la prise en
charge).

## Restant humain, dans l'ordre

1. Recette sur iPhone réel, aperçu Test, par un pompiste sans aide,
   chronométrée de la photo à l'enregistrement — avant toute demande de
   passage en Production de PR #148.
2. Aucune fusion ni déploiement sans le GO explicite de Frédéric.

## À arbitrer

Dire si une session future doit seulement attendre ce geste humain avant
toute demande de passage en Production de PR #148, ou si autre chose est
attendu sur ce lot avant.
