<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-20261021
seq: 4
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
  - id: copies-identiques
    classe: VERIFIED
    valeur: iMac=iCloud sur 6 fichiers (request-3)
  - id: vision-photo-propre
    classe: VERIFIED
    valeur: 4 volumes, 4 hauteurs, 4 temperatures exacts
---
# JAUGEAGE-OCR-20261021 : modification de périmètre — sans Broadcast, interrogation toutes les secondes, lecteur Vision résident

**Suite de :** request-3.md (en attente) et decision-1.md (APPROVED_WITH_CONDITIONS, closes: false). Cette demande remplace request-3 sur un seul point, la notification. Instruction de Frédéric, donnée en session le 21/10/2026 : « Je renonce au Broadcast public. Le worker interroge la file toutes les secondes, et le lecteur Vision reste démarré en permanence pour éviter le temps de démarrage. Objectif : volumes proposés en 3 secondes au plus après l'envoi, mesuré sur de vraies photos. Si on le dépasse, rapporte la mesure au lieu d'ouvrir un autre canal. La comparaison des empreintes consignée dans la request-3 suffit (copies identiques). »

## Preuve des conditions de decision-1

La preuve des conditions 1 (copies iMac = iCloud sur six fichiers, empreintes SHA-256) et 2 (scan de secrets, limites dites) est consignée dans **request-3.md, section « Preuve des conditions de decision-1 »**, et n'est pas répétée ici. Frédéric a confirmé en session que cette comparaison suffit. Les limites annoncées restent : historique git de l'ancienne copie du watcher non relu, `.env` de l'iMac non vérifiable d'ici.

## Périmètre modifié

1. **Notification : le Broadcast est abandonné.** Aucun canal Realtime, aucun ping, aucune surface nouvelle. Le worker interroge la file `documents_ocr_file` (`en_attente`) **toutes les secondes** (au lieu de la période actuelle). Le client lit le résultat dans la ligne, avec ses droits habituels, comme aujourd'hui. Aucune migration, aucune publication, aucune RLS.
2. **Lecteur Vision résident.** L'exécutable Swift reste démarré en permanence (processus long) pour supprimer le coût de lancement (~1 s mesuré). Il reçoit une image à la fois et renvoie le JSON des boîtes. S'il meurt, le worker le relance et se rabat sur un lancement ponctuel. Source versionnée, binaire non.
3. **Délai.** Objectif : volumes proposés au plus 3 s après l'envoi, mesuré de bout en bout sur de vraies photos (quinzaine à prendre sur l'aperçu Test). **Si le délai est dépassé, la mesure est rapportée telle quelle ; aucun autre canal n'est ouvert.**
4. **Inchangé** par rapport à request-3 : moteur Vision pour `jaugeage_veeder_root` seulement (PaddleOCR et OCRmyPDF pour le reste) ; parseur par regroupement de position ; lecture proposée à côté de chaque champ avec le bouton « Utiliser », jamais pré-remplie ; valeur peu sûre (confiance < 0,5, seuil provisoire à recalibrer) ou supérieure à la capacité de la cuve signalée et non proposée ; message clair si aucune lecture n'arrive dans les 3 s ; taux de lecture exacte par volume sur la quinzaine.

## Hors périmètre, inchangé

Aucun SQL, aucune migration, aucune fusion vers `main` ou `production`, aucun déploiement en Production sans GO de Frédéric. Aucun secret versionné. L'écran HTML touché le sera dans une PR séparée vers `main`, sans fusion sans GO. Le worker (`nexus-ocr-worker/`) sera versionné dans une PR sans fusion ni déploiement sans GO.

## À arbitrer

- Cette modification de périmètre est-elle acceptable ? Elle réduit la surface par rapport à request-3 (plus de canal public sur clé anonyme).
- Le seuil de confiance (0,5, provisoire) sera recalibré sur la quinzaine ; le taux sera rapporté.

## Contraintes dites sans fard

- Le parseur et le moteur Swift n'ont été validés que sur une photo ; la quinzaine reste à faire.
- L'interrogation à 1 s et le lecteur résident ne sont ni écrits ni mesurés. Le moteur seul a pris ~1 s (≈2,0 s lancement complet inclus) sur la photo propre ; la chaîne complète n'est pas mesurée.
