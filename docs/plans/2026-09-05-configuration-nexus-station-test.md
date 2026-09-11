# Configuration explicite de `nexus-station-test` — proposition

**05/09/2026 · proposition · aucune écriture, aucun schéma modifié**

Prérequis à C2 / C3 / B3 : tant que `station_config` est vide, supprimer les
replis arrêterait Carburants et Inventaire dans la recette.

Périmètre : **`nexus-station-test` uniquement**. `site-fantome-test` et
`vito-sainte-marie` restent sans ligne dans `nexus-test`, pour conserver deux
cas réels d'absence de configuration.

## Ce que la lecture de la production a appris

J'ai lu — **en lecture seule, aucune écriture** — `station_config` du projet de
production. C'était la seule provenance sérieuse, et elle corrige deux
affirmations que le code répétait.

### 1 · Les « valeurs réelles connues de Vito Sainte-Marie Usine » ne le sont pas

`nexus-carburant-donnees.js` défend `CUVES_PAR_DEFAUT` comme un « repli
explicite sur les valeurs réelles connues de Vito Sainte-Marie Usine ».

| | `CUVES_PAR_DEFAUT` (code) | `vito-sainte-marie` (production) |
|---|---|---|
| SP95 | 30 000, « Cuve unique » | **30 276** (limite 28 761), « Rés. 1 » |
| GO cuve 1 | 20 000, « Cuve 1 » | **20 020** (limite 19 019), « Rés. 3 » |
| GO cuve 2 | 10 000, « Cuve 2 » | **10 036** (limite 9 534), « Rés. 2 » |
| GNR | 30 000, « Cuve unique » | **32 092** (limite 30 471), « Rés. 4 » |

Aucune capacité ne correspond, aucun libellé non plus, et **les limites de
remplissage sont absentes du repli**. Ces valeurs sont en réalité celles de
`site-fantome-test`, le site de test — c'est mot pour mot sa ligne de
production. Le repli n'héritait donc pas de Sainte-Marie : **il héritait du
site fantôme**, sous un commentaire qui affirmait le contraire.

### 2 · Les horaires par défaut sont faux de 25 minutes

| | `HORAIRES_DEFAUT` (Paramètres Station) | production |
|---|---|---|
| quart2 `fin_normal` | 19:40 | **20:05** |
| quart2 `fin_etendu` | 21:40 | **22:05** |

Le commentaire l'annonçait honnêtement (« l'ancienne règle devinée, +7 h/+8 h,
comme point de départ raisonnable ») : 12:40 + 7 h = 19:40. La vraie fin de
quart est 20:05. **Vingt-cinq minutes d'écart sur le calcul des retards.**

### 3 · Deux autres divergences

- `carburant_commande_config` : la production utilise
  `stock_securite_jours_normal: 2` et `stock_securite_jours_fin_mois: 1` ; le
  défaut en base utilise une clé différente, `stock_securite_jours: 3`.
- `pointage_actif` vaut **false** en production, `jaugeage_carburant_actif`
  vaut **true**. Les défauts de colonne disent l'inverse des deux.

## Conséquence de ma propre migration A3-3

`station_config.fuseau_horaire` est `NOT NULL` et **n'a plus de valeur par
défaut** depuis A3-3. Toute insertion doit donc le fournir explicitement,
alors que **plus aucun code ne le lit**. C'est le prix de la fenêtre de
transition ; la colonne sera retirée dans le lot de retrait prévu. Il faut le
savoir avant d'écrire, pas le découvrir sur une erreur `23502`.

Les seules colonnes réellement obligatoires sans défaut sont donc :
`site`, `horaires`, `fuseau_horaire`.

## La question à trancher : ressembler à Sainte-Marie, ou s'en distinguer ?

**Option A — recopier les valeurs de production.** La recette exerce des
décisions réalistes, comparables à celles du terrain.

**Option B — des valeurs distinctes mais plausibles.** *(recommandée)*

Si `nexus-station-test` porte exactement les valeurs de Sainte-Marie, alors
un repli implicite résiduel **produit le bon résultat** et reste invisible.
Des valeurs distinctes rendent toute fuite immédiatement détectable : un
écran qui afficherait 20 020 L alors que le site de test déclare 15 000 L
signale sa propre contamination.

C'est exactement l'objectif que tu as fixé : « aucune décision métier ne devra
encore fonctionner grâce à une valeur implicite héritée de Sainte-Marie ».
L'option B rend cette phrase vérifiable ; l'option A la rend indémontrable.

## Configuration proposée (option B)

| Champ | Valeur | Provenance |
|---|---|---|
| `site` | `nexus-station-test` | identité |
| `fuseau_horaire` | `America/Martinique` | **fixture** — colonne dépréciée, exigée par NOT NULL, lue par personne |
| `horaires.quart1` | 06:00 / 06:00, fin 13:00 / 14:00 | **fixture distincte**, structure réelle |
| `horaires.quart2` | 13:00 / 14:00, fin 20:00 / 22:00 | **fixture distincte**, structure réelle |
| `horaires.renfort` | 09:00–17:00, pause 13:00–14:00 | **repris de production** (identique) |
| `horaires.temps_habillage_min` | 15 | **repris de production** |
| `cuves.sp95` | 1 cuve « Cuve A », 25 000 (limite 23 750) | **fixture distincte** |
| `cuves.go` | « Cuve B » 15 000 (14 250), « Cuve C » 8 000 (7 600) | **fixture distincte** |
| `cuves.gnr` | inactif | **fixture** — écarte GNR du périmètre de recette |
| `carburant_commande_config` | cutoff 11:00, livraison lun–ven, min 3 000, max 36 000, compartiments 2000/5000/7000, `stock_securite_jours_normal` 2, `stock_securite_jours_fin_mois` 1 | **repris de production** — ce sont des règles fournisseur, pas des grandeurs de site |
| `pointage_actif` | `true` | **fixture** — la recette doit éprouver le pointage, la production l'a désactivé |
| `manager_pointage_requis` | `false` | défaut, aligné production |
| `jaugeage_carburant_actif` | `true` | **repris de production** |
| `reception_carburant_role` | `employe` | défaut, aligné production |
| `planning_source` | `nexus` | défaut, aligné production |
| `planning_onglet_prefixe` | `null` | **volontairement absent** — le planning Google Sheets reste hors recette (E1) |
| `parametres_inventaire` | défaut de colonne | non repris de production : à éprouver tel que livré |

**Ce qui représente réellement Sainte-Marie** : les règles de commande
fournisseur, le renfort, le temps d'habillage, le jaugeage actif.
**Ce qui est une fixture de recette** : les horaires de quart, les capacités
de cuves, le GNR inactif, le pointage actif, le fuseau.

Les limites de remplissage suivent le ratio observé en production (≈ 95 %),
pour que les calculs de capacité restent réalistes sans copier les grandeurs.

## Écriture proposée

Une seule ligne, `insert` explicite dans `nexus-test` uniquement. Aucun
schéma modifié, aucune politique touchée, aucun autre site.

**Rien n'est écrit avant ton arbitrage sur l'option A ou B.**

## Ordre ensuite

configuration → C2 horaires bloquants → C3 cuves bloquantes → B3
pré-remplissage explicite → preuves navigateur + simulations.

Note pour C3 : le commentaire de `CUVES_PAR_DEFAUT` devra être corrigé en même
temps que la valeur. Laisser une affirmation fausse à côté d'un correctif
serait rejouer exactement le défaut A6 — une version qu'on ne peut pas
identifier à partir de ce qu'elle prétend être.
