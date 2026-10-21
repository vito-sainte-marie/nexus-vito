<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-PHOTO-20261021/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-PHOTO-20261021
seq: 3
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
# Demande de clôture — JAUGEAGE-PHOTO-20261021 (request-3, preuves de recette iPhone)

## Preuve des conditions de decision-1

Les preuves de request-2 restent valides (PR #144 fusionnée par Frédéric `cdfee414bf76165f7054020c8549bcd4853e0761`, déploiement manuel 39622404453, contenu servi mesuré). Cette demande répond à decision-2 (NEEDS_EVIDENCE) en consignant les quatre contrôles de recette iPhone, tels que constatés par Frédéric sur l'iPhone, sur l'aperçu Test.

## Les quatre contrôles demandés par decision-2

1. **Repli natif** — OK, constaté par Frédéric sur iPhone.
2. **Restauration d'état** — OK, constaté par Frédéric sur iPhone.
3. **Lien profond** — constaté par Frédéric : le lien s'ouvre, mais l'utilisateur repasse d'abord par l'écran de connexion. Rapporté tel quel : nous ne savons pas à ce stade s'il atterrit ensuite sur l'écran visé après connexion ; le détail n'a pas été relevé. Ce n'est pas présenté comme un succès complet.
4. **Upload redimensionné, dimensions mesurées** (fichiers téléchargés depuis Storage Test, mesurés avec `sips`) :
   - Avant correction : `…_1792593000198.jpg`, **480 × 640 px**, 95 644 octets (l'écran Veeder-Root TLS4B y est lisible à l'œil).
   - Après correction : `…_1792603048015.jpg`, **1080 × 1920 px**, 719 223 octets.
   - Constat à dire sans fard : la réduction « ≤ 2000 px / JPEG 85 % » de #144 ne fait que réduire ; le flux caméra iPhone n'avait demandé aucune résolution et sortait en 480 × 640, donc elle n'avait rien à réduire. La taille estimée « ~2000 × 1500 » de request-2 était fausse.
   - Correction : lot `lot-camera-resolution-20261021`, commit `33fb3e13`, poussé, CI verte, aperçu Test : `getUserMedia` demande `width/height: ideal 1920/1080` (jamais `exact`) ; 15 épreuves dans `test_jaugeage_photo_camera_en_page_20261021.js`. Essai iPhone sur l'aperçu : 1080 × 1920.
   - Limite : la photo d'essai de 1080 × 1920 montre une terrasse, pas l'écran Veeder-Root ; elle prouve la résolution, pas la lisibilité de l'écran pour l'OCR.

## Ce qui n'est pas fait

- La correction de résolution n'est **pas en Production** : aucune PR vers `production` n'est ouverte ; elle exige le GO explicite de Frédéric (`PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`).
- Essai iPhone en Production non fait. Worker OCR (HEIC / orientation) hors lot.
- decision-1 reste non consommée par preuve d'action (les commits du lot sont sur `main`, hors historique du rail) ; la prise en charge est posée.

## Demande

Dire si ces preuves suffisent à clore le lot JAUGEAGE-PHOTO-20261021 (le lien profond via connexion et la correction de résolution non promue étant signalés), ou nommer la preuve manquante.
