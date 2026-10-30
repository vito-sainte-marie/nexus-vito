<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/RELEVES-FIN-QUART-20261030/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: RELEVES-FIN-QUART-20261030
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=e4e4c75c
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 168-fichiers
---
# RELEVES-FIN-QUART-20261030 : request-1 — correctif d'affichage fusionné (PR #165), demande de clôture

BRANCHE_DU_LOT: releves-fin-quart-20261030

## Contexte

Correctif rapide demandé par Frédéric le 30/10 après la recette de l'Accueil pompiste : le relevé des index de fin de quart n'était atteignable ni depuis le menu ni depuis l'Accueil, et les étapes de l'Accueil étaient jugées sur un quart qui n'était pas celui du service. Affichage seulement : aucune donnée, aucune règle, aucune migration.

## Preuve des conditions

Lot nouveau : aucune décision antérieure, donc aucune condition à prouver.

## Arbitrage a posteriori : à dire, pas à taire

Cette demande arrive APRÈS le code et la fusion. C'était un correctif urgent d'une régression en Production, codé et fusionné (e4e4c75c) sur GO de Frédéric avant toute request. Il contient des choix produit de Frédéric : bouton secondaire pour « Fin de quart », visibilité de la ligne dès la fin du fil, entrée de menu pour tout employé en service. La condition 1 de l'arbitrage a posteriori (aucun choix métier) n'est donc PAS remplie. Je ne la présente pas comme remplie ; l'arbitre juge en connaissance de cause.

## État livré

- PR #165 fusionnée par Frédéric dans `production` : e4e4c75c (30/10, 20 h 42 UTC), base `production` vérifiée. Dernier commit de la branche : 1bb9b673.
- Menu : entrée « Relevés d'index » pour tout employé en service (le Jaugeage reste réservé au manager).
- Accueil : ligne « Fin de quart : relevé des index » dès que le fil d'ouverture est terminé, vers fin_q1 (matin) ou fin_q2 (soir), masquée quand ce relevé est final. Après la retouche demandée par Frédéric (Guardian 6532952810), c'est un bouton secondaire encadré sous « Commencer les missions », qui reste le seul bouton principal.
- Étapes de l'Accueil jugées sur le quart du service (`quartDuJour`, jamais l'horloge) ; jamais d'étape « à faire » sans bouton.
- `momentFinDuQuart` ajouté à `nexus-releves-piste.js`.
- Épreuves : `test_releves_fin_quart_20261030.js` (nouveau, avec mutants dont « bouton plein » et « avant les missions »), `test_menu_accueil_20261030.js` étendu ; deux anciennes gardes de source réalignées. `run-tests.js` : 7 échecs, identiques à la base.
- Contrôle Guardian de 1bb9b67 sur l'aperçu : conforme (#160, 6533052284). Rien de ma part en Production.

## Limites déclarées

1. Aucune donnée ne dit « fin de journée » : la ligne de fin de quart apparaît dès que le fil d'ouverture est terminé, pas 45 min avant la fin. Frédéric a accepté ce comportement pour ce correctif ; le lot suivant (FERMETURE-PISTE) le reprendra.
2. Jugement de ma part : `inventaireFait` accepte aussi `a_valide_ouverture`. À confirmer ou à retirer.
3. La logique « quart du service » a été relue dans le diff et couverte par les épreuves, pas rejouée en navigateur de bout en bout.

## À arbitrer

Le lot est-il consigné comme livré et clos, avec les limites 1 à 3 acceptées ? Hors lot : libellés du relevé des index, écran manager `anomalie_nuit`, réglage « Inventaire renfort », puis FERMETURE-PISTE (qui commencera par établir quelle règle existante choisit fin_normal ou fin_etendu).
