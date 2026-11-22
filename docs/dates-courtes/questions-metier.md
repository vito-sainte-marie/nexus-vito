# Questions restantes et constats

Les points métier de la liste initiale sont tranchés par le pilote (21/11) et intégrés dans `CDC-v4.md`, les fiches, le modèle, la matrice et le plan de recette. Il ne reste qu'une couverture à surveiller et une vérification serveur.

## 1. Couverture de la référence stable des produits sans EAN (constat)

Constat, mesure de Guardian du 21/11 en Production, lecture seule, filtrée sur la station, sur GO de lecture du pilote :

- `normalized_products` est vide en Production, pour tous les sites. `external_product_id` ne peut donc pas servir de clé : aucune ligne ne le porte. Ce n'est pas une question au pilote.
- Dans les deux dernières périodes d'import : 64 articles sans EAN dans la dernière, 56 dans la précédente. 48 retrouvés avec un libellé identique, 49 avec un libellé normalisé (date en tête retirée, casse et espaces unifiés), 0 doublon de libellé normalisé dans une même période.
- Les 15 autres sont surtout hors périmètre (cartes prépayées, timbre, consigne gaz, codes promo) ou de vraies nouveautés. Un seul renommage alimentaire : « Pain Chocolat - 68P » devient « Pain Chocolat - 96P ».

Retenu : la clé d'un produit sans EAN est le libellé normalisé, avec un geste manager tracé « même produit que… » pour un renommage (`fiche-lot-1.md`, section 5).

Reste à surveiller : la couverture de cette clé. 49 sur 56 articles de la période précédente se retrouvent (les cas manquants relèvent surtout du hors périmètre et des nouveautés). Le lot 1 prévoit un contrôle qui liste les groupes dont le libellé normalisé disparaît d'un import à l'autre, pour que le manager les rattache. Aucune mesure ne couvre un autre rayon que celui des deux périodes lues.

## 2. Noms de rôles côté serveur (à vérifier)

Les noms `manager`, `gerant`, `createur` sont ceux de la matrice des droits. Ils sont à vérifier contre la base avant tout code. Rien n'a été lu en Production par l'assistant pour ce dossier.

## 3. Rôle `vacataire` (arbitré)

Arbitrage du pilote du 21/11 : aucun accès, comme le pompiste (`matrice-permissions.md`). Cas de recette 42.

## 4. Prévention des pertes (arbitré le 22/11)

Voir `prevention-pertes.md`. Arbitrages du pilote (#160, 7080834555), en plus du montant principal à 7 jours ou moins (8 à 14 jours « indicatifs », plus de 14 jours exclus) :

1. Quantités non certifiées : incluses dans la valeur à risque, avec la mention « non certifiées » sur la carte.
2. Rotation : fenêtre de ventes de 30 jours, moyenne seulement, jamais la date limite des unités vendues.
3. Action terminée : clôturée par le manager, avec un résultat mesuré ou « Résultat non mesurable ».
4. Multisite : aucune comparaison aux lots 5 et 6, une station par profil ; toute ouverture passe par un arbitrage de sécurité distinct.
5. Prix d'achat d'une démarque : figé à la comptabilisation, table du lot 5 en ajout seul (prix HT unitaire, source, heure). Sans prix : « Prix d'achat absent ». Démarques antérieures : prix de la période de la pose, « prix reconstitué ».
6. Nature fiscale de `products` : HT, contrôle de Guardian du 22/11 (preuve élevée). Contrôle de cohérence à chaque import au lot 5 ; échec : « Nature fiscale non déterminée », aucun montant.
