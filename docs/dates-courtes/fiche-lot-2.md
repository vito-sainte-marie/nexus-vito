# Fiche lot 2 : parcours mobile

Statut : documentation. Application de NEXUS-REFERENTIEL-CONCEPTION v1.0 (fiche de la section 7, 11 points). Aucun code.

## 1. Objectif

Un employé circule librement, relève un produit en quelques gestes, d'une main, sur iPhone Safari : scanner ou chercher, saisir DLC et quantité, enregistrer, continuer.

## 2. Parcours

1. Ouvrir le relevé (aucune zone à choisir).
2. Scanner l'EAN (caméra), ou chercher par nom ou EAN, ou saisir l'EAN à la main si la lecture échoue.
3. Saisir la DLC puis la quantité.
4. Enregistrer. L'écran revient prêt pour le produit suivant.
5. Accès rapide aux produits déjà relevés et aux corrections.

Produit sans EAN : recherche rapide par nom à une main, suggestions dès les premières lettres, les produits sans EAN déjà relevés dans la station proposés en premier. EAN inconnu : entrée provisoire marquée, sans création de référence.

Photo facultative, jamais bloquante.

## 3. Fiche de conception (section 7 du référentiel)

Les 11 points sont à remplir à la conception détaillée, avant tout code. État de cette fiche :

| # | Point | État |
|---|---|---|
| 1 | Tâche principale de l'écran | Relever un produit : scanner ou chercher, DLC, quantité, enregistrer |
| 2 | Qui, où, avec quoi | Renfort ou manager, en magasin, iPhone une main |
| 3 | Niveau de conception (1 à 3) | Niveau 3 proposé (parcours de saisie répété, écran inédit) à confirmer par Guardian |
| 4 | Canevas (A à E) | À choisir à la conception : saisie rapide, plutôt canevas de saisie |
| 5 | Hiérarchie : une action principale | Enregistrer ; actions secondaires : corriger, photo |
| 6 | États (vide, chargement, refus, hors ligne) | Enregistré, En attente, Refusé, visibles sur chaque ligne |
| 7 | Textes (sans tiret, vocabulaire du lexique) | À rédiger ; « quantité relevée », jamais « stock » |
| 8 | Cibles tactiles 44 px, une main | À mesurer sur maquette |
| 9 | Jour et Nuit | Maquettes des deux obligatoires |
| 10 | Test de compréhension de Guardian | À planifier sur la maquette |
| 11 | Recette Safari iOS réelle | À faire sur un appareil réel, sinon marquée « non fait » |

Aucune icône dessinée par l'assistant : les icônes viennent du pilote.

## 4. Livrables du lot

- Maquettes Jour et Nuit, largeur iPhone.
- Démo du parcours (enchaînement des écrans).
- Captures à largeur iPhone.
- Recette de scan réel sur Safari iOS.

## 5. Critères mesurables

- Un relevé complet (scan, DLC, quantité, enregistrement) en au plus 4 gestes après le scan, mesuré sur parcours chronométré.
- Aucune cible tactile sous 44 px, aucun débordement horizontal à 375 px.
- Les trois états de synchronisation visibles sur chaque ligne.
- Scan réel Safari iOS, y compris EAN à 90 degrés : réussi ou marqué « non fait ».

## 6. Limites

- Détecteur natif de codes non disponible partout sur Safari iOS : ZXing figé est le repli, à vérifier par la recette sur appareil réel.
- Niveau de conception et canevas proposés, non arbitrés.
