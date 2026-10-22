<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=2c7435bd
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 161-fichiers
---
# PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022 : six correctifs issus de la recette navigateur du 22/10

*Déposé sur instruction de Frédéric (22/10/2026). `lot_actif` vérifié avant dépôt : OUTILLAGE-PRISE-EN-CHARGE-20261022 est à l'état DECISION_CONSOMMEE (action prouvée par 3a85137c), aucun lot en statut actif, règle D3 respectée. Aucun code n'est écrit avant la décision.*

## Source des constats

Recette navigateur du 22/10 à 18:20 sur `production.nexus-test-ddf.pages.dev` (`2c7435b`, tête de `production` au dépôt) avec Employé Test B, et lecture seule en Production avec le compte de Dylan (constat déclaré par Frédéric ; je n'ai pas rejoué cette recette). Seules les lignes de code citées ci-dessous ont été relues par moi sur `origin/production`.

## Les six correctifs demandés

1. **Filtre des catégories du fil.** `nexus-fil-debut-quart.js` ligne 23 : `CATEGORIES_FIL = /gaz|gla[cç]on|glace|[ée]caille/i`. Le motif `glace` attrape « Lave-glace » (lu dans le code). Ne retenir que Gaz, Glaçons et Écailles, sur le mot entier. Épreuve avec « Lave-glace & Liquide de refroidissement » et « Huiles », qui doivent être exclues, et mutation qui la fait rougir si le motif redevient une sous-chaîne.
2. **Fenêtres `confirm()` de l'inventaire.** Dans le fil, les remplacer par une confirmation dans la page, ou les supprimer quand le bouton dit déjà « conforme ». Corriger l'accord de « les 1 produit ». (Une alerte native est invisible au DOM : l'épreuve doit viser la confirmation dans la page.)
3. **Accueil après l'inventaire d'ouverture.** Distinguer « ouverture faite » et « clôture à faire en fin de quart ». Ne pas réafficher « n'a pas encore été fait » juste après l'ouverture.
4. **Un seul compteur d'étapes** à l'écran pendant le fil.
5. **Jaugeage reconnu par l'Accueil.** Constat de code : `statutJaugeageJour` vient de `chargerStatutJaugeageJour` (`nexus-carburant-donnees.js:782`), qui lit la vue/table `carburant_jaugeage_statuts_jour`, alors que l'écran de jaugeage lit `carburant_releves` (déclaré, à confirmer à l'implémentation). L'Accueil et l'écran doivent lire la même source. Un relevé du jour saisi par le manager compte comme fait.
6. **Écran de jaugeage.** Afficher « Un jaugeage existe déjà pour aujourd'hui » dès l'ouverture, pas seulement quand les 4 champs sont remplis.

## Limites

Aucune écriture en Production, aucun déploiement, aucune fusion sans GO de Frédéric. Aucune migration prévue ; si le correctif 5 en exige une (vue de statut), elle fera l'objet d'une request séparée. Périmètre : fil pompiste, Accueil, écran de jaugeage, avec leurs épreuves.

## À arbitrer

1. Approuver les six correctifs.
2. Pour le 5 : la source commune est-elle `carburant_releves` (l'Accueil relit les relevés) ou la vue de statut (l'écran de jaugeage la relit) ? Je recommande `carburant_releves`, qui est la donnée saisie, la vue étant dérivée.
3. Exécutant à désigner (la règle provisoire interdit à Claude de prendre en charge un exécutant `github-actions-claude` sans demande explicite de Frédéric).
