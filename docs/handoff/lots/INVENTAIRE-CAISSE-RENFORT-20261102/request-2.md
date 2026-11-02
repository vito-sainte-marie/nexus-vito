---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
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
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-2 — décisions de Frédéric du 02/11 (plus de feuille, démarrage en pilote) et cadrage de L1

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

La decision-1 (APPROVED_WITH_CONDITIONS, `closes: false`, 3c4fbcbe) est prise en charge (33db955d). Deux décisions de Frédéric, relayées par Guardian sur #160, la modifient ; elles sont portées ici pour arbitrage avant d'ouvrir L1.

## Décisions de Frédéric rendues (citées)

1. **Plus de feuille** (#160, 6581332505, chat 02/11 11:41) : elle **remplace** la décision 1 du cadrage 6580639504. Papier : arrêt dès la bascule de chaque famille dans NEXUS, pas de 7 jours en parallèle. La porte (b) « NEXUS d'abord, papier ensuite » de decision-1 §4 devient sans objet. La consigne « à partir de la date de bascule d'une famille, on ne la compte plus que dans NEXUS » est décidée par Frédéric ; sa communication se fait à la mise en Production de chaque lot, la date de bascule étant fixée avec lui à ce moment-là.
2. **Démarrage en pilote** (#160, 6581363357, chat 02/11 11:43) : la tâche est confiée à **une seule employée** en caisse et en renfort, pas à tout le personnel. Guardian demande à Frédéric si c'est une personne pour les deux rôles ou une par rôle ; la réponse sera postée sur #160.

Le reste de decision-1 est inchangé (matrice, N = 7 jours puis 3, fenêtres, 8 et 6 références, tolérance nulle, recomptage à l'aveugle, ordre des lots, portes SECURITE_RLS_SITE_ID et PRODUCTION_*).

## Preuve des conditions de decision-1

Aucune condition n'est encore mise à l'épreuve : le lot n'a produit que de la conception, aucun code.

- Matrice, N = 7 puis 3, fenêtres 9 h 30–11 h 30 et 14 h 30–16 h 30, 8 références renfort et 6 en repli : reprises sans changement ci-dessus (« Le reste de decision-1 est inchangé »).
- Import Decenium éprouvé sur Test avant L2b : non commencé ; L2a précède L2b dans l'ordre retenu, rien n'est livré en L2b.
- Alertes héritées classées avant la vue manager : non commencé ; L4b n'est pas ouvert.
- Ordre « NEXUS d'abord » et nouvelles consignes terrain : l'ordre est abandonné par Frédéric (6581332505) ; la consigne « on ne compte plus que dans NEXUS après la bascule » est une décision de Frédéric, non communiquée aux employés par l'exécutant.
- Défaut A sous SECURITE_RLS_SITE_ID : aucune policy touchée ; L4a non ouvert.
- Aucune opération Production : aucune lecture ni écriture Production par l'exécutant depuis decision-1 (commits du rail 33db955d seulement, CI verte).

## Conséquences à faire arbitrer (L1)

1. **Activation par employée**, pas pour tout le site : les missions caisse / renfort et le fil caisse ne s'ouvrent que pour l'employée pilote ; les autres ne voient rien de nouveau. Proposition de l'exécutant : un réglage par employée dans Paramètres, posé par le manager, lu côté serveur ; l'employée non pilote garde exactement l'écran actuel. Si ce réglage exige une table, une colonne, une policy ou un grant, la partie base de données passe par SECURITE_RLS_SITE_ID avant toute migration.
2. **Papier** : l'arrêt dès la bascule vaut pour l'employée pilote ; les autres continuent la feuille jusqu'à leur bascule.
3. **Contrôle pendant le pilote** : les frontières de quart ne sont pas toutes comptées dans NEXUS. Le contrôle par cycle ne vaut que pour les cycles bornés par deux comptages NEXUS ; les autres restent « non calculable » (règle 3 de decision-1), jamais une anomalie imputée à la pilote.
4. **Mesure de réussite du pilote**, à proposer par l'arbitre : par exemple taux de missions faites, temps de comptage, écarts confirmés contre erreurs de saisie, sur 7 à 14 jours, avant d'élargir.

## Demande

Arbitrage APPROVED ou APPROVED_WITH_CONDITIONS, `closes: false`, qui :

1. acte que decision-1 §4 (papier 7 jours, porte (b)) est remplacée par la décision 1 ci-dessus ;
2. fixe la forme de l'activation par employée, l'ordre de ses sous-étapes et laquelle franchit une porte ;
3. confirme la règle « cycle non borné par deux comptages NEXUS = non calculable » ;
4. fixe la mesure de réussite et la durée du pilote ;
5. autorise L1 (fil caisse, pour l'employée pilote seulement) à démarrer en conception puis code sur Test.

## Limites

Aucun code, aucune migration, aucune policy, aucun grant dans cette request. Aucune lecture ni écriture Production par l'exécutant. La communication de la consigne aux équipes et toute mise en Production restent à Frédéric.
