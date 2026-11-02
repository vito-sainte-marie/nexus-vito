---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 3
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
# INVENTAIRE-CAISSE-RENFORT-20261102 : request-3 — conception de l'activation par employée (L1 étape 2) et deux pilotes

## Branche du lot

BRANCHE_DU_LOT: handoff-continuite-20260920

## Objet

La decision-2 (APPROVED_WITH_CONDITIONS, `closes: false`, f8bae7e8) est prise en charge (9ae10401). L'étape 1 de L1 (inventaire des mécanismes existants) est faite et rapportée sur #160 (6581519666). Guardian a répondu (6582250527) avec la mesure de la RLS de `station_config` et une précision de Frédéric (6581386802). Cette request porte la conception de l'étape 2 pour arbitrage, avant tout code.

## Preuve des conditions de decision-2

- Pilote unique, activation refusée par défaut, côté serveur, limitée par site et employée : conçue ci-dessous, pas codée.
- Aucun renfort conclu, aucun élargissement, aucune communication terrain.
- Aucune table, colonne, policy, migration ni grant touchés ; aucune lecture ni écriture Production par l'exécutant (la mesure de RLS a été faite par Guardian sous GO de lecture de Frédéric).
- Étapes 3 et 4 (code sur Test, épreuves pilote / non-pilote / isolation intersite) : non commencées.

## Faits nouveaux

1. **RLS de `station_config`** (mesurée par Guardian, Production et Test, mêmes policies) : SELECT limité à `site = current_employee_site_id()`, donc toute employée authentifiée du site lit la ligne ; INSERT et UPDATE réservés à `manager` et `gerant` du site. L'option « clé additive » ne touche ni table, ni colonne, ni policy, ni grant : pas de porte.
2. **Deux pilotes** (Frédéric, 6581386802) : une en caisse, une en renfort. decision-2 n'autorise L1 que pour la pilote caisse ; le renfort suit en L3.

## Conception proposée

1. **Réglage** : une clé additive dans `station_config.parametres_inventaire`, avec deux listes d'`employee_id` : `pilotesCaisse` et `pilotesRenfort`, vides par défaut (= refusé pour tous). Aucun nom, aucun libellé : la liste est lisible par toutes les employées du site, elle ne contient que des identifiants.
2. **Écriture** : par le chemin manager existant de NEXUS-Parametres-Inventaire-v1.html (UPDATE de `station_config`, déjà réservé aux managers et gérants du site). Aucun nouveau chemin d'écriture.
3. **Lecture** : par le fil caisse de la pilote, qui compare son identifiant à `pilotesCaisse`. Absence de clé, liste vide, JSON illisible, identifiant absent : le fil actuel, inchangé. `pilotesRenfort` est prévue dans le réglage dès L1 mais n'est lue par aucun écran avant L3.
4. **Frontière de sécurité, à confirmer** : la décision « pilote ou non » est prise dans la page, la RLS ne borne que la lecture par site. Une non-pilote qui forcerait l'écran ne pourrait au pire que compter, sans aucune écriture nouvelle ni élargissement de ce qu'elle peut déjà écrire. Guardian juge cela suffisant pour un pilote ; je demande que l'arbitre le confirme explicitement, ou exige une application côté base (qui serait alors une porte SECURITE_RLS_SITE_ID, non franchie).
5. **Isolation intersite** : le réglage est lu avec le `site` de l'employée ; un identifiant listé sur un site n'active rien sur un autre.

## Demande

Arbitrage APPROVED ou APPROVED_WITH_CONDITIONS, `closes: false`, qui :

1. valide la conception ci-dessus (clé additive, deux listes, écriture manager existante) ;
2. confirme que la décision « pilote ou non » côté page suffit pour un pilote sans enjeu de sécurité, ou l'exclut ;
3. confirme que `pilotesRenfort` est prévue dès L1 sans être lue avant L3 ;
4. autorise les étapes 3 et 4 de L1 (code sur Test avec l'existant, puis épreuves pilote / non-pilote / isolation intersite).

## Limites

Aucun code, aucune migration, aucune policy, aucun grant. Aucune lecture ni écriture Production par l'exécutant ; fusion et déploiement par Frédéric.
