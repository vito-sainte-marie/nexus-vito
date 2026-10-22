---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-2-20261022
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=73c88a47 production=ccedfa83
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 160-fichiers
---
# LOT : JAUGEAGE-OCR-2-20261022 — remettre la lecture des photos de jaugeage en service (option C : Apple Vision pour les photos, ocrmypdf pour les PDF)

## Origine
Suite de JAUGEAGE-OCR-20261021 (clos en l'état, request-6, sans livraison) et de la panne constatée le 22/10 sur le worker OCR de l'iMac. Le lot JAUGEAGE-SAISIE-DIRECTE-20261022 (clos, decision-4) a rendu la saisie directe des quatre volumes prioritaire : la lecture automatique n'est plus bloquante pour le pompiste. Ce lot ne la rend pas indispensable ; il la remet en service pour qu'elle soit un confort fiable.

## Constat (relevé iMac du 22/10, détail dans DIAGNOSTIC-WORKER-OCR-20261022.md)
- iMac Intel x86_64, macOS 26.6.2, Python 3.9.6, agent `com.nexus.ocr-worker`, code déployé du 13/08 dans `~/nexus-ocr-worker` (ce n'est pas la copie iCloud du 6/10).
- paddlepaddle 3.0.0, paddleocr 3.7.0, paddlex 3.7.2, numpy 2.0.2 : plantage dans `paddle_inference.create_predictor` au chargement de `PP-OCRv6_medium_det`. `ocr_engine.py` appelle l'API 2.x (`use_angle_cls`, `ocr(cls=True)`).
- `requirements.txt` n'épingle rien. En Intel, les roues paddlepaddle ≥ 3.1 n'existent pas : l'option A (aligner sur la 3.x) est impossible sur cette machine.
- Défauts annexes : 703 `PermissionError` sur `~/Desktop/projet NEXUS`, 6 « `ocrmypdf` introuvable » (PATH launchd), journal de 109 Mo jamais purgé.
- Le délai de 4 min 30 entre le dépôt de la photo (06:35:56) et sa prise en charge (06:40:29) n'est pas expliqué.

## Option demandée : C
Apple Vision pour les photos, `ocrmypdf` pour les PDF, Paddle retiré du chemin des images. Aucune version Python à aligner pour les photos : la panne disparaît sans toucher au venv cassé.

## Contenu du lot
1. Source Swift du lecteur Vision versionnée, avec son SHA-256 ; compilation sur l'iMac (`swiftc -O`), binaire non versionné.
2. Appel du binaire en sous-processus depuis `_ocr_image` (images) ; PDF inchangés (`ocrmypdf`).
3. Versions épinglées dans `requirements.txt` (ce qui reste utilisé).
4. Rotation de `worker.log` : 5 Mo, 3 fichiers.
5. Explication des 4 min 30 de latence, par lecture du journal et du cycle de scrutation, avant tout correctif.
6. Mesure du temps de lecture sur l'iMac, photo par photo.
7. Copie canonique du worker désignée (iMac vs iCloud), avec SHA-256.
8. Retour arrière : ancien code et ancien plist conservés ; le binaire est inerte s'il n'est pas appelé.

## Ce qui est exigé avant toute mise en service (decision-4 de JAUGEAGE-OCR)
Environ quinze photos réelles de l'écran du Veeder-Root, prises à la station, avec provenance et sans donnée personnelle. Geste humain : ces photos n'existent pas aujourd'hui et aucune session Claude ne peut les produire. La ligne Test `16b44d11-47f4-4693-b598-b0f30002d37d` contient des données personnelles : exclue.

## Ordre proposé
- A. Sans l'iMac : source Swift, appel en sous-processus, rotation du journal, épingles, tests sur des images de synthèse.
- B. Avec Frédéric à l'iMac (commandes de lecture/compilation à lui fournir une à une) : compilation, essai, mesure de temps, lecture du journal pour les 4 min 30.
- C. Avec les photos réelles : calibration du seuil de confiance (0,5 provisoire).
- D. Seulement alors, bascule du plist, sur GO.

## Hors périmètre
SQL, migration, RLS, Supabase Production, écran de jaugeage, lot 3, fusion ou déploiement. Rien n'est installé ni mis à jour sur l'iMac sans geste de Frédéric. `.env` et PATH ne sont pas modifiés (instruction de Frédéric) ; le PermissionError du dossier surveillé et l'`ocrmypdf` introuvable sont consignés, pas corrigés, tant que le choix n'est pas fait.

## À arbitrer
1. Approuver l'option C et l'ordre A → D.
2. Le dossier surveillé (bons scannés) passe aussi par `_ocr_image` : Paddle y reste-t-il nécessaire, auquel cas l'option B (paddlepaddle 2.6.2 + paddleocr 2.10.0, venv neuf) est à ajouter pour ces images seules ?
3. Quel traitement des défauts annexes, en lots séparés ou ici ?

## Contraintes dites sans fard
- Rien de ce qui précède n'a été exécuté sur l'iMac par Claude : tout est à essayer.
- Le moteur Vision a été essayé hors iMac (4 volumes en 1 à 2 s) ; aucune mesure sur l'iMac Intel ni sur de vraies photos.
- Le seuil 0,5 reste provisoire et non calibré.
- Sans les quinze photos, le lot ne peut dépasser l'étape B.
