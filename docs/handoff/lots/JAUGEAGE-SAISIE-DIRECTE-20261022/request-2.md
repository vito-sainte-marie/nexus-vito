---
protocol: nexus-handoff/2
kind: request
lot_id: JAUGEAGE-SAISIE-DIRECTE-20261022
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
---
# LOT : JAUGEAGE-SAISIE-DIRECTE-20261022 — exécution faite, PR brouillon non ouverte (capacité absente de cette session)

## Exécution de decision-1 (APPROVED, closes:false)

Les cinq points du périmètre sont implémentés sur une branche créée depuis
`origin/production` (jamais depuis la branche locale du rail, qui était en
retard de plusieurs lots sur ce fichier) :

- `LIB_STATUT.en_attente` devient « Photo enregistrée. Saisissez les quatre
  volumes affichés sur l'écran du Veeder-Root. » ; le focus va au premier
  champ vide après un envoi réussi (`focusPremierVolumeVide()`).
- « elle peut tarder » supprimé ; le mot « échec » n'apparaît plus nulle part
  sur cet écran.
- « Actualiser la lecture » : nouvelle classe `.lien` (discrète), plus `.btn2`
  (bouton plein).
- Une lecture tardive ne remplit que les champs encore vides et ne touche
  jamais une saisie déjà présente (`fusionnerLectureTardive`, fonction pure
  nouvelle de `nexus-releves-piste.js`) ; dès qu'une lecture exploitable
  arrive, la confirmation se décoche.

Code : commit `6c20b192`, branche `lot-jaugeage-saisie-directe-20261022`,
poussée sur `origin`.

## Preuves

- `test_jaugeage_saisie_directe_20261022.js` : 14/14 verts sur le code final.
- Rouge avant chaque correction, vérifié un à un par mutation locale de
  l'état courant (jamais une réécriture après coup), puis restauration :
  texte `en_attente`, classe du bouton `jrafraichir`, ligne de focus après
  envoi, et `fusionnerLectureTardive` mutée pour toujours écraser une saisie
  — les quatre mordent.
- Suite complète : 290/297, mêmes 7 échecs pré-existants que
  `origin/production` (inventaire deux lieux, réception moteur/DOM) — aucune
  régression introduite par ce lot.
- Compte rendu détaillé :
  `docs/executions-lot-JAUGEAGE-SAISIE-DIRECTE-20261022.md` (commit déposé
  avec cette demande, hors de `docs/handoff/`).

## Ce qui arrête ce réveil : capacité absente, pas une gate NEXUS

La conduite approuvée par decision-1 prévoyait une PR brouillon vers
`production`. Trois appels (`gh pr create`, puis une variante simplifiée,
puis `gh pr list` en lecture seule) ont chacun été refusés par la passerelle
d'autorisation de l'outil Bash de cette session (« This command requires
approval »), sans qu'aucun humain ne soit présent pour l'accorder dans ce
réveil autonome. Aucune règle de `PROTOCOL.md` ni de `CLAUDE.md` n'interdit
la PR brouillon — à l'inverse, c'est la conduite explicitement approuvée ;
c'est l'outillage `gh` qui n'a pas pu s'exécuter dans CETTE session. Rien
n'a été contourné : pas de réessai au-delà de trois appels, pas de création
de la PR par une autre voie (API brute, jeton), pas d'auto-arbitrage.

`git push` a imprimé le lien de création directe :
https://github.com/vito-sainte-marie/nexus-vito/pull/new/lot-jaugeage-saisie-directe-20261022

Le code n'a pas besoin d'être rejoué : il est déjà sur la branche, prouvé par
l'épreuve ci-dessus. Un geste humain (un clic sur ce lien) ou une session
future disposant de l'autorisation `gh` peut ouvrir la PR.

## Restant humain, dans l'ordre

1. Ouvrir la PR brouillon (lien ci-dessus).
2. Recette sur iPhone (aperçu Test, format téléphone) par un pompiste sans
   aide, chronométrée de la photo à l'enregistrement — non exécutée dans
   cette session : pas de Playwright installé localement, worker OCR en
   panne au 22/10 (diagnostic déjà connu), aperçu Cloudflare Pages pas
   encore construit faute de PR ouverte.
3. Aucune fusion ni déploiement sans le GO de Frédéric (palier
   PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION).

## À arbitrer

Consigner cet arrêt (capacité `gh` absente de cette session, pas une gate) et
dire si une session future doit seulement ouvrir la PR et exécuter la
recette, ou si autre chose est attendu avant.
