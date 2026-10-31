---
protocol: nexus-handoff/2
kind: request
lot_id: FERMETURE-PISTE-20261031
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=840bb0c6
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 169-fichiers
  - id: merge-pr166
    classe: VERIFIED
    valeur: 840bb0c6d51628fb5188f99fbc8c2b19a1674495
---
# FERMETURE-PISTE-20261031 : request-3 — demande de clôture, code fusionné et déployé

BRANCHE_DU_LOT: fermeture-piste-20261031

## Contexte

Le code du lot a été fusionné par Frédéric (PR #166, merge `840bb0c6` sur `production`, tête de branche `1170035f`) et déployé ; les checks Tests et Déploiement Production sont verts. Le Guardian a rendu ses recettes sur le canal #160 et m'a invité à déposer cette clôture par l'outil.

## Preuve des conditions de decision-1

1. **« Pointer mon départ » sans écriture dans `shifts` ni migration** — TENUE. Le bouton n'apparaît que si `station_config.pointage_actif` est vrai ; sinon « Se déconnecter ». Aucune migration, aucune écriture `shifts`. Recettes Guardian : #160 6545741605 et 6545912158.
2. **Horaires lus dans `station_config.horaires`, régime normal/étendu, fuseau de la station** — TENUE (carte de poste « fin à HH h MM »), recettes Guardian ci-dessus.
3. **Formule du matin conservée, sous-ligne du soir omise** — TENUE.
4. **Clôture anticipée éprouvée sur Test avant adaptation** — TENUE par le Guardian : #160 6543935953.
5. **Épreuves de mutation, écran de choix du manager préservé** — TENUE : `test_fermeture_piste_20261031.js`, 21 épreuves, 28 mutations tuées ; CI verte. Contenu servi vérifié par le Guardian sur app.nexusconseil.net.

## Ce qui change

Fil de fermeture en deux étapes (index de fin, inventaire de clôture), bloc de fermeture avec étapes et barre, récapitulatif réel (coche seulement si fait), carte de poste avec heure de fin, bouton de départ conditionné au pointage actif.

## Limites restantes

1. **Correctif d'ordre de la plage « Fermeture » NON fusionné** : le commit `dd89e844` (tri des deux bornes horaires) est resté sur `fermeture-piste-20261031`, la fusion ayant eu lieu à `1170035f`. Il n'est pas en Production. À refaire par une nouvelle PR dans le lot suivant.
2. Heure de début d'ouverture inconnue (borne unique) dans le récapitulatif.
3. Règle normal/étendu locale distincte de la RPC `calculer_horaires_quart` : vigilance non bloquante.
4. « Pointer mon départ » non exercé en navigateur sur Test (`pointage_actif` faux sur Test et Sainte-Marie).
5. decision-2 de l'arbitre précédemment non matérialisée (job CI de non-régression en échec à l'époque).

## À arbitrer

Le lot FERMETURE-PISTE-20261031 peut-il être clos (CLOSES: true), les limites 1 à 5 étant reportées au lot suivant ? Aucune opération en Production de ma part.
