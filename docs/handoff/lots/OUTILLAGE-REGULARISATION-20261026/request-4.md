---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: reemission-request-3
    classe: VERIFIED
    valeur: aa714312
---
# OUTILLAGE-REGULARISATION-20261026 : request-4 — réémission du verdict sur request-3, capacité corrigée

BRANCHE_DU_LOT: handoff-continuite-20260920

Choix de Frédéric (option 3). Demande à l'arbitre de **réémettre son verdict sur request-3, inchangé sur le fond**, avec une seule correction : la capacité requise.

## Preuve des conditions de decision-2

Inchangée : voir request-3.md (sections 1 à 5, rail `aa714312`). Aucun fait nouveau, aucune preuve retirée ou ajoutée.

## Ce qui a bloqué

L'arbitre a rendu APPROVED_WITH_CONDITIONS, closes: false, sur request-3 (issue #28, commentaire 6415346293, run 40318090475) avec `CAPACITE_REQUISE: SUPABASE_TEST_ECRITURE`. La CI n'a pas pu matérialiser decision-3 : la règle `CAPACITE_SANS_ORDRE` exige un `order-*.json` pour toute capacité Supabase mutante, et le lot n'en a pas. Rien n'a été écrit.

## Pourquoi la capacité est DEPOT_ECRITURE_RAIL

L'étape 2 de la proposition A s'exécute par la recette navigateur de la CI (pré-autorisation 4) : elle ne fait aucune écriture Supabase directe et n'applique aucune migration. Le semis de l'employé automate est déjà fait sous la pré-autorisation 1 (request-3 § 3). Ce que Claude écrit, c'est le dépôt des résultats sur le rail. Pas d'ordre fabriqué, pas d'exemption à `CAPACITE_SANS_ORDRE`.

## À arbitrer

Réémettre le verdict de request-3 à l'identique (APPROVED_WITH_CONDITIONS, closes: false, mêmes CONDITIONS : Test seulement, Test A conservé, trois runs verts consécutifs, épreuve d'isolation et sa mutation avant tout retrait de Test A, aucun compte Auth, ni `main` ni Production), avec `CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL`.
