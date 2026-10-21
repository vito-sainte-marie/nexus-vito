<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-PHOTO-20261021/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-PHOTO-20261021
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=cdfee414
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 159-fichiers
---
# Demande de clôture — JAUGEAGE-PHOTO-20261021 (request-4, compléments de recette iPhone Test)

## Preuve des conditions de decision-1

Les preuves de request-2 et request-3 restent valides (PR #144 fusionnée `cdfee414bf76165f7054020c8549bcd4853e0761`, déploiement manuel 39622404453, repli natif OK, restauration d'état OK, dimensions 480 × 640 avant et 1080 × 1920 après correction). Cette demande répond au BLOCKER de decision-3 (NEEDS_EVIDENCE) : les deux contrôles iPhone Test manquants.

## Contrôles demandés par decision-3, constatés par Frédéric

Frédéric a confirmé en session, point par point, après qu'on lui a demandé de préciser ce qu'il avait constaté :

1. **Lien profond après connexion** — OK : le lien s'ouvre, passe par la connexion, puis arrive sur l'écran visé. Constat de Frédéric sur iPhone, aperçu Test.
2. **Lisibilité d'une photo de l'écran Veeder-Root** — OK : photo de l'écran Veeder-Root prise avec la caméra en page sur l'aperçu Test, chiffres lisibles. Constat de Frédéric à l'œil.
3. **Correction de résolution** (`lot-camera-resolution-20261021`, commit `33fb3e13`, résolution idéale 1920 × 1080) — constatée sur l'aperçu Test par Frédéric.

## Limites, dites sans fard

- Le détail du point 1 (écran d'arrivée exact) n'a pas été décrit au-delà de « OK » ; c'est le constat de Frédéric, non une capture.
- Pour le point 2, les dimensions en pixels de cette photo de l'écran Veeder-Root ne sont **pas mesurées** : le fichier n'a pas été téléchargé. Seule la photo d'essai de 1080 × 1920 (terrasse) est mesurée. La lisibilité est un constat visuel, pas une lecture OCR.
- La correction de résolution n'est **pas en Production** : aucune PR vers `production`. Sa promotion relève de `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` et du GO explicite de Frédéric, ultérieurement. Essai Production non fait. Worker OCR (HEIC / orientation) hors lot.
- decision-1 reste non consommée par preuve d'action (commits du lot sur `main`, hors historique du rail) ; prise en charge posée.

## Demande

Dire si ces preuves suffisent à clore JAUGEAGE-PHOTO-20261021 (la promotion en Production étant explicitement hors de cette clôture), ou nommer la preuve manquante.
