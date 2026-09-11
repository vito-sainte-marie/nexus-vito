---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908
seq: 3
author: Frédéric Bragance
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-3.md
---
# Le renvoi est ajouté, et le lot se ferme

## Ce qui est tranché

Frédéric Bragance fait ajouter à la section « Agents NEXUS » de
`docs/nexus/BIBLE.md` la phrase de renvoi proposée en `§5.1` de l'audit :

> Le vocabulaire officiel et le ton par destinataire sont définis dans `docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md`.

Elle avait été écartée deux fois, pour la même raison à chaque fois : sa cible
n'existait pas. Un renvoi vers un fichier absent donne l'apparence d'une
doctrine adossée à un texte, et une lecture rapide ne voit pas ce vide. Le
document existe depuis `88048a7` ; l'obstacle est levé, et l'arbitrage a été
demandé plutôt que présumé.

Une garde vaut désormais pour TOUS les renvois de la Bible, pas seulement
celui-ci : aucune cible citée ne peut manquer sans que la CI le dise.

## Ce que ce lot a produit

- `§4.1` portée de LANG-003 arbitrée (portée 1), garde `outils/garde-langage-nexus.js`
  calibrée et bloquante en CI, plafond par fichier qui ne peut que descendre.
- `§4.2` note de révision de `NEXUS-Constitution-v1.md` marquant les articles 12
  et 13 comme partiellement historiques, sans les réécrire.
- `§5.1` deux principes ajoutés à la Bible, chacun rattaché à un mécanisme
  vivant et vérifié en CI, plus ce renvoi.
- `§5.2` `docs/nexus/DOCTRINE-LANGAGE-VOCABULAIRE.md`, qui ne recopie aucune
  vérité vivant dans le code.
- `§5.3` respecté : aucune entrée `RULES.json` dupliquée.

Hors périmètre du lot mais rendu possible par lui : `LANG-004`, la propagation
du renommage des agents, close le même jour.

## Ce que ce lot ne ferme PAS

Le chantier de réécriture des 1 481 occurrences de tiret cadratin dans le
contenu affiché. Il est suivi hors de ce lot, et son aggravation est empêchée
par le plafond par fichier. Le fermer ici laisserait croire qu'il est réglé.
