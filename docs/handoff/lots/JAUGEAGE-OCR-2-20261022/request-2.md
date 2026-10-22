---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-2-20261022
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
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
  - id: sha256-vision-ocr-core
    classe: VERIFIED
    valeur: c3eeb761e10b2ebbc9643214f5924a94115f56a9aa5ee4b09b2a6edaf219466d
  - id: sha256-vision-ocr
    classe: VERIFIED
    valeur: 6284975b170970cbf8c1411e164f33b926e62741ae229219fd3673c68a225fcb
  - id: sha256-test-vision-ocr
    classe: VERIFIED
    valeur: 451c59d200e8c54109f672191ec1d7df6e3dbebf646c1756a348774ad2e54c3a
  - id: etape-a-commit
    classe: VERIFIED
    valeur: 26fd7bd241296788f41bb3fd5edc736ec599de0d
---
# JAUGEAGE-OCR-2-20261022 : étape A livrée (source Swift + tests synthétiques) ; étape B exige Frédéric à l'iMac

**Suite de :** decision-1.md (APPROVED_WITH_CONDITIONS, closes: false), `ACTION_NEXT` : « Versionner la source Swift du lecteur Vision avec son SHA-256 et ses premiers tests synthétiques, sans intervenir sur l'iMac. »

## Preuve des conditions de decision-1

Decision-1 pose sept conditions. Celles concernées par l'étape A sont traitées ci-dessous ; les autres ne sont pas encore atteignables depuis cette session (pas d'iMac, pas de macOS, pas de framework Vision ici) et restent donc ouvertes, listées en fin de section.

- **« Vision couvre toutes les images, y compris les bons scannés, et les PDF restent sur ocrmypdf »** — `vision_ocr.swift` est écrit pour les deux usages (écran Veeder-Root et bon scanné) sans distinction de type ; aucun fichier PDF n'est touché par ce lecteur. Preuve : lecture du fichier, commit 26fd7bd2.
- **« aucun ajout de Paddle ou de venv 2.x sans preuve comparative et nouvelle demande »** — rien n'a été ajouté ni modifié côté Paddle/venv dans ce commit ; `requirements.txt` n'existe toujours pas dans ce dépôt (hors périmètre de cette étape).
- **« l'étape A reste sans action sur l'iMac et comporte des tests synthétiques représentatifs des deux usages »** — aucune commande n'a été exécutée sur l'iMac dans cette session (elle n'y a pas accès). `test_vision_ocr.swift` couvre les deux usages (observations synthétiques représentant un écran Veeder-Root à quatre blocs et un bon scanné à trois lignes), plus le cas limite (aucune observation) et le contrat JSON de sortie. **Dit sans fard : ces tests ne sont PAS exécutés ici** — aucun toolchain Swift ni framework Vision n'est disponible dans cette session Linux. Ils sont écrits pour être compilés et exécutés sur l'iMac en étape B (`swiftc vision_ocr_core.swift test_vision_ocr.swift -o test_vision_ocr && ./test_vision_ocr`), sans dépendre de Vision (le fichier n'importe que Foundation).

### SHA-256 des trois fichiers versionnés (commit 26fd7bd2)

```
c3eeb761e10b2ebbc9643214f5924a94115f56a9aa5ee4b09b2a6edaf219466d  vision_ocr_core.swift
6284975b170970cbf8c1411e164f33b926e62741ae229219fd3673c68a225fcb  vision_ocr.swift
451c59d200e8c54109f672191ec1d7df6e3dbebf646c1756a348774ad2e54c3a  test_vision_ocr.swift
```

### Conditions non encore prouvées (hors portée de l'étape A, inchangées depuis decision-1)

- latence de 4 min 30 : diagnostic non fait, exige la lecture du journal réel sur l'iMac (étape B) ;
- quinze photos réelles avec provenance, sans donnée personnelle : geste humain, n'existent pas encore ;
- calibration du seuil de confiance (0,5 provisoire) : exige les quinze photos ;
- `PermissionError` et absence d'`ocrmypdf` dans le PATH launchd : déjà consignés au constat de request-1.md de ce lot (relevé iMac du 22/10) ; non corrigés ici, conformément à la décision. Note : `request-1.md` cite un fichier `DIAGNOSTIC-WORKER-OCR-20261022.md` « détaillé » qui n'a jamais été versionné dans ce dépôt (vérifié : absent de l'arbre et de tout l'historique git) — même sort que le candidat Swift de JAUGEAGE-OCR-20261021, resté dans un répertoire de travail de session. Le constat de request-1.md reste la seule trace écrite ;
- bascule du plist et mise en service D : explicitement exclues par decision-1, non entreprises.

## Ce qui a été fait (commit 26fd7bd2, poussé sur ce rail)

1. `nexus-ocr-worker/vision_ocr_core.swift` : structures `OCRResult`/`OCRError` et `assemblerResultat()` — logique pure (tri des observations du haut vers le bas de l'image, confiance moyenne), sans import Vision, pour rester testable sans l'iMac.
2. `nexus-ocr-worker/vision_ocr.swift` : CLI Apple Vision — option C de decision-1 (Vision pour les images, PDF inchangés sur ocrmypdf). Deux modes : appel unique (`vision_ocr <chemin>`) et résident (`vision_ocr --resident`, un chemin par ligne sur stdin, un JSON par ligne sur stdout) pour amortir le coût de lancement de Vision — piste à vérifier en étape B face à la latence de 4 min 30 non expliquée. Compilation (`swiftc -O`) réservée à l'iMac ; le binaire n'est pas versionné.
3. `nexus-ocr-worker/test_vision_ocr.swift` : tests synthétiques décrits ci-dessus.

Rien d'autre n'a été touché : pas d'appel en sous-processus depuis un `_ocr_image` (celui-ci n'existe pas dans ce dépôt — seul `dossier_watcher.py` y est versionné, cf. suspension de JAUGEAGE-OCR-20261021), pas de rotation de journal, pas de modification de `.env` ni de PATH, pas de `requirements.txt`. Ces points restent au contenu du lot, pour l'étape B ou une demande séparée.

## Ce qui reste (étape B, decision-1 : « avec Frédéric à l'iMac, commandes de lecture/compilation à lui fournir une à une »)

Cette session n'a pas d'accès à l'iMac ; la compilation, l'essai et la mesure de latence exigent la présence de Frédéric à la machine. C'est une gate humaine au sens de decision-1 elle-même (ordre A → B → C → D, B explicitement « avec Frédéric à l'iMac »), pas une incapacité d'outillage à corriger ici.

## À arbitrer

Comment organiser l'étape B : soit une session dédiée où Frédéric exécute les commandes de compilation/essai fournies une à une (pas de nouvel arbitrage requis pour cela, cf. `COMMIT_PUSH_RAIL_SANS_GO`), soit un nouveau lot si le calendrier de Frédéric ne le permet pas avant un autre travail prioritaire. Aucune suite n'est entreprise ici sans ce geste humain.

## Contraintes dites sans fard

- Les tests synthétiques ne sont pas exécutés dans cette session (pas de toolchain Swift/Vision) ; leur vert reste à constater sur l'iMac.
- Le lecteur Vision n'a jamais été ni compilé ni essayé par cette session ; tout reste à faire en étape B.
- Le mode `--resident` est une hypothèse de conception (amortir le lancement de Vision) non mesurée : la latence de 4 min 30 pourrait avoir une autre cause, à diagnostiquer avant tout correctif (condition de decision-1).
