<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CHAINE-INITIALISATION-20261027/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CHAINE-INITIALISATION-20261027
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
---
# INVENTAIRE-CHAINE-INITIALISATION-20261027 : la chaîne d'initialisation du quart d'Inventaire

## Contexte
`INVENTAIRE-RELECTURES-20261024` (clos, decision-3 APPROVED) a ramené 42 à 32 requêtes mais n'a pas gagné de temps à la première ouverture du soir : 3,7 s avant, 3,8 s après, contre 3 s visées. Sa request-3 (point 3) nomme le poste dominant restant : la chaîne d'initialisation du quart. `inventaire_quarts`, `inventaire_quart_employes` et `inventaire_plans_comptage` y sont lus 4 fois chacun, en séquence, donc sur le chemin critique. La decision-3 a fixé l'ordre : « Jaugeage Carburant » d'abord, puis ce lot.

Le lot OUTILLAGE-REGULARISATION-20261026 est clos et consommé (decision-6, `9e999c7e`, registre vérifié par `verifier`, aucun lot actif). Ce lot est ouvert par l'exécutant local sous l'autorisation de reprise de Frédéric, sur son instruction.

BRANCHE_DU_LOT: inventaire-chaine-initialisation-20261027

Cette request-2 reprend la request-1 sur le fond ; elle ajoute le marqueur `BRANCHE_DU_LOT` que la request-1 omettait (la CI a refusé de matérialiser la réponse de l'arbitre, run 40489589183). La branche, créée depuis `origin/production`, portera le code d'Inventaire par une PR vers `production` ; ce n'est pas le rail. La request-1 n'est pas réécrite.

## Périmètre proposé (aucune ligne écrite)
1. Lire la chaîne d'initialisation du quart de bout en bout et établir, par mesure et non par lecture du code seule, quelles lectures des trois tables sont réellement en série sur le chemin critique.
2. Proposer la réduction (une lecture par table et par quart, ou parallélisation) sans changer ce qui est calculé.
3. Mesure Claude Guardian sur Test, même compte et même quart, avant et après. Production non touchée.

## Trois défauts de la boucle à traiter dans un lot d'outillage suivant
Notés ici, non diagnostiqués, aucune permission élargie.
1. **`closes: true` donne NO_WORK alors que la consommation de clôture reste à faire.** Sur OUTILLAGE-REGULARISATION-20261026, la boucle a conclu « RIEN_A_FAIRE : la décision clôt le lot » (run 40423055350) alors que le registre restait en ATTENTE_DECISION sur request-7. Il a fallu `consommer --cloture` à la main.
2. **15 refus de permission du runner en deux tours sur ce même lot.** Il faut établir lesquels avant d'élargir quoi que ce soit : toute nouvelle permission relève d'une gate humaine. Je n'en ai pas demandé et n'en demande pas ici.

3. **`handoff.js demande` accepte une request sans `BRANCHE_DU_LOT` valide.** La request-1 de ce lot est partie ainsi et la CI a refusé la décision de l'arbitre. L'outil doit refuser avant écriture, comme il le fait déjà pour les classes de preuve.

Rappel du constat déjà consigné en request-7 : aucun tour complet du runner seul depuis le 25/10 ; la PR #159 rend le premier cas visible ; le non-déclenchement est à diagnostiquer dans ce lot d'outillage.

## À arbitrer
1. Ce lot s'ouvre-t-il maintenant, ou après « Jaugeage Carburant » comme l'ordonnait la decision-3 ? Si l'arbitre l'ouvre ici, quel est l'état de « Jaugeage Carburant » ?
2. Le lot d'outillage sur les deux défauts de la boucle doit-il être ouvert avant ou après celui-ci ?

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
