<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CARBURANTS-VISUEL-1-20261014/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CARBURANTS-VISUEL-1-20261014
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
---
# NEXUS-CARBURANTS-VISUEL-1 — recette Test authentifiée (request-3)

Exécution de la condition de decision-2 sur NEXUS Test (rail `handoff-continuite-20260920`, déploiement `handoff-continuite-20260920.nexus-test-ddf.pages.dev`), session connectée, données de Test présentes (relevé du jour déjà enregistré). Statut : **validé sur Test (recette visuelle)**, non déployé en Production, `main` intact.

## Preuve des conditions de decision-2
- **Recette authentifiée avec données** : page « Relevé du jour » rendue avec jaugeage SP95 3200 L, trois cartes, champs jaugeage / livraison / mouvement.
- **Distinction SP95 / Gasoil / GNR** : bordures mesurées au navigateur `rgba(22,167,101,.45)` (SP95), `rgba(232,183,70,.45)` (GO), `rgba(228,91,96,.45)` (GNR) ; variable `--carb-rgb` propre à chaque carte.
- **1280 px, 820 px, 390 px** : trois cartes, largeur 418 / 418 / 348 px, aucun débordement horizontal (`scrollWidth` ≤ `clientWidth` par carte, aucun débordement du document). La carte est plafonnée à 418 px sur bureau et tablette.
- **Absence de régression** : libellés, champs (3 / 4 / 3 entrées), bandeaux « ventes » et lien Verify inchangés ; aucune erreur de rendu. Aucune saisie ni enregistrement effectué sur Test.
- **Captures** : `captures/test-mobile-sp95.jpg`, `captures/test-bureau-sp95.jpg` (la vue étroite est celle du volet navigateur, 344 px). Les rendus 820 et 390 px sont attestés par les mesures ci-dessus, non capturés en image.

## Limites
Recette visuelle seulement : pas de test d'enregistrement, car le périmètre interdit toute modification de logique. Capture « avant » sur données Test non refaite.

## Demandé à l'arbitre
Clore le lot (`CLOSES: true`). Aucun accès Production, fusion ou déploiement demandé.
