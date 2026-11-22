# Compte rendu : bannière Dates courtes dans les maquettes lots 2 et 5

- Référentiel : NEXUS-REFERENTIEL-CONCEPTION v1.0 (skill nexus-design-experience).
- Composants réutilisés : en-tête `header.header.hero` de NEXUS-Produits-v1.html (picture, source téléphone 599 px, img.entete 800w/1200w/1600w, `sizes`, 1600x533, alt vide car décorative), eyebrow, thème jour/nuit existant.
- Composant nouveau : aucun côté produit. CSS d'en-tête ajouté à `maquettes.css` seulement (maquettes).
- Fichiers : `assets/dates-courtes/dates-courtes-banniere-{800,1200,1600}.webp`, `assets/telephone/dates-courtes-telephone.webp`. Seules les deux maquettes `lot-2-saisie.html` et `lot-5-prevention-pertes.html` et `maquettes.css` sont modifiées.
- Cadrage : `--banniere-cadrage: 60% 50%`. À 375 la source téléphone est servie (vérifié), le scanner reste visible ; le pot « DLC » est visible mais en partie sous le titre.
- Exceptions (couleurs littérales, reprises de Produits, avec raison) : `#0D202E` (fond de repli avant chargement de l'image) et `#EDF1F5` (texte clair posé sur l'image, identique en Jour et Nuit car le fond est un dégradé sombre) ; dégradés en rgba littéraux. Le point « nexus-theme.js ABSENT » sur `maquettes.js` est sans objet (fichier JS, pas une page).
- États traités : thème Jour et Nuit, 375 et 1280, sans débordement horizontal ; titre lisible dans les deux modes (dégradé renforcé à 375).
- Lot 5 inchangé sur le fond : certification, « Partiellement reconstitué », « Décider une action » désactivée (lot 6). Rien sur Test ni Production.
