---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-OCR-20261021
seq: 3
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
    valeur: iMac=iCloud sur 6 fichiers (shasum -a 256)
  - id: vision-photo-propre
    classe: VERIFIED
    valeur: 4 volumes, 4 hauteurs, 4 temperatures exacts, ~1 s
---
# JAUGEAGE-OCR-20261021 : extension de périmètre (moteur Vision, Broadcast, lecture proposée) et preuves des conditions 1 et 2 de decision-1

**Suite de :** decision-1.md (APPROVED_WITH_CONDITIONS, closes: false) et request-2.md (arrêt consigné par la CI, qui n'avait pas accès à l'iMac ni à iCloud). Cette demande remplace request-2 : la condition qui bloquait est remplie ici, côté session de Frédéric, qui a accès aux deux copies.

## Preuve des conditions de decision-1

### Condition 1 : comparaison des copies et provenance

Le 21/10/2026, copie du worker de l'iMac comparée à celle d'iCloud par `shasum -a 256`, fichier par fichier : **identiques** (sortie collée par Frédéric). Provenance retenue : la copie iCloud (identique à celle de l'iMac).

- main.py `b20132f8…52ec4`
- ocr_engine.py `20e3870c…17b1f`
- dossier_watcher.py `04653bdf…8e6d7`
- requirements.txt `e5ee7382…81f90`
- install_mac.sh `10f8569f…218f1`
- installer_demarrage_auto.sh `0f46b1e7…cd131`

### Condition 2 : secrets

Scan des six fichiers et de `.claude/settings.local.json` : aucun résultat positif. Limites dites sans fard : l'historique git de l'ancienne copie suivie de `dossier_watcher.py` n'est pas relu, et le `.env` de l'iMac n'est pas vérifiable d'ici (jamais versionné). `.gitignore` exclut `.env` et `.env.local` (lignes 25–27). L'arbre candidat sera rescanné avant le commit et le résultat consigné dans la PR. `.claude/` et les rapports `.md` ne seront pas versionnés.

## Ce qui a été mesuré depuis decision-1

Une photo propre de l'écran Veeder-Root (aucune personne, aucun document ; 1080×1920) lue par le moteur Vision d'Apple via un exécutable Swift : les quatre volumes, hauteurs et températures sont exacts, en environ 1 s démarrage compris. Deux lectures fautives sur la photo : le produit d'une cuve (`GO` lu `-50`) et une valeur à confiance 0,30 (juste). **Conséquence pour le lot :** l'écran est une grille de quatre blocs ; un parseur qui lit les nombres dans l'ordre du texte attribue mal les valeurs. Le parseur est réécrit par regroupement de position (boîtes englobantes), testé sur la sortie réelle de Vision. PaddleOCR n'a pas été comparé (non installé ; Frédéric a refusé son installation).

## Extension de périmètre demandée

1. **Moteur :** pour `type_document = jaugeage_veeder_root` seulement, le worker appelle un exécutable Swift qui utilise le moteur de reconnaissance de texte Vision. PaddleOCR et OCRmyPDF restent pour les autres documents. L'exécutable est versionné (source), non le binaire.
2. **Notification :** Supabase Realtime en mode Broadcast, sans aucune modification de la base (ni migration, ni publication, ni RLS). Le client envoie un ping `{doc_id}` après le dépôt ; le worker accuse réception aussitôt, puis écrit le résultat dans la ligne (comme aujourd'hui) et envoie un ping « terminé » `{doc_id}`. **Aucune valeur de jaugeage ne transite par le canal** : le client relit la ligne avec ses droits habituels. Le nom du canal ne porte aucune donnée. Le polling reste en secours.
3. **Lecture proposée dans l'écran de jaugeage :** à côté de chaque champ, la valeur lue et un bouton « Utiliser » ; **jamais de pré-remplissage**, le pompiste valide. Une valeur peu sûre (confiance < 0,5, seuil provisoire à recalibrer sur les photos) ou supérieure à la capacité de la cuve est signalée et non proposée.
4. **Délai :** si le worker n'accuse pas réception dans les 3 secondes, l'écran dit clairement que le Mac ne répond pas et que la saisie manuelle reste possible. Objectif : lecture proposée en moins de 3 s quand le Mac est disponible.

## Hors périmètre, inchangé

Aucun SQL, aucune migration, aucune fusion vers `main` ou `production`, aucun déploiement en Production sans GO de Frédéric. Aucun secret versionné. L'écran HTML touché le sera dans une PR séparée vers `main`, sans fusion sans GO.

## À arbitrer

- Le canal Broadcast public (clé anonyme) est une surface : tout porteur de la clé anonyme peut envoyer un ping `{doc_id}` ; effet pire cas : un réveil inutile du worker. Aucune donnée n'est exposée. Acceptable sans canal privé (qui exigerait la base) ?
- Le seuil de confiance provisoire (0,5) sera recalibré après une quinzaine de photos que Frédéric prend sur l'aperçu Test (éclairages et angles différents) ; le taux de lecture exacte par volume sera rapporté.

## Contraintes dites sans fard

- Le parseur et le moteur Swift n'ont été validés que sur une photo ; la quinzaine reste à faire.
- Le Broadcast n'a été ni écrit ni testé : cette demande en demande l'arbitrage avant.
- Le temps de 3 s est mesuré hors réseau pour le moteur (≈1 s) ; la chaîne complète n'est pas mesurée.
