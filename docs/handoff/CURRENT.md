<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-GAZ-CAGE-20261031/request-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=bd7c2dbf
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 170-fichiers
  - id: branche-correctif
    classe: VERIFIED
    valeur: f11b845e
  - id: recette-guardian
    classe: VERIFIED
    valeur: 160-6566620915
  - id: ci-verte
    classe: HUMAN
    valeur: 160-6566620915
  - id: decision-alertes-production
    classe: HUMAN
    valeur: chat-frederic-fermeture-manuelle-a-la-fusion
---
# INVENTAIRE-GAZ-CAGE-20261031 : request-5 — rectificative de la request-4 (branche du lot non déclarée)

## Objet

La décision rendue sur la request-4 (APPROVED, `closes: false`, commentaire 6567010705 de #28, run 41373252432) n'a pas pu être matérialisée par la CI : la request-4 ne déclare pas de branche du lot, et la CI ne prend jamais le rail par défaut. Le même défaut bloque le rail depuis la request-2. Cette request-5 le rectifie et n'ajoute rien d'autre : le fond de la request-4 est inchangé.

## Branche du lot

Le correctif vit sur `inventaire-ecart-aveugle-20261101`, commit `f11b845e` (base `production` `bd7c2dbf`, CI verte, recette Guardian 6566620915 conforme). La branche du lot est déclarée ici, une seule fois :

BRANCHE_DU_LOT: inventaire-ecart-aveugle-20261101

## Ce qui reste valable

- La request-4 (correctif de la régression de l'écart d'ouverture introduite par #168, qui remplace la demande de clôture de la request-3) et la décision de l'arbitre qui lui répond : APPROVED du correctif en l'état, `closes: false`. Le lot reste ouvert jusqu'à une demande ultérieure établissant que le correctif est fusionné et servi.
- Les 5 alertes `ecart_ouverture` de Production : non touchées par cette session ; Frédéric les ferme lui-même, comme manager, au moment de la fusion.
- A (RLS du cycle d'observation), B (motif fantôme) et le libellé contradictoire : hors lot, request distincte.
- La PR de `f11b845e` vers `production` est ouverte sur instruction de Frédéric, non fusionnée. La fusion reste à Frédéric.

## Demande

1. Arbitrage APPROVED de cette rectification, avec `closes: false` : aucune clôture, aucune fusion, aucun déploiement, aucune écriture Production.
2. Que la CI puisse alors matérialiser la décision sur la branche du lot déclarée, pour que la consommation suivante soit possible.

## Preuve des conditions de decision-1

Inchangée par rapport à la request-4 (elle-même renvoyant à la request-3, commit 787d3f87). Cette rectification est purement procédurale : aucune lecture ni écriture Production, aucun code, aucune migration, aucune policy. Les conditions 1 à 5 sont tenues comme dans la request-4. La condition 6 (aucune mutation, migration, fusion ou promotion Production) est tenue pour cette request ; le dépassement de la request-3, sous GO distincts de Frédéric, n'est pas aggravé.

## Limites

Elle ne corrige pas le fond de la régression : seule la fusion de la PR, par Frédéric, le fait en Production.
