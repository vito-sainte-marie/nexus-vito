---
name: nexus-design-experience
description: Référentiel obligatoire de conception NEXUS (v1.0). À charger avant de créer ou de modifier une page, un écran, une carte ou un composant d'interface NEXUS (HTML, CSS, rendu JS), et avant de rédiger le compte rendu d'un lot qui touche l'interface.
---

# NEXUS : conception et expérience (v1.0)

Référence complète : docs/conception/NEXUS-REFERENTIEL-CONCEPTION.md. Références visuelles : NEXUS-Tempo-v2.html, puis NEXUS-Paye-v1.html.

## Avant de coder
- Lot significatif (page, espace, carte, structure A-E) : publier sur #160 la fiche de conception du référentiel (section 7), en citant "NEXUS-REFERENTIEL-CONCEPTION v1.0", et attendre la revue de Guardian.
- Lot mineur (libellé, couleur d'état, alignement, correction de recette) : pas de fiche ; citer la règle appliquée dans la PR.

## Concevoir
- Canevas A identité, B synthèse, C Conseiller, D navigation et actions, E détails et preuves. Garder seulement les blocs utiles : employé = action, manager = contrôles, gérant = résultats et décisions.
- Premier écran à 375 x 812 et 1280 x 800 : fonction, situation principale et action visibles sans défiler. Sous-page : identité compacte.
- Un seul niveau de chevron. Un tableau seulement s'il est l'outil de travail.

## Charte
- nexus-theme.js dans le head ; jetons --t-* pour l'environnement ; aucune couleur en dur ; Jour et Nuit.
- États métier : nexus-badge-etat.js. Gravité, activité et action restent distinctes. Aucun emoji d'état ; le sens toujours écrit.
- IBM Plex Sans et Plex Mono. Rayons : 12 px cartes, 8 px boutons et badges, sauf exceptions justifiées.
- Icônes : nexus-icones.js et assets/icones ; icône manquante = la demander sur #160.
- Conseiller : avatar officiel, nexus-vocabulaire.js, Constitution art. 12 ; aucune tendance, urgence ou causalité inventée.
- Une carte = une question ; chiffre principal en Plex Mono avec unité ; jamais de total de grandeurs différentes.
- Liste > 10 lignes : recherche, tri, filtres, 10 premières visibles.
- Aucun bouton sans destination réelle ; aucune donnée supprimée, elle descend au niveau 3.
- Lot de présentation : aucun calcul, droit ou isolation multisite modifié.

## Avant d'annoncer une tête
- Tests de non-régression des valeurs affichées et de chaque cible cliquable.
- Rapport de test_charte_interface.js joint (bloquant seulement pour les pages listées).
- Compte rendu : référentiel et version, composants réutilisés, composants nouveaux, exceptions et leur raison, états gérés.
- La recette visuelle et cognitive (captures, test de compréhension) revient à Guardian. Une CI verte ne valide pas une interface.
