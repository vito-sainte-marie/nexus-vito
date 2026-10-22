# Exécution de decision-4 — capture guidée (JAUGEAGE-OCR-2-20261022)

Prise en charge : `c87c5ca2`, sur demande explicite de Frédéric (règle provisoire, 22/10/2026).
Code : branche applicative `jaug-capture-guidee`, commit `7d98a1a7`, **PR #149 en brouillon** (https://github.com/vito-sainte-marie/nexus-vito/pull/149). Ni fusion, ni écriture Production, ni mise en service.

## Preuve des conditions de decision-4
- Branche distincte du rail, PR brouillon uniquement : fait.
- Changement limité à la capture guidée du jaugeage : `nexus-capture-guidee.js` (nouveau), option `guide` de `nexus-camera-page.js`, un appel dans `NEXUS-Releves-Piste-v1.html`. Lecteur Vision et iMac non touchés.
- Comportement observable de Pointage et Relevés Piste conservé : épreuve dédiée (section « Non-régression » de `test_jaugeage_capture_guidee_20261022.js`) ; recette navigateur : l'appel sans guide n'affiche ni cadre ni nouvelle consigne et rend la photo entière 1080×1920.
- En-tête date/heure et repère 2×2 dans le recadrage : marge de 6 % ; épreuves « le recadrage contient le cadre entier », « marge haute supprimée » tuée par mutation ; repère 2×2 visible en recette.
- Proportions et seuils documentés dans l'en-tête de la source. Proportion 5:3 confirmée par **une seule** photo réelle (21/10/2026, écart 1 %), à reconfirmer sur les quinze. Seuils (netteté 500, reflet 3 %) **provisoires**, établis sur images synthétiques.
- Épreuves : 52 vérifications vertes ; 14 mutants sur 14 tués (cadrage, recadrage, qualité, non-régression). **Écart** : le module a été écrit avant l'épreuve ; la rougeur est établie par les mutants et non par un test écrit en premier.
- Délai : 20 à 27 ms (net, flou, reflet) sur le navigateur de test, format téléphone 375×812, flux simulé à partir d'une photo réelle. **Ce n'est pas une preuve iPhone.**
- Suite complète : 7 échecs, identiques à `origin/production` (préexistants) ; `npm run epingles` rouge aussi sur la base (l'identité de génération ne se mesure pas en local).

## Reste (gestes humains, dans l'ordre de decision-4)
Validation de la capture sur iPhone réel ; quinze photos sans donnée personnelle ; calibration des seuils ; étape B iMac en parallèle, avec Frédéric. Les seuils ne sont pas définitifs avant.
