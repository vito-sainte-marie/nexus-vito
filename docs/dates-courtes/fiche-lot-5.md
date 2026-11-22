# Fiche lot 5 : Prévention des pertes (v4)

Statut : code et banc local, prêts pour revue. Rien sur Test ni en Production sans GO écrit de Guardian.

## 1. Objectif

Donner au manager et au gérant, en lecture seule, une page « Prévention des pertes » : quatre montants A, B, C, D qui ne s'additionnent jamais, une liste de priorité et des compteurs du jour.

## 2. Arbitrages réglés (non rouverts)

- C1 : la certification reste telle que définie au lot 1.
- C2 : la valeur B porte l'étiquette « Partiellement reconstitué » tant que des démarques antérieures au lot 5 n'ont pas de prix figé.
- C3 : les actions de prévention (décider, retirer, remiser) relèvent du lot 6. Le bouton « Décider une action » est affiché désactivé, « Disponible au lot 6 ».

## 3. Montants

- A, valeur à risque : prix d'achat des unités relevées à 7 jours et moins, non retirées. Les relevés de 8 à 14 jours sont affichés à part (à vérifier), ceux de plus de 14 jours sont exclus (à recontrôler). Une ligne sans prix d'achat compte des unités, jamais de montant.
- B, pertes constatées : démarques comptabilisées sur la période, au prix figé à la comptabilisation ; « prix reconstitué » pour les démarques antérieures au lot 5.
- Marge : prix de vente HT moins prix d'achat HT, en chiffre d'affaires potentiel (A) ou théorique (B), avec la part reconstituée.
- C et D : « Calcul indisponible », quatre raisons chacun. Aucune estimation n'est affichée.

## 4. Nature fiscale

Pour chaque article, le dernier prix d'achat de `products` est comparé à celui de l'import d'inventaire sur la fenêtre. Si la médiane des écarts |rapport - 1| dépasse 1,5 %, ou s'il n'existe aucun article comparable, la nature fiscale est « non déterminée » : la page affiche les unités, aucun montant.

Tolérance de 1,5 % : les arrondis au centime ne dépassent pas 1 %, alors que le plus petit taux de TVA de Martinique (2,1 %) produit un écart net. Aucun article comparable : jamais présumée.

Limite : un site sans import d'inventaire n'a aucun article comparable, donc nature non déterminée et aucun montant.

## 5. Accès

Serveur : fonction `dates_courtes_prevention_pertes(p_instant)`, refus `non_authentifie` et `droit_refuse`. Écran : règle d'affichage seulement. Vacataire, pompiste, caissier et renfort : aucun accès.

## 6. Écran

Skill `nexus-design-experience`, référentiel NEXUS-REFERENTIEL-CONCEPTION v1.0, bannière `assets/dates-courtes/`. États : données, vide, nature fiscale non déterminée, erreur avec « Réessayer », chargement ; Jour et Nuit ; 375 et 1280 px, sans débordement. Captures dans `captures-lot5/`.

## 7. Preuves

Banc local jetable : `outils/recette/dates_courtes_lot5/01_recette_dates_courtes_lot5.sql`, 47 contrôles, 0 en échec. Retour arrière : `docs/deploiement/retour-arriere-dates-courtes-lot5-20261122.sql`. Aucun cas joué sur Test.
