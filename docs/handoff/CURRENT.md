<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/ACCUEIL-EN-SERVICE-20261030/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: ACCUEIL-EN-SERVICE-20261030
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=d968c5a0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
---
# ACCUEIL-EN-SERVICE-20261030 : l'Accueil du pompiste en service, refondu selon la maquette

## Contexte
Lot ouvert par l'exécutant local, sous l'autorisation de reprise de Frédéric, sur son GO du 30/10 (relayé par Guardian, commentaire 6520486154 sur #160) et son instruction « Continuez avec le lot Accueil en service ». Le lot JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029 est clos (PR #162, d968c5a0).

Spécification : les principes 1 à 11 validés par Frédéric le 29/10 (dont la correction du commentaire 6510350148) et deux écrans de maquette (« fil en cours », « fil terminé »). Les écrans sont visuels ; les données et heures entre crochets sont des exemples.

## Périmètre proposé (aucune ligne écrite)
1. Une seule police (Inter) avec chiffres tabulaires ; plus de police machine à écrire pour les libellés.
2. En-tête identique à la prise de poste : logo NEXUS à gauche, pastille du site à droite. Plus de phrase de coach animée, plus de badge « Connecté ».
3. Sous « Bonjour [Prénom] », une carte de poste au format de la prise de poste (nom du poste, quart, « En service depuis HH h MM », photo à droite en dégradé `#141B22`). Elle remplace la ligne de service. Taille identique dans tous les états.
4. Bloc « Ouverture de la piste » : les 3 étapes du fil avec leur état, « n sur 3 », un seul bouton principal « Continuer : … ». Fil terminé : « Ouverture de la piste terminée », sans bouton.
5. Tuile « Réception carburant » toujours visible sous le bloc d'ouverture (ambre `#F2B84B`, camion). Sans livraison attendue : « Un camion arrive ? Commencez ici ». Avec une commande attendue aujourd'hui : tuile mise en évidence et « Livraison prévue ce matin · … ». Elle mène à `NEXUS-Carburant-Reception-v1`, selon `station_config.reception_carburant_role`.
6. Pendant le fil, la carte « Missions du jour » n'apparaît pas. Fil terminé : elle apparaît une seule fois, porte l'unique bouton principal « Commencer la mission prioritaire », le total et le lien « Voir les N autres missions ».
7. « Ma progression » devient une ligne compacte, en bas, au-dessus de « Changer de poste » et « Se déconnecter » (discrets).
8. Caisse et renfort : mêmes en-tête et carte de poste si c'est simple ; sinon consigné dans la PR, contenu inchangé.

## Points de vigilance de Guardian (repris tels quels)
1. Pas seulement de l'affichage : le bouton principal mène exactement là où « Reprendre mon début de quart » mène aujourd'hui (`urlRepriseSelonFaits`, étape et plan). L'étape 1 du jaugeage ne doit jamais devenir inatteignable. Le code reprend la valeur `filLien` existante, sans la recalculer.
2. La tuile Réception mène à `NEXUS-Carburant-Reception-v1`, selon `reception_carburant_role`.
3. Périmètre : l'Accueil du pompiste en service.
4. Aucune donnée ni aucun calcul modifié. Épreuves avec mutations au moins sur : un seul bouton principal ; cible du bouton égale à `urlRepriseSelonFaits` ; tuile Réception présente pour le poste Piste.

## Constat sur la date de livraison attendue
La date existe : `carburant_commandes.livraison_prevue_le` (avec `statut` et `carburants`, par `site`). La mise en évidence est donc livrable : lecture seule, commande du site avec cette date égale au jour dans le fuseau de la station et un statut éligible (validee, modifiee, confirmee_fournisseur, hors_nexus). Elle sera testée sur Test si la recette dispose d'une commande à la date du jour ; la PR dira ce qui a été testé.

BRANCHE_DU_LOT: accueil-en-service-20261030

La branche part de `origin/production` (d968c5a0) et porte le code par une PR en brouillon vers `production`. Ce n'est pas le rail.

## À arbitrer
1. Le périmètre est-il le bon, notamment le point 8 (caisse et renfort : en-tête et carte de poste seulement) ?
2. Recette Guardian sur Test, puis fusion le jour même sur le GO de Frédéric seul.

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
