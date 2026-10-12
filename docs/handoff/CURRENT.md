<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011/request-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CONTINUITE-QUANTITE-ABSENTE-20261011
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c516322 production=13a4e56
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 146-fichiers
  - id: registre-production
    classe: VERIFIED
    valeur: 310
  - id: code-deploye
    classe: VERIFIED
    valeur: main-production-13a4e56
  - id: recette-ecriture
    classe: VERIFIED
    valeur: aucune
---
## Objet

Compte rendu de la recette Production du lot, demandée par Frédéric (« go recette Production », 12/10/2026). Elle est **partielle** : tout ce qui se constate en lecture seule est constaté et conforme ; la part qui dépend d'un quart employé réel n'est pas encore observable.

## Constaté (lecture seule, sous `begin read only` puis `rollback`)

- Code servi par `app.nexusconseil.net` identique à `origin/production` (`13a4e56`) : `NEXUS-FDJ-v1.html` et `nexus-fdj-moteur.js`, comparés après retrait des lignes `<script src>` (le build réécrit `?v=`).
- Base : migration `20261011220000` en place, registre 310, neuf md5 de fonctions égaux à Test, droits conformes.
- Aucune ligne `confirmation_stock_final_zero` ni `stock_final_zero_automatique` écrite.
- `fdj_stocks_finaux_a_confirmer`, appelée en lecture seule sur les deux brouillons existants, rend le résultat attendu : `a646dfd7` signalerait 24 jeux à stock disponible plus Mission Patrimoine « stock de départ inconnu » ; `64138d8c` signalerait les 29 jeux « stock de départ inconnu ».

## Non constaté

- Le quart `64138d8c` (12/10, quart 1) est en brouillon avec 0 ligne de comptage : on ne sait pas s'il vient d'être ouvert ou si la complétion de continuité ne s'est pas déclenchée. Le point 5 de la procédure (autant de lignes que de jeux actifs, Mission Patrimoine à 0) n'est pas constaté. Ce n'est pas un défaut établi.
- Fenêtre « Confirmer 0 / Corriger la saisie », 0 automatique tracé `stock_final_zero_automatique` et relevé définitif : ils ne se constatent qu'au premier quart employé clôturé avec le nouveau code.

## Demandé

Enregistrer la recette Production comme **partielle**, la lecture seule étant conforme. Aucun GO nouveau n'est demandé ; aucune écriture Production n'a été faite pour cette recette.

## Non demandé

Création de quart ou de comptage de recette, régularisation de `539e87bc`, retour arrière de `20261011220000`. Le constat du volet manquant se fait par constat passif au premier quart employé clôturé, ou sur désignation explicite d'un quart de recette.
