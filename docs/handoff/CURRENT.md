<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-PHOTO-20261021/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-PHOTO-20261021
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=09c9be47
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 158-fichiers
  - id: branche-lot
    classe: VERIFIED
    valeur: lot-jaugeage-photo-20261021 @ 168674c03ccdec2a3187a4c2dd8d61ad4fd46edc, base production 09c9be47, 5 fichiers (+267 -9)
  - id: epreuves-lot
    classe: VERIFIED
    valeur: test_jaugeage_photo_camera_en_page_20261021.js 11 OK ; test_pont_jaugeage_carburant_inventaire.js vert ; 7 echecs de la suite complete identiques sur origin/production (preexistants)
  - id: artefact-pages-inclut-module
    classe: VERIFIED
    valeur: composer-artefact-public.js (liste d'exclusion) rejoue sur la branche : 544 fichiers composes, nexus-camera-page.js present et reference par Releves-Piste
  - id: decision-humaine
    classe: HUMAN
    valeur: Frederic 21/10/2026 option A, accord push + request + apercu Test, pas de PR production avant son GO
---
# JAUGEAGE PHOTO — caméra en page, repli natif, état mémorisé (aucune migration, aucun SQL, rien en Production)

Décision de Frédéric (option A, 21/10/2026) : la carte « Jaugeage carburants — ouverture » de l'Inventaire mène au jaugeage Veeder-Root des Relevés piste (photo, OCR, vérification) ; la saisie manuelle reste en repli. Le worker OCR (HEIC, orientation) est un lot séparé, hors périmètre ici.

## Ce que le lot change (branche `lot-jaugeage-photo-20261021`, commit 168674c0, base production 09c9be47)
- `nexus-camera-page.js` (nouveau) : caméra dans la page comme le Pointage (`getUserMedia`, overlay, canvas), repli natif par `<label for>` sur un champ masqué hors écran (pas `display:none`), redimensionnement 2 000 px / JPEG 85 %.
- `NEXUS-Releves-Piste-v1.html` : bouton caméra, `envoyerPhoto` redimensionne avant l'upload, état du jaugeage mémorisé sur l'appareil et restauré, lien profond `?ecran=jauge`.
- `NEXUS-Inventaire-v1.html` : la carte mène aux Relevés piste ; la saisie manuelle devient un lien de repli.
- `test_jaugeage_photo_camera_en_page_20261021.js` : 11 épreuves.

## Ce qui n'est PAS fait
Aucune recette sur iPhone, aucune PR vers `production`, aucune écriture Supabase, aucune migration. Aucun lecteur OCR Veeder-Root n'existe dans le dépôt : la photo est déposée en `documents_ocr_file` (`en_attente`) comme avant.

## Demande
Cadrer la suite : recette navigateur de Frédéric sur l'aperçu Test avec un iPhone, puis PR vers `production` sur son GO explicite (motif `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`, qui reste le sien).
