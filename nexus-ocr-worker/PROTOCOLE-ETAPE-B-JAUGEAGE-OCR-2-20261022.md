# Protocole reproductible — étape B (JAUGEAGE-OCR-2-20261022)

Suite de `decision-2.md` (APPROVED_WITH_CONDITIONS, closes: false), `ACTION_NEXT` :
« Versionner sur le rail le protocole reproductible de l'étape B, limité à la
lecture diagnostique, à la compilation et aux tests sans mise en service. »

Ce fichier ne contient **aucun résultat** : cette session n'a pas accès à
l'iMac. Il donne à Frédéric les commandes à exécuter **une à une**
(`decision-1.md` : « avec Frédéric à l'iMac, commandes de lecture/compilation
à lui fournir une à une »), pour qu'il consigne lui-même sorties, versions et
latences. Rien n'est automatisé ; rien ne s'exécute seul.

## Ce que ce protocole ne fait jamais

- Aucune modification de `com.nexus.ocr-worker.plist`, d'aucun service, du
  `PATH` ou de `.env` — les commandes de lecture le sont, en lecture seule.
- Aucune mise en service du lecteur Vision : les binaires compilés restent
  dans un dossier de travail jetable, jamais dans `~/nexus-ocr-worker` déployé
  ni appelés par le worker Python en production sur l'iMac.
- Aucun ajout de Paddle ou de venv 2.x.
- Aucune calibration du seuil de confiance (0,5 provisoire) : réservée aux
  quinze photos réelles tracées et sans donnée personnelle, qui n'existent
  pas encore. Aucune image réelle n'est utilisée ici.
- Aucune correction appliquée avant diagnostic : la section 1 est une lecture,
  pas un correctif.

Si une commande échoue ou renvoie un résultat inattendu : s'arrêter, noter la
sortie exacte, ne pas improviser de commande corrective hors de ce protocole.

## 0. Préalables (lecture seule)

```
sw_vers
uname -a
swift --version
```

Consigner les trois sorties telles quelles (versions macOS, noyau, toolchain
Swift).

## 1. Lecture diagnostique — latence de 4 min 30 (constat du 22/10, dépôt
   06:35:56 → prise en charge 06:40:29)

Lecture seule, aucune édition de fichier à cette étape.

```
launchctl list | grep com.nexus.ocr-worker
cat ~/Library/LaunchAgents/com.nexus.ocr-worker.plist
```

Noter la valeur de l'intervalle de scrutation déclaré (`StartInterval`,
`RunAtLoad`, ou tout `WatchPaths`), et le(s) chemin(s) de journal déclarés
(`StandardOutPath` / `StandardErrorPath`).

```
grep -n "06:3[5-9]:\|06:40:" <chemin-du-journal-trouvé-ci-dessus>
```

Isoler les lignes qui encadrent le dépôt (06:35:56) et la prise en charge
(06:40:29) du 22/10 : dernière ligne avant 06:35:56, toutes les lignes entre
06:35:56 et 06:40:29, première ligne après. Consigner ces lignes telles
quelles.

```
grep -n -i "sleep\|interval\|scrutation\|poll" ~/nexus-ocr-worker/*.py
```

Sur le code déployé (13/08, Python 3.9.6, cf. request-1.md de ce lot) : noter
la valeur de la constante de cycle trouvée. Ne pas modifier le fichier.

Avec l'intervalle de scrutation et les lignes de journal en main, formuler
l'hypothèse de cause des 4 min 30 avant tout correctif (condition de
`decision-1.md` et `decision-2.md`) — un cycle de scrutation long en est une
cause plausible parmi d'autres ; cette étape ne tranche pas, elle rassemble la
preuve.

## 2. Compilation, dans un dossier de travail jetable (sans toucher au
   déployé)

```
mkdir -p ~/nexus-ocr-worker-etape-b && cd ~/nexus-ocr-worker-etape-b
cp <chemin-du-dépôt-nexus-vito>/nexus-ocr-worker/vision_ocr_core.swift .
cp <chemin-du-dépôt-nexus-vito>/nexus-ocr-worker/vision_ocr.swift .
cp <chemin-du-dépôt-nexus-vito>/nexus-ocr-worker/test_vision_ocr.swift .
shasum -a 256 vision_ocr_core.swift vision_ocr.swift test_vision_ocr.swift
```

Comparer les trois empreintes à celles publiées dans `request-2.md` de ce
lot (commit `26fd7bd2`) :

```
c3eeb761e10b2ebbc9643214f5924a94115f56a9aa5ee4b09b2a6edaf219466d  vision_ocr_core.swift
6284975b170970cbf8c1411e164f33b926e62741ae229219fd3673c68a225fcb  vision_ocr.swift
451c59d200e8c54109f672191ec1d7df6e3dbebf646c1756a348774ad2e54c3a  test_vision_ocr.swift
```

Si elles diffèrent : s'arrêter, ne pas compiler, consigner l'écart — c'est un
signe que la copie transmise n'est pas celle versionnée sur le rail.

Si elles correspondent :

```
time swiftc vision_ocr_core.swift test_vision_ocr.swift -o test_vision_ocr
time swiftc -O vision_ocr_core.swift vision_ocr.swift -o vision_ocr
```

Consigner la sortie de compilation (avertissements, erreurs) et le temps
(`real`) de chaque commande. `vision_ocr` n'est compilé ici que pour vérifier
qu'il compile — il n'est appelé par aucun test synthétique (ceux-ci n'importent
pas Vision, cf. `test_vision_ocr.swift`), et il n'est ni déplacé vers
`~/nexus-ocr-worker` ni appelé par le worker Python à cette étape.

## 3. Exécution des tests synthétiques

```
./test_vision_ocr
echo "code de sortie : $?"
```

Sortie attendue (si tout est vert) :

```
OK — Veeder-Root : lignes remises dans l'ordre haut→bas malgré un ordre d'entrée mélangé
OK — Veeder-Root : confiance moyenne des quatre blocs
OK — Bon scanné : lignes remises dans l'ordre haut→bas
OK — Bon scanné : confiance moyenne, plus basse et plus irrégulière que Veeder-Root
OK — Aucune observation : texte vide
OK — Aucune observation : confiance à zéro, jamais négative ni NaN
OK — JSON du résultat contient le champ text
OK — JSON du résultat contient la confiance
Tous les tests synthétiques sont verts (8 vérifications).
code de sortie : 0
```

Consigner la sortie réelle telle quelle, qu'elle corresponde ou non à
l'attendu ci-dessus — un écart est un résultat, pas une erreur à masquer.

## 4. Ce que ce protocole ne couvre pas

Hors de cette étape B, sans nouvelle demande : essai de `vision_ocr` sur une
image réelle (réservé aux quinze photos tracées, étape C), mesure du temps de
lecture photo par photo, calibration du seuil, rotation de `worker.log`,
épinglage de `requirements.txt`, bascule du plist, toute mise en service.

## À consigner par Frédéric, en retour

- Les trois sorties de la section 0.
- Les lignes de journal et la valeur d'intervalle de la section 1, avec
  l'hypothèse de cause des 4 min 30.
- Les empreintes SHA-256 de la section 2 et leur comparaison.
- La sortie et le temps de compilation des deux commandes `swiftc`.
- La sortie complète et le code de sortie de `./test_vision_ocr`.

Ce retour alimentera la prochaine demande de ce lot ; il n'est pas déposé par
cette session, qui n'a pas produit ces mesures elle-même.
