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

## 4. Prévention des pertes (à arbitrer)

Voir `prevention-pertes.md`. Déjà arbitré : montant principal sur les relevés de 7 jours ou moins, 8 à 14 jours « indicatifs » à part, plus de 14 jours exclus.

1. **Quantités certifiées seulement ou aussi non certifiées.** Options : (a) certifiées seulement, (b) non certifiées incluses avec la mention « non certifiées ». Recommandation : (b), pour que la valeur existe avant la certification, avec la mention sur la carte.
2. **Fenêtre de ventes servant à la rotation.** Options : 14, 30 ou 60 jours. Recommandation : 30 jours, tant que les ventes sont par période. Elle ne donne qu'une rotation moyenne, jamais la date limite des unités vendues.
3. **Définition d'une action « terminée ».** Options : (a) à la date limite du produit, (b) quand le manager la clôture, (c) quand la quantité de départ est à zéro. Recommandation : (b), avec résultat mesuré ou « Résultat non mesurable ».
4. **Comparaison multisite du gérant.** Options : (a) aucune, station unique, (b) stations autorisées seulement. Recommandation : (a) pour les lots 5 et 6, (b) en arbitrage de sécurité. Aucun droit n'est élargi par cette documentation.
5. **Prix d'achat figé à la pose de la démarque.** Options : (a) figé à la pose, (b) relu à la date de la perte. Recommandation : (a), non reconstituable plus tard. Question aussi posée à Guardian pour #352.
6. **Hors taxes de `products`.** À confirmer sur trois articles connus (requête filtrée par site, soumise au pilote).
