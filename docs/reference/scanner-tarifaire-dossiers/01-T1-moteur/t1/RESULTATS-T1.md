# Moteur de politique tarifaire T1, version 2 : code, tests et résultats

16/11/2026. Lecture seule : aucune écriture en Production ni dans Decenium, aucune migration, aucune fusion, aucun prix appliqué. T2 n'est pas engagé.

Cette version applique les cinq conditions de l'examen du 16/11/2026 (19 h 55). Le premier passage est conservé dans `resultats/v1/`.

## Ce qui change

| Condition | Traitement dans le moteur | Tests ajoutés |
| --- | --- | --- |
| 1. Seuils validés, indicatifs, hypothèses | Quatre statuts de seuil : `valide`, `indicatif`, `a_l_etude`, `hypothese`. Seul un seuil validé produit une proposition, une alerte A2 ou le statut « conforme ». Sous un seuil indicatif : « à surveiller », motif « sous le seuil indicatif, non décisionnel ». Au-dessus : « sans seuil validé ». Le calcul au seuil indicatif est conservé comme repère, marqué `decisionnel: false`, rangé à part. | 4 |
| 2. FINE LEAF 15 g | Nouveau registre des régimes de prix déclarés (`contexte.regimes`). FINE LEAF y est déclarée « à qualifier » (ni libre ni réglementée) et placée en contrôle réglementaire et fiscal ouvert. Aucune simulation. Le moteur ne déduit jamais un régime d'un libellé : sans déclaration, il reste celui que fournit la règle NEXUS. | 2 |
| 3. Matérialité de A6 | Réglage `a6`, modifiable par site. Proposition par défaut : baisse du taux de plus de 2 points, ou baisse de marge unitaire d'au moins 0,02 € et d'au moins 5 % ; dans les deux cas, marge perdue estimée d'au moins 5 € sur la période. | 6 |
| 4. Références insuffisantes | Leurs simulations sont marquées `usage: 'preuve technique'` et rangées dans `gains.preuvesTechniques`. Les gains décisionnels n'ont plus de case « insuffisante ». | 1 test réécrit |
| 5. Résultats et preuves | Nouveau passage, comparaison avec la version 1, sortie des tests ci-dessous. | |

Classement des seuils retenu pour Sainte-Marie (`config_sainte_marie_t1.js`) :

| Statut | Familles |
| --- | --- |
| Validé (objectif arrêté) | Sodas 2 L (41 / 42 %), confiserie hors exceptions (50 %), vapotage (plus de 50 %, suspendu par le contrôle réglementaire) |
| Indicatif | Bières, jus (minimum), énergétiques, eaux non aromatisées, eaux aromatisées, biscuiterie, chips et petits salés, feuilles à rouler (minimum de surveillance proposé) |
| À l'étude | Cible des jus, glaces hors Floups |
| Hypothèse statistique | Sodas autres formats |
| Aucun seuil | Pains, huiles, boissons à l'aloe vera, boissons maltées, Floups, glaçons, menthes à l'unité |

## Preuve des tests

`node test_politique_tarifaire_t1_20261116.js` : **47 tests réussis, 0 échec** (35 de la version 1, dont 3 adaptés à la nouvelle forme des gains, et 12 nouveaux). Sortie complète : `resultats/preuve_tests_t1_v2.txt`.

## Nouveau passage sur Sainte-Marie (440 références, 36 jours)

| Nature de la règle | Références |
| --- | --- |
| Validée | 115 |
| Indicative | 235 |
| Non validée (à l'étude, hypothèse) | 42 |
| Aucune | 48 |

| Statut | v1 | v2 |
| --- | --- | --- |
| À vérifier | 70 | 70 |
| Proposition à valider | 88 | 48 |
| À surveiller | 110 | 73 |
| Conforme | 96 | 13 |
| Sans seuil validé | 76 | 236 |

Fiabilité inchangée : 268 fiables, 127 à confirmer, 45 insuffisantes. Contrôles réglementaires ouverts : 25 (24 vapotage et FINE LEAF), 3 284 € HT de CA.

**Gains décisionnels** (seuls exploitables pour une décision), € HT sur 36 jours, volume constant. Minimum et cible sont deux hypothèses alternatives : aucun total n'est additionnable.

| Scénario | Fiables | À confirmer |
| --- | --- | --- |
| Prix décidés par le gérant | 159,91 € (12 réf.) | 18,49 € (3) |
| Minimum validé | 125,80 € (28) | 99,26 € (20) |
| Cible validée | 125,80 € (28) | 99,26 € (20) |

Les montants au minimum et à la cible sont identiques : seule la confiserie a un seuil validé hors prix décidés, et son objectif unique de 50 % sert aux deux.

**Repères indicatifs, non décisionnels** (information seulement) : au minimum indicatif, 119,95 € (30 fiables) et 90,01 € (10 à confirmer) ; à la cible indicative, 440,39 € (55) et 163,54 € (22).

**Preuves techniques** (références insuffisantes, jamais un gain exploitable) : figurent dans `gains.preuvesTechniques` du fichier de résultats, sans être reprises ici comme montants.

Alertes v2 : A1 58, A2 48, A3 3, A4 45, A5 22, A6 1, A7 1, A8 25.

## Divergences avec la version 1

206 références sur 440 changent (`resultats/divergences_v1_v2_t1.csv`).

| Changement | Nombre | Cause |
| --- | --- | --- |
| Conforme devenu « sans seuil validé » | 83 | Seuil indicatif, désormais non décisionnel |
| À surveiller devenu « sans seuil validé » | 77 | Même cause, références au-dessus du seuil indicatif |
| Proposition à valider devenue « à surveiller » | 40 | Sous un seuil indicatif : signalée, sans proposition ni A2 |
| A6 retirée | 1 | Bavaria Blonde : 0,01 € de marge unitaire en moins, sous le seuil de matérialité |
| Contrôle réglementaire ouvert | 1 | FINE LEAF 15 g ; son statut reste « à vérifier » |

Familles touchées : bières 44, biscuiterie 44, jus 42, chips 28, eaux non aromatisées 14, feuilles à rouler 13, eaux aromatisées 12, énergétiques 9.

Montants décisionnels : les prix décidés ne changent pas (178,40 €). Le minimum passe de 245,75 € et 189,27 € (v1, fiables et à confirmer) à 125,80 € et 99,26 € : la différence correspond aux familles indicatives, désormais en repères.

## Points restant à votre décision

1. **Confiserie et sodas 2 L** : je les ai classés « validés » parce que vous les avez formulés comme des objectifs. Si la confiserie doit être indicative, les gains décisionnels au minimum tombent à 0 € hors prix décidés.
2. **Seuils A6** : 2 points, 0,02 € et 5 %, 5 € minimum. Ce sont des propositions, réglables par site.

## Fichiers

`nexus-politique-tarifaire.js` (moteur), `test_politique_tarifaire_t1_20261116.js` (47 tests), `config_sainte_marie_t1.js`, `executer_sainte_marie_t1.js`, `comparer_v1_v2_t1.py`, `comparer_matrice_t1.py`, `donnees/` (lues en lecture seule, Sainte-Marie), `resultats/` (v2, v1, preuves).
