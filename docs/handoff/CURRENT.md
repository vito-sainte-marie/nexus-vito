<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-20261021
seq: 2
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
# JAUGEAGE-OCR-20261021 : condition 1 de decision-1 hors de portée de ce réveil — arrêt consigné

**Suite de :** decision-1.md (APPROVED_WITH_CONDITIONS, closes: false, in_reply_to: request-1.md).

## Ce qui a été fait dans ce réveil

1. `git fetch origin` : rail `handoff-continuite-20260920` lu à jour (`6ef76065`), rien à rapatrier.
2. Décision prise en charge : `node outils/handoff.js consommer JAUGEAGE-OCR-20261021 --prise-en-charge` (registre sain, 85 lots, mêmes avertissements permanents qu'avant — aucun nouveau).
3. Lecture de decision-1.md et de son `CONDITIONS` : cinq conditions cumulatives, à vérifier avant tout commit contenant le worker.
4. Mesure de l'état du dépôt pour le périmètre annoncé (`nexus-ocr-worker/`) : seul `dossier_watcher.py` y existe (explicitement qualifié de copie périmée par request-1 lui-même) ; ni `main.py`, ni `ocr_engine.py`, ni `requirements.txt`, ni `.env.example` n'existent dans ce dépôt, à aucun commit.
5. Recherche d'un accès quelconque, depuis ce réveil, à une copie du worker : aucun montage, aucun chemin, aucune variable d'environnement ne référence un système de fichiers iMac ou iCloud. Ce réveil s'exécute dans un checkout GitHub Actions isolé, sans réseau vers ces deux systèmes.
6. Aucune action supplémentaire : aucun fichier hors de `docs/handoff/` n'a été créé ni modifié, aucun commit de travail n'existe sur le rail pour ce lot dans ce réveil.

## Ce qui bloque

La condition 1 de decision-1 dit : « Avant tout commit contenant le worker, comparer par empreintes la copie iMac et la copie iCloud et consigner la provenance retenue. » C'est une précondition **à l'acte de commit lui-même**, pas une vérification de forme : elle suppose de lire deux copies du worker qui n'existent ni l'une ni l'autre dans ce dépôt, sur deux systèmes (l'iMac de Frédéric, son compte iCloud) auxquels ce réveil n'a et ne peut avoir aucun accès réseau ou disque. `request-1.md` l'avait d'ailleurs déjà noté dans ses « Contraintes dites sans fard » : « La copie du worker de l'iMac n'a pas été comparée à celle d'iCloud (pas d'accès à l'iMac) ».

Les conditions 2 à 5 (scan de secrets, périmètre de fichiers, tests sur textes synthétiques, aucune Production) portent toutes sur un arbre candidat qui n'existe pas encore ici : sans la comparaison d'empreintes de la condition 1, il n'y a ni source à scanner, ni fichier à limiter, ni test à exécuter, ni commit à faire. Ce n'est donc pas un refus de ma part ni une relecture différente de decision-1 : c'est une capacité absente — produire ou faire produire les deux copies à comparer — que ce réveil ne détient pas et qu'aucun outil du dépôt ne peut lui donner.

Je ne contourne rien (aucune tentative d'écrire un `main.py`/`ocr_engine.py` de mémoire sans les deux copies à comparer, ce qui court-circuiterait la condition au lieu de la remplir) et je ne m'arbitre pas moi-même sur le périmètre, déjà approuvé par decision-1.

## Preuve des conditions de decision-1

- *Comparer par empreintes la copie iMac et la copie iCloud et consigner la provenance retenue* — NOT_APPLICABLE : aucune des deux copies n'est accessible depuis ce réveil (pas d'accès iMac, pas d'accès iCloud) ; aucune comparaison n'a donc pu être tentée, ni a fortiori faussée.
- *Scanner l'arbre candidat contre les secrets ; `.gitignore` exclut `.env` ; aucun `.env` ni valeur réelle de `SUPABASE_SERVICE_KEY` versionné ; `.env.example` ne contient que des valeurs factices* — NOT_APPLICABLE : aucun arbre candidat n'existe (aucun fichier worker nouveau dans ce dépôt à ce commit).
- *Limiter les fichiers au périmètre annoncé* — NOT_APPLICABLE : rien n'a été ajouté à `nexus-ocr-worker/` dans ce réveil.
- *Tester uniquement avec des textes synthétiques ou une photo sans personne ni document* — NOT_APPLICABLE : aucun test n'a été exécuté, faute de parseur à tester.
- *Aucun préremplissage, SQL, migration, fusion vers une branche protégée ni déploiement* — VERIFIED : aucune de ces actions n'a été tentée ; seul `docs/handoff/` a été touché par ce réveil.

## Demande

1. Dire qui, concrètement, peut produire la comparaison par empreintes exigée par la condition 1 : si c'est un geste de Frédéric (lecture directe des deux copies sur son iMac et son compte iCloud, puis dépôt du résultat — empreinte retenue et provenance — dans une décision ou un commentaire), le nommer explicitement plutôt que `github-actions-claude`, qui n'a et ne peut avoir cet accès.
2. Si l'intention est que Frédéric dépose directement les fichiers retenus (`main.py`, `ocr_engine.py`, `requirements.txt`, scripts d'installation, `.env.example`) sur ce rail, avec la provenance déjà consignée, dire si un réveil autonome comme celui-ci peut alors enchaîner les conditions 2 à 5 (scan de secrets, limitation du périmètre, tests synthétiques) sans nouvel arbitrage, ou si chaque étape reste à son tour soumise à décision.
3. Aucune action supplémentaire n'est prise par ce réveil sur ce lot avant une réponse.
