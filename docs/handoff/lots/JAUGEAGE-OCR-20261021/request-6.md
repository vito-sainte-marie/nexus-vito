---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-20261021
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=84adc5de
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 159-fichiers
---
# LOT : JAUGEAGE-OCR-20261021 — suspension : clore en l'état, rouvrir sous JAUGEAGE-OCR-2

Suite de decision-3.md (NEEDS_EVIDENCE sur request-5.md) et de la décision de Frédéric du 21/10/2026 (« voie 3 »).

## Demande
Clore le lot **en l'état** (`closes: true`), **sans rien livrer**, et autoriser sa réouverture ultérieure sous un nouveau lot **JAUGEAGE-OCR-2**.

## Pourquoi
decision-3 attend environ quinze photos réelles de l'aperçu Test, avec provenance. Les photos de calibration (écran Veeder-Root) ne peuvent être prises qu'à la station, sur plusieurs jours : elles n'existent pas et aucun geste de Claude ne peut les produire. Laisser le lot ouvert bloque tout autre lot (règle D3 : un seul lot actif) pour une preuve qui ne viendra pas avant plusieurs jours. Frédéric a fait ce choix.

## Preuve des conditions de decision-3
- *Copies iMac/iCloud du worker avec SHA-256* — déjà consignées dans request-3.md ; inchangées.
- *Environ quinze photos réelles Test, provenance, absence de données personnelles* — NOT_APPLICABLE à la clôture : aucune photo de calibration n'existe ; leur attente est consignée comme condition de réouverture. Une photo déjà présente en Test contient des données personnelles (ligne `16b44d11-47f4-4693-b598-b0f30002d37d`) : elle est exclue et sa suppression reste à décider par Frédéric.
- *Identification de la copie canonique* — NOT_APPLICABLE : rien n'est livré.

## Ce qui est consigné (commit hors docs/handoff/)
Un fichier de suspension sur le rail, hors `docs/handoff/` : le travail fait (parseur Veeder-Root, moteur Apple Vision en Swift, lecteur résident, polling 1 s, 11 tests verts), les empreintes SHA-256 des fichiers du candidat, les photos attendues et la condition de réouverture. Ce commit sert de preuve de consommation. Le candidat lui-même n'est pas versionné (ni PR du worker, ni écran de jaugeage, ni binaire).

## Périmètre modifié
Aucun code applicatif. Registre Handoff et un seul fichier de suspension.

## Hors périmètre
SQL, migration, RLS, fusion vers `main`/`production`, déploiement, binaire ou secret versionné, PR du worker, modification de l'écran de jaugeage.

## À arbitrer
Approuver la clôture en l'état avec réouverture sous JAUGEAGE-OCR-2, sans livraison. Le lot suivant (PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021, Relevés piste) est déposé aussitôt après consommation.

## Contraintes dites sans fard
- Le travail du candidat n'est pas livré : il reste sur le poste de Claude et dans les empreintes consignées ; si ce poste est perdu, le code est à réécrire.
- Le seuil de confiance 0,5 reste provisoire et non calibré ; la latence de bout en bout n'a jamais été mesurée sur de vraies photos.
