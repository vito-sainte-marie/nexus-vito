# Fiche de conception : le Brief en mode Jour

Statut : brouillon pour relecture. Aucun code n'est modifié par cette fiche.
Origine : demande de Guardian (#383, commentaire 7193669302) : « Passe à la fiche de conception du Brief en mode Jour, sans code. »

## 1. Ce que « mode Jour » veut dire ici

Le mode Jour est le thème clair commun de NEXUS, posé par `nexus-theme.js` (lot MODE-JOUR-POMPISTE-20261102). Il se règle en Sombre, Jour ou Auto. En Auto, Jour va de 6 h 00 (inclus) à 18 h 00 (exclu), à l'heure de la station.

À ne pas confondre avec la fraîcheur du Brief, où `fraicheur.mode` vaut `jour`, `fallback` ou `perime`. Ce second « jour » désigne la journée de données lue. Il n'a rien à voir avec le thème et n'est pas touché.

Interprétation à confirmer par Guardian : j'ai lu la demande comme « donner au Brief le thème clair commun », parce que les captures attendues sont « mobile nuit » et « bureau nuit ». Si une autre lecture était visée, la fiche est à reprendre.

## 2. État actuel mesuré (NEXUS-Brief-v1.html, origin/production)

- Le Brief ne charge pas `nexus-theme.js`. Il est toujours Sombre.
- `theme-color` est figé à `#0B0F14`.
- Les 18 jetons de `:root` existent : fonds, textes, vert, ambre, rouge, cyan, or, polices.
- Couleurs en dur hors `:root` : 3 valeurs hexadécimales et 29 `rgba(...)` dans le CSS. Elles servent au fond du `body`, à la carte héros, à la boussole, aux pastilles de confiance, aux points de risque, aux cartes d'impact, au bouton menu et au texte `#241d0c` du bouton « valider » des décisions prioritaires.
- 36 attributs `style=`, dont 13 portent une couleur. Plusieurs lignes injectent aussi des couleurs depuis le JS (badges de gravité, alertes sonde, points d'axe).
- Le menu `☰ Menu` est un simple lien vers l'accueil. Il n'y a pas de bloc « Affichage » pour choisir le thème.

## 3. Principe retenu

Reprendre le modèle de `NEXUS-App-v1.html`, sans inventer de mécanisme.

1. Charger `nexus-theme.js` en synchrone dans le `<head>`, avant le `<style>`, pour éviter un flash de mauvais thème.
2. Garder les valeurs Sombre dans `:root`, strictement inchangées.
3. Remplacer chaque couleur en dur par un jeton. Les teintes translucides (or, cyan, vert, ambre, rouge, ombres) passent par les jetons complémentaires déjà fournis par `nexus-theme.js` (`--cyan-rgb`, `--green-rgb`, `--shadow-rgb`, `--on-cyan`, `--red-text`, `--panel-hover`, `--ghost`, `--veil`). Si un jeton manque (l'or translucide, l'ambre translucide), on l'ajoute dans `nexus-theme.js` avec ses deux valeurs, Sombre et Jour, et pas dans la page.
4. Déclarer le fuseau de la station avec `NexusTheme.definirFuseau(FUSEAU_STATION)` dès qu'il est résolu, comme le fait l'App. Tant qu'il est inconnu, l'Auto se règle sur l'heure de l'appareil, comme ailleurs.
5. Pas de nouveau panneau dans le Brief (décision de Guardian, 7193749302). Le choix d'affichage est mémorisé par `nexus-theme.js` pour tout le site : le Brief suit ce choix, et le lien « Menu » mène à l'App, où se trouve le bloc « Affichage ». Une seule place pour régler.
6. Sur grand écran, la vue bureau reste Sombre tant que personne n'a choisi autre chose. Un choix explicite l'emporte.
7. `theme-color` suit le thème, comme sur les autres pages.

Les `style=` colorés et les couleurs injectées par le JS passent aussi par des jetons (`var(--green)` etc.). Les rares couleurs calculées (points d'axe, gravité) reprennent les jetons déjà utilisés par `NexusBadgeEtat`.

## 4. Ce qu'il ne faut pas casser

- Sombre : les 18 valeurs de `:root` restent identiques à origin/production. Le rendu Sombre doit être indiscernable de l'actuel.
- Badges de gravité et de traitement (`NexusBadgeEtat`) : ils portent déjà leurs jetons. Vérifier leur lisibilité en Jour.
- Badge de fraîcheur (`fraicheur.mode`) : couleur ambre pour `perime`, atténuée sinon. Les deux doivent rester distinguables en Jour.
- Carte Connexion du Brief et alertes sonde : boutons et bordures ambre à repasser en jetons.
- Rapport PDF et exports : ils ont leur propre feuille de style et restent clairs. Ils ne dépendent pas du thème de l'écran.
- Les épreuves propres au Brief : `test_badge_etat_brief_20261109.js`, `test_brief_chargement_dynamique.js`, `test_brief_vague3_20261109.js`, `test_carburant_brief_fallback_verifie_v2248.js`, `test_carburant_brief_rapport_economie.js`, `test_connexion_carte_brief_20261126.js`.

## 5. Épreuves à prévoir (lot de code, après accord sur la fiche)

- Ajouter `NEXUS-Brief-v1.html` à la liste `PAGES` de `test_theme_jour_pages_20261102.js`. Cela impose : script avant `<style>`, jetons utilisés tous définis, chaque jeton de couleur doté d'une valeur Jour, aucune couleur en dur hors `:root`, valeurs Sombre inchangées contre origin/production.
- Contrastes texte sur fond d'au moins 4,5:1 en Jour, mesurés comme dans `test_theme_jour_contrastes_20261102.js`, sur les paires propres au Brief (pastilles de confiance, cartes d'impact, texte du bouton « valider »).
- Une épreuve sur `theme-color`. Pas d'épreuve sur un bloc « Affichage » : il n'y en a pas dans le Brief.
- Captures « mobile jour », « mobile nuit », « bureau jour », « bureau nuit », prises sur Test avec des données fictives. Aucune image contenant des données réelles ne sera publiée.

## 6. Découpage proposé

Un seul lot de code, une PR brouillon, après accord sur la fiche :
1. `nexus-theme.js` : jetons complémentaires manquants.
2. `NEXUS-Brief-v1.html` : chargement, jetons, fuseau, bloc « Affichage », `theme-color`.
3. Épreuves et captures.

Rien en Production sans GO. Aucune fusion sans GO écrit du gérant.

## 7. Réponses de Guardian (7193749302)

1. Oui : le mode Jour est le thème clair commun de `nexus-theme.js`. `fraicheur.mode` n'est pas concerné.
2. Pas de nouveau panneau dans le Brief : il suit le choix mémorisé, le réglage reste dans l'App (point 5 du §3 retiré).
3. La vue imprimée du rapport reste telle quelle.
4. Une station par session, comme dans l'App.

Le reste de la fiche est validé. Le lot de code peut suivre, en une PR brouillon, avec le rapport de `test_charte_interface.js` et les quatre captures sur Test en données fictives. Rien en Production.
