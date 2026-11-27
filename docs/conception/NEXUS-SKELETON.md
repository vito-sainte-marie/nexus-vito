# NEXUS Skeleton : Signature, Skeleton, Pulse

Référentiel appliqué : NEXUS-REFERENTIEL-CONCEPTION v1.0

Statut : étude, conception et prototypes isolés. Aucun changement de moteur, de migration, de Production, de fusion ni de généralisation sans GO.

## Fiche de conception (gabarit section 7)

1. **Utilisateur cible.** Tout utilisateur NEXUS, au moment où une page se charge ou se rafraîchit, surtout sur mobile et réseau faible en station.
2. **Besoin principal.** Comprendre que la page arrive, sans écran vide ni saut de mise en page, et savoir quoi faire si le chargement échoue ou traîne.
3. **Trois informations à comprendre en premier.** (a) La structure de la page est déjà là. (b) Les données arrivent section par section. (c) En cas d'échec ou d'attente longue, un message dit quoi faire et propose de réessayer.
4. **Actions possibles.** Réessayer, quitter vers une page sûre après un chargement long. Aucune autre action pendant le chargement.
5. **Canevas.** Squelette fantôme : le contenu réel rendu avec les mêmes dimensions, texte rendu transparent et voile par-dessus. Aucun chiffre fictif dans le squelette.
6. **Composants réutilisés.** Jetons `--t-*`, icônes `nexus-icones.js` et `assets/icones`, avatar officiel, `nexus-badge-etat.js`.
7. **Réservé aux détails.** Comparaison A/B/C, réglages de vitesse réseau et pause d'animation : uniquement dans la galerie.
8. **Premier écran à 375 × 812 et 1280 × 800.** Présents dans la galerie, cadre mobile et cadre bureau.
9. **États.** Chargement, erreur, aucune donnée, donnée indisponible, plus l'actualisation (Pulse) qui garde les anciennes données avec un signal.
10. **Exceptions à la charte.** Aucune. Les reflets cyan se déduisent de `--t-cyan`. Le verre teinté de la direction A est la seule matière nouvelle, soumise à l'avis de Guardian.
11. **Maquette.** `docs/conception/maquettes/nexus-skeleton-galerie.html`.

## 1. Trois familles

- **Signature** : connexion et initialisation, logo NEXUS animé.
- **Skeleton** : structure de chaque page pendant le chargement.
- **Pulse** : rafraîchissement localisé (filtre, période). Les données précédentes restent affichées.

## 2. Règles de comportement

- Jamais de retard sur les données : le squelette apparaît après environ 300 ms, et reste au moins 600 ms s'il a été montré.
- Mêmes dimensions que le contenu. Transition progressive section par section.
- Aucun chiffre fictif dans le squelette. Les chiffres de la galerie sont marqués fictifs.
- Quatre états plus une sortie : seuil de chargement long (5 s), message, réessai.
- `prefers-reduced-motion` : animations remplacées par un état fixe. `aria-busy`, texte pour lecteur d'écran, contraste vérifié.

## 3. Directions artistiques

- **A, verre et lumière** : verre bleu pétrole teinté, reflets cyan discrets, bordures fines.
- **B, pulsation de lumière** : balayage lumineux lent, rythme respirant.
- **C, élégance minimale** : aplats et fondu, aucune lueur.

### Décision du 26/11/2026 (validée par le responsable)

- **Signature** : connexion et initialisation générale (logo animé, étapes réelles).
- **A (verre et lumière)** : squelettes de page.
- **B (impulsion cyan)** : chargements localisés, c'est-à-dire Pulse (filtre, période, rafraîchissement partiel).
- **C (minimal, sans mouvement)** : rendu automatique sous `prefers-reduced-motion: reduce`, pour les trois familles.

La galerie ouvre sur ce mode par défaut, « Retenue : Signature + A + B, C en mouvement réduit ». A, B et C restent sélectionnables séparément pour comparaison. Le squelette ne porte aucun statut (pas de « Contraste », « Partiel », « À vérifier »...) : formes neutres, icône réelle du secteur estompée.

## 4. Audit des mécanismes de chargement existants

- Idiomes ad hoc : `class="loading"` (85), `btn-loading-dots` (17), `chargement` (5), `photo-loading`, `loading-dots`, `plans-loading*`, `brief-loading-checklist`.
- Fichiers les plus chargés en références : FDJ-Manager 80, Inventaire 39, Parametres-Station 36, FDJ 28, Carburants-Pilotage 28, App 25, Brief 21.
- `@keyframes` dupliqués sur environ 13 pages (Brief : `nexusSpin`, `loadingDot`, `dcCheckIn` ; App : `statutPulse`, `dotsBounce`, `pulse-urgent` ; Cockpit : 4).
- `prefers-reduced-motion` géré dans quelques pages seulement (App, Campagne, Carburants-Pilotage, Dates-Courtes, Inventaire).
- Aucun composant squelette partagé, ni shimmer dans les pages principales. Le référentiel le note : « dispersé, à normaliser ».

## 5. Architecture proposée

- Une seule feuille CSS transversale `nexus-skeleton.css`, sur les jetons `--t-*` (définis par page, jour et sombre), avec trois familles (A, B, C) et des variantes par module.
- Le basculement vers C est porté par la media query `@media (prefers-reduced-motion: reduce)`, jamais par du JavaScript.
- Attributs de contrat : `data-state` sur la section (wait, loading, ready, refresh, error, empty, unavailable), `data-k` sur l'élément fantôme (txt, num, para, chart, line, ico, img, block).
- Un petit module JS facultatif porte les temporisations et la sortie longue. Sans lui, le CSS seul reste valable.
- Les pages gardent leur logique de données. Le squelette ne s'y mêle pas.

## 6. Conséquences sur la performance

- CSS seul, quelques centaines d'octets par variante, aucune image.
- Animations sur `opacity` et `transform` uniquement, arrêtées hors écran et sous `prefers-reduced-motion`.
- Le squelette ne retarde jamais les données. Il remplace des idiomes dupliqués, donc le poids global devrait baisser.

## 7. Plan de déploiement progressif

1. Direction validée le 26/11 (voir section 3).
2. Extraction de `nexus-skeleton.css` sur la branche, sans toucher aux pages.
3. Ordre des pilotes : Brief (après B0-perf-2), puis Accueil, Paye, Produits, Carburants Performance. Chaque module est un lot, une PR, un GO. Aucune intégration avant GO.
4. Retrait des idiomes dupliqués page par page.

## 8. Critères d'acceptation

- Aucun décalage de mise en page entre squelette et contenu.
- Aucun retard sur l'arrivée des données, mesuré sur Test.
- Quatre états et sortie longue vérifiés sur chaque pilote.
- Jour et nuit, 375 et 1280, sans défilement horizontal.
- `prefers-reduced-motion` respecté, `aria-busy` posé, contraste conforme à la section 6.
- Aucune couleur codée en dur.
- Validation visuelle en navigateur : la CI verte ne valide pas une interface (section 8).

## 9. Limites connues

- Le volet navigateur n'affiche qu'un instantané statique des fichiers `file://` : le défilement, les animations et le cadre mobile à taille réelle n'ont pas été vus en rendu vivant.
- La galerie n'a pas encore été vérifiée en rendu réel (le volet navigateur n'ouvre pas les fichiers locaux). Elle passe la vérification de syntaxe. Un regard visuel est à faire avant toute conclusion.
