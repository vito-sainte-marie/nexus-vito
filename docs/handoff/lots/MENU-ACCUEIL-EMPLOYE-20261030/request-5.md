---
protocol: nexus-handoff/2
kind: request
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=d799fa58
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 167-fichiers
---
# MENU-ACCUEIL-EMPLOYE-20261030 : request-5 — arrêt sur gate humaine (fusion de la PR #164 vers `main`)

BRANCHE_DU_LOT: menu-accueil-employe-20261030

## Contexte

decision-3 (5c301f0e, APPROVED, closes:false) arbitre request-4 : elle approuve
la consignation des trois corrections postérieures à la clôture (bouton ☰
blanc, bouton ☰ à l'extrême gauche, entrée Pointage conditionnée à
`station_config.pointage_actif`), déjà livrées sur la branche du lot (commit
`eb77b3ae`, PR #164, toujours en brouillon). Son texte le dit explicitement :
« l'approbation porte uniquement sur la consignation des corrections ; elle
n'autorise aucune fusion vers une branche protégée. »

## Preuve des conditions de decision-3

decision-3 ne pose aucune condition (`CONDITIONS: aucune` dans son contrat) :
il n'y a rien à prouver au-delà de ce que request-4 avait déjà prouvé (épreuves
`test_menu_accueil_20261030.js` et `test_accueil_hors_service_20260918.js`
vertes, suite complète aux sept mêmes échecs que la base, aucun de plus,
aucune colonne, aucune migration, aucune action Production). Ce dépôt ne porte
donc aucune nouvelle preuve de condition : il consigne l'arrêt qui suit.

## Pourquoi cette session s'arrête ici

La seule suite concrète pour ce lot est la fusion de la PR #164
(`menu-accueil-employe-20261030` → `main`), explicitement exclue par decision-3
et conditionnée par request-4 au « GO de Frédéric requis ». Toute modification
de `main` est une gate humaine jamais pré-autorisée (`CLAUDE.md`, section
« Gates humaines — jamais pré-autorisées »). Cette session n'a reçu aucun GO de
Frédéric pour fusionner : elle n'a donc rien d'autre à exécuter que la prise en
charge de decision-3, déjà faite, et le présent constat. Elle ne s'arbitre pas
elle-même et ne contourne pas la gate.

## À arbitrer

Le lot reste ouvert (decision-3, closes:false) dans l'attente du GO de
Frédéric pour fusionner la PR #164. Dès ce GO donné hors de ce dépôt, la
fusion elle-même reste un geste humain ; une demande de clôture suivra après
la fusion effective, comme l'annonçait déjà request-4.
