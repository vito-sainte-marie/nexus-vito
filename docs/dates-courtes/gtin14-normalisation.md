# Normalisation GTIN-14 (Dates courtes) — étape 2, sur Test seulement

Migration `20261123100000_dates_courtes_gtin14.sql` (additive) ; retour arrière `docs/deploiement/retour-arriere-dates-courtes-gtin14-20261123.sql`.

## Règle
- `gtin14(texte)` : chiffres seuls, longueurs 8, 12, 13, 14, complétés à 14 par des zéros à gauche, clé mod-10 contrôlée. Sinon null.
- 9, 10, 11 chiffres : jamais complétés ni acceptés (« Code incomplet, à vérifier »).
- Le GTIN-14 ne sert qu'au **rapprochement**. Aucun code stocké n'est réécrit.
- Clés historiques inchangées : `dates_courtes_normaliser_ean`, `cle_article`, `dates_courtes_cle_canonique`, `dates_courtes_cle_groupe`, clés JS, clés d'import, `tarif_*`.
- Ambigu seulement si deux articles distincts portent le même GTIN-14 **dans la même période** (même import pour les ventes) : aucun choix automatique (« Plusieurs articles pour ce code »), `prix_article` ne prend aucun prix par le code. Un libellé renommé d'une période à l'autre n'est pas une ambiguïté : on retient le libellé de la période la plus récente (Production : 93 GTIN-14 dans ce cas, 0 ambiguïté réelle).

## Forme enregistrée par le relevé
EAN-13 : UPC-A → « 0 » + 12 chiffres ; GTIN-14 commençant par 0 → ses 13 derniers chiffres ; GTIN-8 → 8 chiffres. Un GTIN-14 ne commençant pas par 0 (colis) est **provisoire** : envoyé sans ean, avec libellé, code brut dans `nom_libre` (« Code lu : … »). Le code brut lu reste affiché.

## Rapport en lecture seule : ce qui changerait ailleurs (aucun changement de comportement dans ce lot)
| Lieu | Aujourd'hui | Avec le GTIN-14 (lot ultérieur, à arbitrer) |
|---|---|---|
| Inventaire `normaliserCodeBarresVentes` / `rapprocherLignesVentes` | retire tous les zéros initiaux, sans clé | un code de 11 chiffres cesserait de tomber sur un 12/13 chiffres ; UPC-A rapproché de l'EAN-13 |
| Import `normaliserCodeBarresImport`, clés `cb:` | idem | comparaison en GTIN-14, clés d'import inchangées |
| Scanner tarifaire `cb` / `parCb` | égalité de chaîne | index GTIN-14 en plus, flags conservés |
| Produits | sous-chaîne sur le code brut | **ajouté ici** : recherche aussi par GTIN-14, rien retiré |
| Open Food Facts | code brut | hors périmètre, inchangé |

Mesures Test (lecture seule) : `inventaire_zone_produit` 190 codes, 154 valides aujourd'hui, 160 avec la règle, 6 UPC-A gagnés, 20 clés fausses, 10 longueurs non GTIN, 0 incomplet, 0 ambigu ; `inventaire_ventes_import` 38 / 32 / 32 / 0 / 4 / 2 / 0 / 0 ; 90 GTIN-14 distincts, aucune collision.

## Preuves
- `node test_dates_courtes_releve_gtin14.js` (page relevé : caméra, douchette, saisie), `node test_produits_gtin14.js` (recherche Produits).
- `outils/recette/dates_courtes_gtin14/01_recette_dates_courtes_gtin14.sql` : à jouer par Guardian sur Test après application de la migration (non exécutée ici, la migration n'étant pas appliquée). Jeu synthétique sur sites fictifs, `products` étant vide sur Test.
- Comptage Production : `docs/deploiement/comptage-gtin-production-lecture-seule-20261123.sql`, md5 `53121040f4481040030dc223cdd70291`, sur GO distinct du pilote.

## Limites
Empreinte d'artefact non mesurée en local ; flux caméra ZXing réel non testé ; collision théorique d'un EAN-13 commençant par 00000 (0 cas sur Test).
