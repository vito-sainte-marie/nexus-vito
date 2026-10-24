---
protocol: nexus-handoff/2
kind: request
lot_id: INVENTAIRE-RELECTURES-20261024
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=ee426fe4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# INVENTAIRE-RELECTURES-20261024 : code livré en PR brouillon, mesure « après » à faire par Guardian

## Preuve des conditions de decision-1
Code : branche `inventaire-relectures-20261024`, commit `4454a943`, **PR #157 en brouillon vers `production`**, non fusionnée (GO de Frédéric requis). Aucune écriture ni lecture de la Production.

1. **Mémoïsation cloisonnée par site et date, sans donnée périmée.** Fenêtre mémo (`ouvrirMemoPlan` / `fermerMemoPlan`), clés `ingredients|site|date`, aucune conservation hors fenêtre. `test_inventaire_relectures_20261024.js` : une seule lecture des ingrédients pour une génération suivie d'une réévaluation (le test compteur de l'ACTION_NEXT), un autre site ou une autre date relit, rien n'est gardé une fois la fenêtre fermée. 9 mutations, toutes rouges.
2. **`shifts` et `sites` regroupés : le cumul est démontré par Guardian.** Mesure « avant » (Test, `ee426fe`, Employé Test B, première ouverture du quart du soir à 15:45) : écran prêt à 3,7 s, 42 requêtes, 10 vagues, 188 ms en moyenne. `shifts` ×2 (requête identique, 533 puis 975 ms) ; `sites` ×2 (fuseau, 649 puis 975 ms) ; préparation de la sélection ×2 (`inventaire_points_reference` et plans récents, 1,76 puis 2,34 s).
   - `shifts` : mémo de 3 s par (employé, site) ; une erreur et « aucun service » ne sont jamais gardés ; la clôture d'un service l'invalide.
   - `sites` : la requête en vol est partagée entre `nexus-auth.js` et `nexus-station.js` ; les raisons `reseau` et `configuration` restent distinguées.
   - `test_inventaire_relectures_shifts_sites_20261024.js` (S1 à S11) : verts, 8 mutations rouges.
3. **`station_config` NON regroupé.** Les deux lectures (pointage, puis `parametres_inventaire`) ne sont pas un cumul ; aucune n'est ajoutée ni retirée (S10).
4. **Dépliage de « Disponibles ».** Testé : obligatoires soldées, déplié ; obligatoire restante, non déplié ; le repli manuel est conservé (`test_parcours_pompiste_lot3_20261023.js`, vert).
5. **Suite complète.** `node run-tests.js` : 7 échecs, les mêmes que sur `origin/production` (`test_inventaire_categorie_mixte_deux_lieux`, `test_inventaire_production_journaliere_q1`, `test_inventaire_sprint4_ux_flash`, `test_inventaire_sprint4bis_ecriture_immediate`, `test_pilotage_qualite_receptions`, `test_reception_moteur`, `test_reception_v1_dom`). Aucun de plus.

## Ce qui manque encore
- **La mesure « après » n'existe pas.** Elle exige une build déployée sur Test et un quart du soir ; Claude Guardian la fera. Je ne donne donc aucun chiffre « après » et je ne dis pas si 3 s sont atteintes.
- La préparation de la sélection (×2, 1,76 puis 2,34 s) reste le poste le plus lourd de la mesure « avant » ; les mémos retirent la seconde lecture des ingrédients, pas le calcul. Si 3 s ne sont pas atteintes, ce calcul est le lot séparé que decision-1 prévoit.
- `invaliderMemoIngredients` est exportée et testée mais sans appelant : la fenêtre est courte et en lecture seule, donc rien n'en dépend.

## Nettoyage Test
Le service du soir ouvert par Claude Guardian sur Test (Employé Test B, pompiste, `50175943-…`, `heure_debut` 19:40:42 UTC) a une ligne dépendante dans `inventaire_quart_employes` (clé étrangère sans cascade). Script `outils/nettoyage-service-soir-guardian-20261024.sh` : borné à ce site, cet employé, ce service, Test seulement ; simulé avec rollback, **non exécuté**. L'heure (15:40 locale) diffère de 15:42 annoncé : à confirmer avant exécution.

## À arbitrer
1. Ce lot se clôt-il après la mesure « après » de Guardian, quel qu'en soit le chiffre, comme le prévoit decision-1 ?
2. Prochain lot, séparé, à déposer après celui-ci : « Jaugeage Carburant » (étape 3 du fil).

Aucune fusion, aucun déploiement, aucune lecture ni écriture de la Production sans le GO de Frédéric.
