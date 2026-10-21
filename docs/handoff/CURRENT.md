<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/request-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-20261021
seq: 5
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
# JAUGEAGE-OCR-20261021 : conditions de decision-2 hors de portée de ce réveil — arrêt consigné

**Suite de :** decision-2.md (APPROVED_WITH_CONDITIONS, closes: false, in_reply_to: request-4.md).

## Ce qui a été fait dans ce réveil

1. `git fetch origin handoff-continuite-20260920` : rail lu à jour (`4bb14a2d`), rien à rapatrier.
2. `node outils/handoff.js verifier` : registre sain (85 lots, mêmes avertissements permanents qu'avant — aucun nouveau).
3. Décision prise en charge : `node outils/handoff.js consommer JAUGEAGE-OCR-20261021 --prise-en-charge`.
4. Lecture de decision-2.md et de son `CONDITIONS` : huit engagements cumulatifs, à vérifier avant tout commit de travail.
5. Mesure de l'état du dépôt pour le périmètre approuvé (`nexus-ocr-worker/`) : seul `dossier_watcher.py` y existe (déjà qualifié de copie périmée par request-1) ; ni `main.py`, ni `ocr_engine.py`, ni de source Swift n'existent dans ce dépôt, à aucun commit. Aucune des quinze photos de calibration demandées n'est présente sur le rail.
6. Recherche d'un accès quelconque, depuis ce réveil, à une copie à jour du worker ou à des photos de test : aucun montage, aucun chemin, aucune variable d'environnement ne référence l'iMac ou l'iCloud de Frédéric, et aucune caméra ni aperçu Test n'est accessible depuis ce checkout GitHub Actions. C'est la même absence de capacité réseau/disque déjà consignée par request-2.md pour la condition 1 de decision-1 — elle se reproduit ici à l'étage suivant du même lot.
7. Aucune action supplémentaire : aucun fichier hors de `docs/handoff/` n'a été créé ni modifié, aucun commit de travail n'existe sur le rail pour ce lot dans ce réveil.

## Ce qui bloque

decision-2 rappelle explicitement que « les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s'appliquent », et decision-1 (toujours en vigueur, closes: false) exige de comparer par empreintes la copie iMac et la copie iCloud avant tout commit contenant le worker. Écrire aujourd'hui, de mémoire, un `main.py`/`ocr_engine.py` modifiés (polling 1 s, lecteur Vision résident avec relance et fallback) ou une source Swift nouvelle, sans disposer des deux copies à comparer, court-circuiterait cette condition au lieu de la remplir — exactement le contournement que request-2.md refusait déjà de faire pour la version précédente du même fichier.

Même chose pour la mesure exigée par decision-2 : « mesurer sur environ quinze vraies photos en Test la latence de bout en bout et le taux de lecture exacte par volume » et « recalibrer et consigner le seuil provisoire de 0,5 ». Ces photos n'existent sur aucun support accessible depuis ce réveil ; les produire suppose un geste physique (prendre une quinzaine de photos de l'écran Veeder-Root sur l'aperçu Test, avec éclairages et angles différents) que seul Frédéric peut faire, comme request-1.md et request-3.md l'avaient déjà anticipé dans leurs « Contraintes dites sans fard ».

Ce n'est donc pas un refus de ma part ni une relecture différente de decision-2 : c'est une capacité absente — produire ou faire produire la copie worker à jour et les quinze photos — que ce réveil ne détient pas et qu'aucun outil du dépôt ne peut lui donner. Je ne contourne rien et je ne m'arbitre pas moi-même sur un périmètre déjà approuvé.

## Preuve des conditions de decision-2

- *Ne créer aucun canal Broadcast ou Realtime* — VERIFIED : aucun fichier hors `docs/handoff/` n'a été touché ; aucun canal n'a été créé.
- *Limiter le changement au polling toutes les secondes et au lecteur Vision résident avec relance et fallback ponctuel* — NOT_APPLICABLE : non écrit ; `main.py`/`ocr_engine.py` à jour n'existent pas dans ce dépôt, et la copie iMac/iCloud à comparer n'est pas accessible depuis ce réveil.
- *Versionner la source mais aucun binaire ni secret* — NOT_APPLICABLE : aucun arbre candidat n'existe encore à versionner.
- *Conserver l'absence de préremplissage et le bouton « Utiliser »* — NOT_APPLICABLE : l'écran HTML de jaugeage n'a pas été touché dans ce réveil (PR séparée, hors de ce périmètre).
- *Mesurer sur environ quinze vraies photos en Test la latence de bout en bout et le taux de lecture exacte par volume* — NOT_APPLICABLE : aucune photo n'est disponible depuis ce réveil ; aucune mesure n'a donc pu être tentée, ni a fortiori faussée.
- *Recalibrer et consigner le seuil provisoire de 0,5* — NOT_APPLICABLE : dépend de la mesure précédente, non faite.
- *Si le délai dépasse 3 s, rapporter la mesure sans ouvrir d'autre canal* — NOT_APPLICABLE : aucune mesure de délai n'a été faite.
- *Ne réaliser aucun SQL, migration, changement RLS, fusion vers main ou production, ni déploiement Production* — VERIFIED : aucune de ces actions n'a été tentée.

## Demande

1. Dire qui, concrètement, peut produire la copie à jour du worker (polling 1 s, lecteur Vision résident, source Swift) et sa comparaison d'empreintes iMac/iCloud : si c'est un geste de Frédéric, le nommer explicitement plutôt que `github-actions-claude`, qui n'a et ne peut avoir cet accès — même question que request-2.md, reposée ici parce que le périmètre a changé entre-temps (decision-2 remplace la notification Broadcast par le polling 1 s et le lecteur résident).
2. Dire qui peut produire les quinze photos réelles de calibration sur l'aperçu Test, et comment leur dépôt sur le rail doit être consigné (provenance, absence de donnée personnelle) avant que ce réveil puisse mesurer latence et taux de lecture.
3. Si l'intention est que Frédéric dépose directement les fichiers et les photos retenus sur ce rail, avec la provenance déjà consignée, dire si un réveil autonome comme celui-ci peut alors enchaîner le scan de secrets, la limitation du périmètre et la mesure sans nouvel arbitrage, ou si chaque étape reste à son tour soumise à décision.
4. Aucune action supplémentaire n'est prise par ce réveil sur ce lot avant une réponse.
