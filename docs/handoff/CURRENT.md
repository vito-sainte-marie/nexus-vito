<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/request-12.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 12
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=5751a9b0
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 174-fichiers
---
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-12 — L1 incrément 3 : PR #175, CI verte, demande de fusion

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

PR #175 (branche `claude/fil-caisse-l1-inc3-20261103`, base `production` 5751a9b0), tête 76fc58f7, CI verte : Construire et éprouver l'artefact, Cloudflare Pages, non-regression (deux exécutions). GitHub signale la PR sans conflit. Elle est encore en brouillon. Cette request demande l'arbitrage de l'incrément 3 en vue de sa fusion par Frédéric, `closes: false`.

## Ce que porte la PR

1. Accueil caisse pour toutes les caissières en service (décision de Frédéric du 03/11 13:44). Le fil reste réservé aux pilotes.
2. Libellés (décision de Frédéric du 03/11 14:24, relayée par Guardian 6612092079) : carte « Comptage Boutique », bouton « Commencer l'inventaire → » pour pilote et non-pilote, seule la destination diffère ; « Comptage d'entrée » reste le nom de l'étape. Même lien sur la page Missions.
3. Heure de fin du quart dans le bandeau de la caissière (matin et soir), lue par `NexusStation.finDuQuartMinutes` ; aucune heure en dur, aucune heure devinée.
4. Fil caisse à deux étapes, fermeture du soir, étape 3 masquée en attendant l'arbitrage du quart partagé (request-11).

## Correctif de la CI (Guardian 6613023596)

`test_fermeture_piste_20261031.js` était rouge depuis 2adf35a3 : l'épreuve « le manager et un autre rôle n'entrent pas dans le mode » attendait `null` pour la caissière, ce que la décision du 03/11 a rendu faux volontairement. Corrigé dans le test seulement, la page n'est pas touchée :

- la caissière entre dans le mode avec `fermeture`, `finQuart` et `reception` à `null` ;
- manager, renfort, polyvalent et hors service rendent toujours `null` ;
- mutation ajoutée « la caissière reçoit une fermeture piste » ; la mutation « horaire indéterminé deviné » est ciblée sur la ligne de la piste, la première occurrence étant devenue celle de la carte Caisse.

Résultat : 21 épreuves, 33 mutations tuées. Les tests voisins (accueil caisse pilote, entrée accueil, Missions, accueil piste, garde de page) sont verts.

## Limites

Rien en Production. Aucune migration, policy, grant, secret. Aucune nouvelle règle pour les employés au-delà des décisions de Frédéric citées. La clôture serveur du quart partagé reste l'objet de request-11, en attente d'arbitrage. Suite complète : seuls les échecs connus.

## Demande

Arbitrage de l'incrément 3 (L1) en vue de la fusion de #175 par Frédéric. Hors demande : clôture du lot, étape 3 du fil, changement de quart.
