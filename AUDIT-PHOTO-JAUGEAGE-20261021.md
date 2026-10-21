# Audit — photo du jaugeage Veeder-Root (21/10/2026)

Contexte : l'appareil photo ne s'ouvre pas sur l'iPhone de Dylan pour le jaugeage ; le Pointage, corrigé en profondeur, fonctionne.

## Écarts jaugeage (Relevés piste) / Pointage
| Point | Pointage | Jaugeage (avant le lot) |
|---|---|---|
| Caméra | `getUserMedia` dans la page, overlay, aperçu, repli natif | `<input capture="environment">` natif seul : la page est quittée |
| Champ natif | masqué hors écran par `clip` | `display:none` dans un `<label>` : iOS ignore parfois le clic |
| Taille de l'image | redimensionnée (1 600 px, JPEG 82 %) | photo brute envoyée (plusieurs Mo, HEIC possible) |
| État | repère local conservé au repli | rien : une page déchargée perd saisies et document |

## Hypothèses (classées)
1. Page déchargée ou rechargée pendant l'appareil photo natif, état perdu (probable).
2. Champ en `display:none` (probable sur iOS).
3. Génération mélangée en cache (HTML et scripts d'âges différents), à écarter par rechargement.

## Taille à stocker
Envoyer ≤ 2 000 px, JPEG 85 % : quelques centaines de Ko, lisible pour un écran Veeder-Root.

## Lecteur OCR
Aucun lecteur OCR Veeder-Root visible dans le dépôt : le worker présent ne traite que des bons de livraison. HEIC et orientation relèvent d'un lot séparé du worker.

## Décision (Frédéric, option A)
La carte Inventaire mène au jaugeage des Relevés piste ; la saisie manuelle reste en repli ; « Je ne peux pas faire le jaugeage » reste sur la carte. Les deux parcours écrivent via `enregistrerJaugeageOuverturePompiste`.
