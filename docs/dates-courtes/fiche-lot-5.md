# Fiche lot 5 : valeur à risque et pertes constatées

Statut : conception. Voir `prevention-pertes.md` §5, §9 et §11.

## 1. Objectif
Carte A (valeur à risque) et carte B (pertes constatées) dans Produits, Mes dates courtes, Prévention des pertes. Quantité retenue pour A : 7 jours ou moins ; 8 à 14 jours à part, « indicatives » ; plus de 14 jours exclus et gardés en « À recontrôler ».

## 2. Dépendances
Lot 1 seul pour les données. Prix d'achat HT lu dans `products` ou `inventaire_ventes_import`. Question posée dans #352 sur la quantité, la date et l'auteur de la démarque comptabilisée.

## 3. Fiche de conception
Référentiel : NEXUS-REFERENTIEL-CONCEPTION v1.0. Utilisateur : manager, gérant, créateur. Besoin : savoir ce que je risque de perdre et ce que j'ai déjà perdu. Trois informations : valeur à risque, pertes constatées, produits sans prix d'achat. Canevas A, B (deux cartes, une par montant), D, E. Montants en IBM Plex Mono avec unité ; bouton (i) sur le calcul, les anciennes quantités et les données indisponibles. États : chargement, aucune donnée, erreur, « Calcul indisponible ». Jour et Nuit, 375×812 et 1280×800.

## 4. Critères
Cas P1, P2, P3, P4, P5, P8, P10.

## 5. Limites
Aucun total de montants différents. Aucune lecture de ventes. Rien sur Test.
