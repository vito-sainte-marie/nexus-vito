# Compte rendu : bannière Dates courtes dans les maquettes lots 2 et 5

Correction 7081520147 : la bannière est en haut de chaque cadre d'écran (375 et 1280, lots 2 et 5), à la place du bloc identité (tuile « icône à venir » et titre) ; le bandeau de la page ne garde que son titre de document. Lot 2 à 375 : « Saisies de ma tournée » passe en lignes empilées (produit et date, puis quantité et état, puis raison), sans tableau horizontal, badges non rognés ; le tableau reste à 1280.

Correction 7081667134 : l'image entière est visible dans son cadre. Cadre `aspect-ratio: 2/1` jusqu'à 599 px et `3/1` au-delà, sans `min-height`, `object-fit: contain`, sans `--banniere-cadrage`. Dégradé plus court (0,85 en bas, transparent à 60 % de la hauteur). Rapport largeur sur hauteur mesuré : 2,00 à 375 (source téléphone 960x480) et 3,00 à 1280 (source 1200), sur toutes les bannières des lots 2 et 5, sans bande vide. Titre lisible en Jour et Nuit.

- Référentiel : NEXUS-REFERENTIEL-CONCEPTION v1.0 (skill nexus-design-experience).
- Composants réutilisés : en-tête `header.header.hero` de NEXUS-Produits-v1.html (picture, source téléphone 599 px, img.entete 800w/1200w/1600w, `sizes`, 1600x533, alt vide car décorative), eyebrow, thème jour/nuit existant.
- Composant nouveau : aucun côté produit. CSS d'en-tête ajouté à `maquettes.css` seulement (maquettes).
- Fichiers : `assets/dates-courtes/dates-courtes-banniere-{800,1200,1600}.webp`, `assets/telephone/dates-courtes-telephone.webp`. Seules les deux maquettes `lot-2-saisie.html` et `lot-5-prevention-pertes.html` et `maquettes.css` sont modifiées.
- Cadrage : image entière (`object-fit: contain`), plus de recadrage. À 375 la source téléphone est servie (vérifié).
- Exceptions (couleurs littérales, reprises de Produits, avec raison) : `#0D202E` (fond de repli avant chargement de l'image) et `#EDF1F5` (texte clair posé sur l'image, identique en Jour et Nuit car le fond est un dégradé sombre) ; dégradés en rgba littéraux. Le point « nexus-theme.js ABSENT » sur `maquettes.js` est sans objet (fichier JS, pas une page).
- États traités : thème Jour et Nuit, 375 et 1280, sans débordement horizontal ; titre lisible dans les deux modes (dégradé renforcé à 375).
- Lot 5 inchangé sur le fond : certification, « Partiellement reconstitué », « Décider une action » désactivée (lot 6). Rien sur Test ni Production.

Correction 7082372497 (icône validée) : la tuile « icône à venir » n'est plus utilisée dans aucune maquette depuis la bannière (7081520147) ; sa règle `.tuile` de `maquettes.css` était du CSS mort et est retirée. L'icône validée `mod-dates-courtes` (sources du pilote, 7070103022) est intégrée telle quelle, sans redessin : dossier `assets/icones/v2/mod-dates-courtes/` (SVG, -24, PNG, WebP @1x/@2x/@3x) et entrée dans `nexus-icones.js`, identiques à celles du lot 5 (#354). Aucun écran des maquettes ne change : les huit captures restent valables.
