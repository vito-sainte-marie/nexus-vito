# Suspension du lot JAUGEAGE-OCR-20261021 (21/10/2026)

Clos en l'état par decision-4 (APPROVED_WITH_CONDITIONS, closes: true), sans rien livrer. Reprise sous un nouveau lot **JAUGEAGE-OCR-2**.

## Travail fait (candidat local, NON versionné, aucune PR)
- Parseur Veeder-Root par regroupement de position ; moteur Apple Vision en Swift (`vision_ocr.swift`, mode `--resident`) ; lecteur résident avec relance et repli ponctuel (`ocr_engine.py`, `LecteurVision`) ; polling de la file `documents_ocr_file` toutes les secondes (`main.py`).
- 11 tests verts (`test_lecteur_vision.py` 6, `test_veeder_root.py` 5), dont la mort du lecteur entre deux photos.
- Jamais mesuré : latence de bout en bout, taux de lecture exacte par volume ; seuil de confiance 0,5 provisoire, non calibré.

## Empreintes SHA-256 du candidat
```
e0536b51a44dbb02ad59a6edd214aea873420d9e7cac63eec07055ee2c3bbf3e  main.py
22db5000626b2efc75e4bd317d0910f1024e7a4061ceffd290d78c23e8c89fc5  ocr_engine.py
990fec1fee352c47171c30bcaa36447e2c2f3649025c461893267a09c13f0f41  vision_ocr.swift
f6bc33a84f283aa9695d6aa29896de5487d4a49d2f0b13ff0602c18390b858e5  test_lecteur_vision.py
b331365e21b55e320593369ca01fa4a493fc354b5651dd13ec22b62a837ad16d  test_veeder_root.py
```
Les copies iMac/iCloud du worker d'origine et leurs empreintes sont dans `lots/JAUGEAGE-OCR-20261021/request-3.md`. Le candidat vit dans le répertoire de travail de la session de Claude, pas dans le dépôt : s'il est perdu, il est à réécrire.

## Photos attendues pour la reprise
- Environ quinze photos réelles de l'écran Veeder-Root, prises à la station sur plusieurs jours (calibration), avec provenance et sans donnée personnelle.
- Exclue de toute preuve : la ligne `16b44d11-47f4-4693-b598-b0f30002d37d` (données personnelles) ; sa suppression reste à décider par Frédéric.

## Conditions de reprise (decision-4)
Photos ci-dessus, identification de la copie canonique, calibration du seuil, mesure de latence de bout en bout. Rien n'est validé ni autorisé à la fusion.
