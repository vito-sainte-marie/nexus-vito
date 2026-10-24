<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/CATEGORIES-FIL-20261024/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: CATEGORIES-FIL-20261024
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=d76e9c07
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 162-fichiers
---
# CATEGORIES-FIL-20261024 : le fil du pompiste compte par le paramétrage de la station, pas par une liste du code

## Contexte
Le fil de début de quart (`nexus-fil-debut-quart.js`) décide quels produits compter avec une liste figée dans le code (`CATEGORIES_FIL`, l. 24, lue par `categorieDuFil`, l. 72) : gaz, glaçons, écailles. Cette liste doit sortir du code. La liste a été signalée comme « lot suivant » dans `docs/executions-lot-PARCOURS-POMPISTE-CORRECTIFS-RECETTE-20261022.md`, section D. #152 est fusionnée dans `production` (GO de Frédéric).

Précision de Frédéric (23/10) : les écailles sont un produit de la catégorie Glaçons, pas une catégorie. Aucune catégorie « Écailles » ne sera créée en Production.

## Ce que le lot fera (après décision de l'arbitre : le code n'est pas écrit)
1. Retirer `CATEGORIES_FIL` et `categorieDuFil` de `nexus-fil-debut-quart.js` ; le fil lit les catégories comptées par le pompiste dans le paramétrage de la station.
2. Deux règles dans `RULES.json` : « Écailles = produit de Glaçons » ; « les catégories comptées par le pompiste viennent du paramétrage de la station ».
3. Épreuves : produit désactivé absent ; produit actif de la zone piste présent ; autre site sans écailles.
4. Critère d'acceptation : l'écran du pompiste ne contient que les produits actifs de la zone piste.

## Déjà posé sur la branche `categories-fil-parametrage-20261023`
- Commit `e39b7949`, **sans aucun changement de code applicatif** : un script Test seulement `outils/alignement-zones-recette-huile-laveglace-20261023.sh` (refuse Production, borné à deux identifiants de produit, `rollback` par défaut, `--executer` pour valider) et l'épreuve `test_pompiste_zone_piste_exclut_boutique_20261023.js`. L'épreuve exécute `chargerProduitsZone('piste')` extraite de `NEXUS-Inventaire-v1.html` avec un faux client ; elle attend `['Gaz 12,5KG','Écailles']` et rougit si l'on retire le filtre de zone (mutation vérifiée).
- La branche a été **refaite sur `origin/production`** (`d76e9c07`) : le commit d'origine `63aba13c` reposait sur la tête du rail et aurait apporté plus de 1200 fichiers de différence dans une PR vers `production`. Sauvegarde locale de l'original : `sauvegarde-categories-fil-63aba13c`.
- Suite complète (`node run-tests.js`) : **7 échecs sur la branche, les mêmes 7 sur `origin/production` nue**, donc aucun nouveau :
  `test_inventaire_categorie_mixte_deux_lieux`, `test_inventaire_production_journaliere_q1`, `test_inventaire_sprint4_ux_flash`, `test_inventaire_sprint4bis_ecriture_immediate`, `test_pilotage_qualite_receptions`, `test_reception_moteur`, `test_reception_v1_dom`.
- Rien écrit en Production. Le script Test n'a pas été exécuté.

## À arbitrer
1. Le périmètre ci-dessus convient-il, la lecture du paramétrage de la station étant le seul changement de code ?
2. Le script Test d'alignement des zones peut-il être exécuté sur Test pour la recette (huile et lave-glace en zone boutique, comme en Production) ?
3. Ordre confirmé après ce lot : suivi de l'Inventaire (lectures en double, 5,0 s contre 3 s visées), puis audit du langage.

Aucune fusion, aucun déploiement, aucune écriture Production sans le GO de Frédéric.
