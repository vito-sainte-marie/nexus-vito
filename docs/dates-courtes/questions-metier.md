# Questions restantes et constats

Les points métier de la liste initiale sont tranchés par le pilote (21/11) et intégrés dans `CDC-v3.md`, les fiches, le modèle, la matrice et le plan de recette. Il ne reste qu'une couverture à surveiller et une vérification serveur.

## 1. Couverture de la référence stable des produits sans EAN (constat)

Constat, mesure de Guardian du 21/11 en Production, lecture seule, filtrée sur la station, sur GO de lecture du pilote :

- `normalized_products` est vide en Production, pour tous les sites. `external_product_id` ne peut donc pas servir de clé : aucune ligne ne le porte. Ce n'est pas une question au pilote.
- Dans les deux dernières périodes d'import : 64 articles sans EAN dans la dernière, 56 dans la précédente. 48 retrouvés avec un libellé identique, 49 avec un libellé normalisé (date en tête retirée, casse et espaces unifiés), 0 doublon de libellé normalisé dans une même période.
- Les 15 autres sont surtout hors périmètre (cartes prépayées, timbre, consigne gaz, codes promo) ou de vraies nouveautés. Un seul renommage alimentaire : « Pain Chocolat - 68P » devient « Pain Chocolat - 96P ».

Retenu : la clé d'un produit sans EAN est le libellé normalisé, avec un geste manager tracé « même produit que… » pour un renommage (`fiche-lot-1.md`, section 5).

Reste à surveiller : la couverture de cette clé. 49 sur 56 articles de la période précédente se retrouvent (les cas manquants relèvent surtout du hors périmètre et des nouveautés). Le lot 1 prévoit un contrôle qui liste les groupes dont le libellé normalisé disparaît d'un import à l'autre, pour que le manager les rattache. Aucune mesure ne couvre un autre rayon que celui des deux périodes lues.

## 2. Noms de rôles côté serveur (à vérifier)

Les noms `manager`, `gerant`, `createur` sont ceux de la matrice des droits. Ils sont à vérifier contre la base avant tout code. Rien n'a été lu en Production par l'assistant pour ce dossier.
