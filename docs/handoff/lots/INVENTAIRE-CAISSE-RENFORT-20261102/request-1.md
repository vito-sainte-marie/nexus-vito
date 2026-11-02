---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5d9650c9
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 172-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-1 — conception de l'inventaire et du contrôle de la caisse et du renfort

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

Lot de **conception** ouvert sur cadrage de Guardian (#160, 6580639504), mandat de Frédéric (chat, 02/11) : trouver avec l'arbitre la formule d'inventaire et surtout de contrôle fiable de la caisse et du renfort. Aucun code dans ce lot ; les lots d'implémentation suivront, chacun arbitré. Le lot MODE-JOUR-POMPISTE-20261102 est clos (decision-2 `closes: true`, consommée, 80290c27).

Base : audit du 31/10 (https://claude.ai/artifact/Q5BqiJ3BkrAs1u3SpLNsGR) : 0 comptage caisse/renfort depuis le 15/09, papier 232 saisies/jour, Photo Decenium jamais utilisée (dernières ventes importées le 03/08).

## Délégation de Frédéric

L'arbitre et Guardian tranchent tout ce qui n'est pas une porte : horaires des créneaux, nombre de références, délais maximaux sans comptage, écrans, découpage. Frédéric n'est sollicité que pour : Production, sécurité / RLS (SECURITE_RLS_SITE_ID), secrets, toute nouvelle règle imposée aux employés.

## Décisions de Frédéric (définitives pour ce lot)

1. **Papier** : en parallèle 7 jours par famille après sa bascule dans NEXUS, puis arrêt.
2. **Changement de quart caisse** : l'entrante compte seule ; ce comptage unique clôt Q1 et ouvre Q2.
3. **Photo Decenium** : le manager exporte ventes + stock chaque soir à la fermeture.
4. **Règles du 31/10** : contrôle par cycle (ventes sur le cycle → attendu = comptage précédent − ventes + entrées ; aucune vente prouvée par un export couvrant tout le cycle → comparaison directe au stock Decenium) ; cigarettes : seulement le stock en caisse ; boissons : dépôt puis frigo ; le manager ne voit que les anomalies confirmées et corrige le stock de départ (correction tracée).

## Proposition de Guardian, à contester

| Moment | Qui | Quoi | Contrôle |
| --- | --- | --- | --- |
| Début Q1 (5 h 45) | Caissière Q1 | Cigarettes (28) à l'aveugle + réception des produits du jour livrés | Continuité nuit avec la fin Q2 de la veille |
| Changement de quart | Entrante seule | Cigarettes + CBD + produits du jour, un seul comptage | Frontière Q1 / Q2 |
| Fermeture Q2 | Caissière Q2 | Cigarettes + CBD + produits du jour | Puis Photo Decenium du soir → contrôle par cycle de la journée |
| Créneaux calmes | Renfort (repli : caissière Q2, 6 réf.) | Roulement boissons (dépôt puis frigo), huiles, lave-glace / liquide de refroidissement, petits articles : 6–10 réf. + 1–2 surprises, chaque réf. au moins tous les N jours | Cas « sans vente » contre le stock Decenium du soir |

## Prérequis connus

- La caissière n'est presque jamais inscrite au quart d'inventaire : ses missions ne lui arrivent pas (fil caisse).
- Défaut A (UPDATE du cycle d'observation refusé à l'employé) : bloquant pour le contrôle ; implémentation sous SECURITE_RLS_SITE_ID (GO Frédéric).
- Import Photo Decenium à éprouver avec de vrais fichiers sur Test.
- Alertes héritées ouvertes (278 écarts d'ouverture, 89 anomalies répétées d'août, 61 clôtures en retard) à classer avant la vue manager.

## Découpage proposé (à arbitrer)

L1 fil caisse (inscription au quart, ouverture / changement / fermeture, cigarettes à l'aveugle) · L2 Photo Decenium du soir + contrôle par cycle (avec et sans vente) · L3 roulement du renfort aux heures calmes · L4 défaut A + vue manager « anomalies confirmées seulement » + classement des alertes héritées · L5 détection de la recopie.

## Demande

Arbitrage APPROVED ou APPROVED_WITH_CONDITIONS, `closes: false` (la conception précède les lots d'implémentation), qui fixe :

1. la formule retenue : matrice moments / acteurs / contenus, règles de contrôle, valeurs de N, créneaux et nombre de références ;
2. le traitement des limites : (a) contestation de Q1 quand l'entrante compte seule (ex. recomptage ciblé de la sortante sur demande du manager) ; (b) ordre « NEXUS d'abord, papier ensuite » pendant les 7 jours de papier, qui est une consigne aux employés donc une porte (validation de Frédéric dans le message d'équipe) ; (c) N, créneaux et nombre de références, à partir des données disponibles ;
3. le découpage et l'ordre des lots L1 à L5, en marquant lesquels franchissent une porte.

## Limites

Aucun code, aucune migration, aucune policy, aucun grant. Aucune lecture ni écriture Production par l'exécutant ; les mesures Production nécessaires sont faites par Guardian sous le GO de lecture de Frédéric.
