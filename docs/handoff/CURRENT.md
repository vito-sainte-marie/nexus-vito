<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-REGULARISATION-20261026/request-6.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 6
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
  - id: decision-humaine
    classe: HUMAN
    valeur: Frederic-ne-cree-pas-le-secret-voie-par-convention
---
# OUTILLAGE-REGULARISATION-20261026 : request-6 — changement de voie pour l'étape 2 : la proposition A se fait par convention

BRANCHE_DU_LOT: handoff-continuite-20260920

Décision de Frédéric, en réponse au blocage de request-5 (secret `NEXUS_TEST_EMPLOYEE_AUTO_PIN`, verdict BLOCKED, issue #28 commentaire 6418030105).

## Preuve des conditions de decision-2

Inchangée : voir request-3.md et decision-3.md. Aucun fait nouveau sur les six conditions : Test seulement, Test A conservé, aucun compte Auth, ni `main` ni Production. Aucune action n'a été exécutée depuis request-5.

## Preuve des conditions de decision-4

decision-4 (BLOCKED, `STOP_REQUIRED: SECRET_PERMISSION_SURFACE_SECURITE`) subordonne la reprise à la création du secret `NEXUS_TEST_EMPLOYEE_AUTO_PIN`, et exige : Test seulement, NOM `Employé Test Auto`, jamais le secret de Test A.
- Le secret n'a pas été créé et ne le sera pas : décision de Frédéric ci-dessous (palier humain `SECRET_PERMISSION_SURFACE_SECURITE` tranché par refus).
- Aucun secret réutilisé ni fabriqué ; aucune action de câblage exécutée ; Test seulement ; rien sur `main` ni en Production.
- decision-4 n'a pas pu être consommée : `consommer --prise-en-charge` a refusé (`PROVENANCE_NON_ETABLIE`, décision ChatGPT non matérialisée par la CI, le BLOCKED ayant été reproduit par Claude). Rien n'a été contourné.

## Décision de Frédéric

Frédéric ne crée pas le secret. La connexion passe par `signInWithPassword` (NEXUS-Login-v1) : un PIN suppose donc un compte Auth, interdit par decision-3. Ce serait un nouveau compte et un nouveau secret, deux élargissements de la surface de sécurité.

La proposition A se fait **par convention** :
- Employé Test A est réservé à la recette automatique.
- Les recettes manuelles utilisent Employé Test B et Manager Test.
- Aucun compte, secret ni accès nouveau.
- « Employé Test Auto » reste en base Test sans usage (ou est désactivé par un jeu versionné).

## Conséquences demandées

1. Les conditions « trois passages verts » et « épreuve d'isolation et sa mutation » de decision-3 deviennent **sans objet** : elles supposaient le nouveau scénario sur Employé Test Auto, qui n'aura pas lieu.
2. Travail ensuite, dans le cadre du lot : promouvoir la convention dans `RULES.json`, avec une garde et sa mutation qui refusent qu'une recette manuelle documentée cite Test A. Test seulement, aucun accès à `main` ni à la Production avant PR.

## À arbitrer

1. Approuver ce changement de voie (la proposition A par convention, sans secret ni compte).
2. Déclarer sans objet les deux conditions « trois passages verts » et « épreuve d'isolation ».
3. Clore le lot sur cette base une fois la garde de convention déposée et prouvée, ou, si l'arbitre préfère, clore le lot dès cette décision et traiter la garde dans un lot suivant.
