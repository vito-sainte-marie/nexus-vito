<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-2-20261022/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-2-20261022
seq: 4
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
---
# JAUGEAGE-OCR-2-20261022 : une étape « capture » guidée avant les quinze photos réelles

**Suite de :** decision-3.md (extension du lecteur Vision), exécutée et consommée avec la preuve d'action `1ff5f281` (tests synthétiques : grille 2 × 2, colonnes éloignées, ligne à faible confiance ; 19 vérifications vertes ; deux mutations rouges). Frédéric demande cette request le 22/10 à 12:55. **Aucun code n'est écrit avant la décision.**

## Preuve des conditions de decision-3

- **Trois fichiers seulement** : commit `1ff5f281` ne touche que `nexus-ocr-worker/vision_ocr.swift`, `vision_ocr_core.swift` et `test_vision_ocr.swift`. La livraison hors rail (`ocr-worker/`) n'a pas été poussée.
- **Texte, confiance propre et boîte x/y/w/h par ligne, fragments conservés** : fait ; sortie `{text, confidence, lignes:[{t,c,x,y,w,h,fragments:[…]}]}`. Confiance d'une ligne = la plus basse de ses fragments ; moyenne conservée en complément.
- **Langues `["fr-FR","en-US"]`, `usesLanguageCorrection=false`** : fait.
- **Contrat documenté dans la source** (sortie, repère, codes de sortie 0/1/2, mode résident) : fait.
- **Tests synthétiques** : grille 2 × 2, non-fusion des colonnes éloignées, ligne à faible confiance : verts (19 vérifications, compilés et exécutés sur un Mac arm64, hors iMac). Mutations : seuil horizontal neutralisé → échec ; minimum remplacé par maximum → échec.
- **Écart à signaler** : la commande de compilation à deux fichiers du rail ne passait pas (code de haut niveau hors `main.swift`, `Result<_, String>`). Corrigé dans les trois fichiers par `@main` et une structure d'erreur. Le lecteur complet compile ici (`swiftc -O vision_ocr_core.swift vision_ocr.swift`) ; **il n'a pas été exécuté sur une photo réelle**.
- **Limites de decision-2 conservées** : ni plist, service, PATH, environnement, mise en service, Paddle, venv 2.x ni branchement Python.

## Pourquoi une étape avant les quinze photos

La calibration du seuil (0,5 provisoire) repose sur quinze photos réelles. Si elles sont cadrées au petit bonheur, floues ou reflétées, la calibration mesure la photo et non le lecteur. La photo du 21/10 montre déjà que l'écran Veeder-Root TLS-4B n'occupe qu'une partie de l'image et que des fragments parasites (confiance 0,3) en sortent. Guider la prise de vue est donc un préalable, pas un confort.

## Ce qui est demandé

1. **Cadre en direct sur la visée**, aux proportions de l'écran Veeder-Root TLS-4B, avec un repère 2 × 2 des réservoirs et la consigne « Faites entrer l'écran dans le cadre ».
2. **Recadrage sur ce cadre avant l'envoi**, sans perdre l'en-tête où s'affichent la date et l'heure du Veeder-Root (la zone recadrée doit inclure cette bande, la date servant de preuve).
3. **Contrôle de netteté et de reflet sur le téléphone**, en moins de 2 secondes, avec le message « Photo floue, reprenez-la » avant l'envoi. Seuils à fixer par l'exécutant et consignés dans la source ; mesure de la durée dans les épreuves.
4. **Options du module `nexus-camera-page.js`, réservées au jaugeage.** Constat sur la branche `jaug-saisie-directe` (`c3eda0c2`) : `ouvrirCamera({ consigne, inputId })` n'a aujourd'hui que ces deux options ; le module est appelé par `NEXUS-Pointage-v1.html` et `NEXUS-Releves-Piste-v1.html`. Le Pointage reste inchangé, et **une épreuve doit le prouver** (même appel, même comportement observable, sans cadre ni contrôle).
5. **Méthode** : épreuves rouges puis vertes avec mutations, recette Test au format téléphone, PR en brouillon. **Pas de fusion sans le GO de Frédéric.**

## Limites

- Aucune écriture en Production, aucun déploiement, aucune fusion.
- Rien sur l'iMac, ni plist, service, PATH, environnement, Paddle, venv 2.x.
- Le recadrage et le contrôle de qualité tournent sur le téléphone ; le lecteur Vision, lui, n'est pas modifié par cette request.
- La recette iPhone réel reste un geste humain ; les quinze photos aussi.

## À arbitrer : l'ordre

Frédéric demande de soumettre l'ordre suivant : **capture, puis lecteur étendu (fait : `1ff5f281`), puis étape B à l'iMac, puis les quinze photos et la calibration.** Ce que je constate : le lecteur étendu est déjà exécuté, donc l'ordre effectif devient capture, étape B, photos. L'étape B (compilation et mesures sur l'iMac, diagnostic des 4 min 30) ne dépend pas de la capture ; elle peut être faite avant ou en parallèle si l'arbitre le préfère. Demande : approuver cette étape dans ce lot, avec exécutant `github-actions-claude`, sur une branche d'application distincte du rail (PR brouillon), et fixer l'ordre.

## Contraintes dites sans fard

- Les seuils de netteté et de reflet ne sont pas encore connus ; ils seront fixés sur des images synthétiques, puis vérifiés à la recette sur téléphone, pas calibrés sur des photos réelles.
- Le « moins de 2 secondes » est mesuré sur le navigateur de test, pas sur l'iPhone de Frédéric tant que la recette réelle n'a pas eu lieu.
- Les proportions exactes de l'écran TLS-4B sont tirées d'une seule photo ; l'exécutant doit les confirmer avant de les figer.
