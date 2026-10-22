---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-2-20261022
seq: 3
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
  - id: rail-tete
    classe: VERIFIED
    valeur: fcce2663282d7ae6a3aa9955de45b8e7b6aba1ee
  - id: sha256-vision-ocr-rail
    classe: VERIFIED
    valeur: 6284975b170970cbf8c1411e164f33b926e62741ae229219fd3673c68a225fcb
---
# JAUGEAGE-OCR-2-20261022 : étendre la sortie du lecteur Vision du rail avant toute compilation à l'iMac

**Suite de :** decision-2.md (APPROVED_WITH_CONDITIONS, `closes: false`), consommée avec la preuve d'action `1de147d4` (protocole de l'étape B). Frédéric demande cette request avant l'étape B : la source du rail (`26fd7bd2`) n'a pas la forme de sortie dont le parseur a besoin, et la compiler puis mesurer sur l'iMac en l'état prouverait un lecteur à corriger ensuite.

## Preuve des conditions de decision-2

- **Étape B conservée dans ce lot** : oui, aucun nouveau lot.
- **Protocole reproductible versionné** : fait par `1de147d4` (`nexus-ocr-worker/PROTOCOLE-ETAPE-B-JAUGEAGE-OCR-2-20261022.md`).
- **Compilation et tests synthétiques sur l'iMac, avec sorties, versions et latences** : **non faits**. Cette request les suspend à l'extension demandée ci-dessous, parce qu'ils porteraient sur une sortie à remplacer.
- **Diagnostic des 4 min 30 avant tout correctif** : non fait ; il exige le journal de l'iMac (étape B). Hypothèse de code seulement : boucle séquentielle à un thread, aucun délai autour de `moteur.extraire`, un document précédent peut occuper le tour. Aucun correctif proposé.
- **Ni plist, ni service, ni PATH, ni environnement ; aucune mise en service** : respecté, rien n'a été touché sur l'iMac.
- **PDF sur `ocrmypdf`, Vision pour toutes les images** : respecté.
- **Ni Paddle ni venv 2.x** : respecté.
- **Calibration du seuil réservée aux quinze photos réelles sans donnée personnelle** : non faite ; ces photos n'existent pas encore (geste humain).

## Ce que la source du rail ne fait pas (constat, comparaison avec un lecteur construit hors rail)

Un lecteur alternatif a été construit et essayé hors rail sur un Mac arm64 (il a lu deux images synthétiques, bon scanné et écran Veeder-Root). **Il n'est pas poussé** : c'est l'exécutant désigné par la décision qui modifie la source du rail. Sa comparaison avec `vision_ocr.swift` (`6284975b…`) donne trois écarts qui comptent.

1. **Confiance moyenne au lieu d'une confiance par ligne.** `assemblerResultat` renvoie `{text, confidence}` où `confidence` est la moyenne. Le parseur Veeder-Root marque une valeur `peu_sur` d'après la confiance de **sa** ligne ; une moyenne la masque. La calibration du seuil (0,5 provisoire, étape C) ne peut pas se faire sans elle. Apple Vision rend par ailleurs souvent exactement 0,5 pour des lignes bien lues, ce qui rend le seuil `c < 0,5` sans effet sur elles : l'information par ligne est indispensable pour en juger.
2. **Boîte perdue.** Seul `y` (bas de la boîte) est conservé. Sans `x`, `w`, `h`, on ne peut pas rattacher une valeur à son réservoir.
3. **Ordre de lecture par `y` seul, sans regroupement.** Les fragments d'une même ligne, légèrement décalés en hauteur, sortent dans le désordre ; deux colonnes se mélangent.

## Pourquoi c'est bloquant : la photo de l'écran à quatre réservoirs

L'écran photographié (horodatage affiché : 21/10/2026 15:25 ; Frédéric la date du 22/10) affiche **quatre réservoirs sur deux colonnes** (grille 2 × 2). Les boîtes lues par Vision (coordonnées normalisées, origine en bas à gauche) montrent le mélange :

| y | colonne gauche (x ≈ 0,2–0,5) | colonne droite (x ≈ 0,56–0,84) |
|---|---|---|
| 0,52 | `RESERVOIR 1: R3 30M3 SP` | `RESERVOIR 2: R4 10M3 GO` |
| 0,51 | `Volume Produit` / `22710` | `Volume Produit` / `8081` |
| 0,45 | `RESERVOIR 3: R1 20M3-50` | `RESERVOIR 4: R2 30M3 GNR` |
| 0,44 | `Volume Produit` / `13711` | `Volume Produit` / `4373` |

Un tri par `y` seul alterne un fragment de chaque colonne : « RESERVOIR 1 », « RESERVOIR 2 », « Volume Produit », « Volume Produit », 22710, 8081… Le texte libre perd l'appartenance des valeurs aux réservoirs. Le parseur lit par colonne (en-tête, lignes dessous, même colonne) et exige donc `x`, `w`, `h`. Des fragments parasites (« 22710 » isolé à x = 0,23 sous la ligne, chiffres de 0,3 de confiance) montrent aussi que la confiance par ligne est nécessaire pour les écarter.

## Ce qui est demandé

Étendre `vision_ocr.swift` / `vision_ocr_core.swift` et `test_vision_ocr.swift` **avant toute compilation à l'iMac** :

1. **Sortie par ligne** : pour chaque ligne reconnue, texte, confiance **propre à la ligne**, et boîte normalisée `x`, `y`, `w`, `h` (origine en bas à gauche). La moyenne peut rester en complément, jamais en remplacement.
2. **Regroupement des fragments d'une même ligne** : fragments dont les centres verticaux sont proches (écart inférieur à la moitié de la plus grande hauteur) regroupés en une ligne, triés par `x` dans la ligne ; lignes ordonnées du haut vers le bas. Le regroupement ne fusionne pas deux colonnes éloignées : l'ordre reste exploitable, et la boîte de chaque fragment est conservée.
3. **Langues fixées** : `recognitionLanguages = ["fr-FR", "en-US"]` ; sans cela le résultat dépend de la langue système de l'iMac, non mesurée. `usesLanguageCorrection = false` est conservé.
4. **Contrat de sortie documenté** dans la source (champs, repère, codes de sortie, mode résident) et **tests synthétiques mis à jour** : la grille 2 × 2 ci-dessus (observations fabriquées à la main, sans image réelle) doit sortir avec chaque valeur rattachée à son réservoir ; une ligne à confiance basse doit rester identifiable.

Hors de cette demande, inchangés : l'étape B (compilation, essais, mesures, journal, diagnostic des 4 min 30) reprend après cette extension, avec Frédéric à l'iMac. L'orientation des photos d'iPhone (EXIF) est à vérifier à l'étape B, pas ici. Le branchement Python (`_ocr_image`), la rotation du journal et les versions épinglées restent hors rail, en réserve, pour l'étape qui les autorisera.

## À arbitrer

Approuver cette extension comme préalable à l'étape B, avec exécutant `github-actions-claude`, dans les limites de decision-2 (ni plist, ni service, ni PATH, ni mise en service ; PDF sur `ocrmypdf` ; ni Paddle ni venv 2.x).

## Contraintes dites sans fard

- La comparaison s'appuie sur un lecteur construit hors rail et non versionné ; seule son existence et ses lectures sur images synthétiques sont affirmées, rien sur photos réelles.
- Le tableau ci-dessus est tiré des boîtes d'une seule photo ; ce n'est pas une calibration.
- Aucune compilation ni essai n'a eu lieu sur l'iMac.
