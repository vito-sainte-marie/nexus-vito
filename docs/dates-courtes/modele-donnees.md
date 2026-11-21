# Modèle de données et règles de consolidation

Propositions en prose et en tables. Aucun SQL exécutable. Aucun nom n'est figé avant validation. Rien n'est appliqué sur Test ni en Production.

Modèle de référence dans le dépôt : tables append-only à annulation tracée (`produits_justifications_marge`, `produits_tva_confirmations`) : auteur égal à l'utilisateur connecté, site obligatoire, politique par site, mise à jour limitée aux colonnes d'annulation, pas de suppression.

Une seule date par relevé, la « date limite », sans type : DLC et DDM sont traitées de la même façon (même clé, mêmes seuils, même règle).

## 1. `dates_courtes_releves` (append-only)

| Colonne | Rôle |
|---|---|
| id | identifiant du relevé |
| site | station, obligatoire |
| ean | EAN normalisé, nul si produit sans EAN |
| libelle_normalise | libellé normalisé (date en tête retirée, casse et espaces unifiés), clé des produits sans EAN, nul si EAN |
| libelle_vu | nom affiché au moment du relevé, pour mémoire |
| nom_libre | nom saisi à la main, facultatif, pour une entrée provisoire |
| date_limite | date exacte (jour calendaire, fuseau Martinique) |
| quantite | entier strictement positif |
| provisoire | vrai si EAN inconnu du catalogue au moment du relevé |
| tournee_id | tournée à laquelle appartient le relevé (voir section 3) |
| photo_ref | référence de photo facultative |
| cle_idempotence | fabriquée sur l'appareil au geste |
| auteur | employé connecté |
| releve_le | date et heure |
| annule_le, annule_par, motif_annulation | annulation tracée |

Contraintes : site obligatoire ; ean ou libelle_normalise renseigné, jamais les deux vides ; quantité positive ; unicité (site, cle_idempotence).

## 2. `dates_courtes_corrections` (append-only)

| Colonne | Rôle |
|---|---|
| id, site | identifiant, station |
| releve_id ou groupe | cible : relevé précis ou groupe (clé de groupe) |
| delta | entier signé non nul |
| motif | facultatif ; obligatoire pour une annulation |
| lien_changement_date | rattache les deux lignes d'un changement de date |
| cle_idempotence, auteur, cree_le | comme ci-dessus |
| annule_le, annule_par, motif_annulation | annulation tracée |

Contrainte : l'application d'un delta ne peut pas rendre la quantité consolidée du groupe négative, vérifié sous verrou de ligne.

## 3. Tournées, clé de groupe et consolidation

Tournée :

- Une tournée par semaine calendaire par défaut (lundi 00:00, heure de la Martinique), par station. Une tournée n'est jamais fermée : la suivante prend le relais.
- Un manager, un gérant ou un créateur peut ouvrir une nouvelle tournée à la main (geste tracé, voir `matrice-permissions.md`). L'écran demande une confirmation, car l'ouverture remet toutes les quantités actives à zéro. Proposition à valider par Guardian.
- L'employé ne choisit rien : le relevé est rattaché à la tournée en cours par le serveur.

Clé de groupe :

- Avec EAN : site + EAN normalisé + date limite.
- Sans EAN : site + libellé normalisé + date limite. Une table de correspondance (section 3 bis) permet au manager de dire « même produit que… » quand un libellé change.
- `normalized_products` est vide en Production : `external_product_id` ne peut pas servir de clé (constat de Guardian, voir `questions-metier.md`).

Quantité active d'un groupe :

1. Dans la tournée en cours : somme des relevés non annulés de cette tournée. Les relevés d'une même tournée s'additionnent (4 au frigo + 3 en gondole = 7).
2. On ajoute les corrections non annulées et on soustrait les retraits physiques (section 4) de la même tournée, plancher à zéro.
3. Chaque tournée est un contrôle indépendant : à l'ouverture d'une tournée, toutes les quantités actives repartent de zéro. Les quantités des tournées précédentes restent consultables comme historique, jamais comme quantités actives, et ne s'additionnent jamais.
4. Un relevé, une correction ou un retrait appartient à la tournée de l'heure de son geste (appareil, y compris hors ligne) et ne compte que dans celle-ci. Les gestes d'une tournée précédente restent dans l'historique ; un retrait reste dans « à comptabiliser ».
5. Une date non revue dans la tournée en cours a une quantité active nulle : aucune alerte active, aucune demande de retrait, aucun mouvement écrit. Son absence n'est ni une vente, ni une destruction, ni une démarque.
6. Calculée par vue ou fonction, jamais stockée comme vérité. Un éventuel cache est recalculable.

Les relevés, corrections et retraits de toutes les tournées restent affichés sous le groupe.

### 3 bis. Tables annexes

- `dates_courtes_tournees` : id, site, ouverte_le, ouverte_par, origine (automatique du lundi ou manuelle). Append-only.
- `dates_courtes_correspondances` : id, site, libelle_normalise_ancien, libelle_normalise_nouveau, auteur, cree_le, annule_le, annule_par, motif_annulation. Geste manager « même produit que… ». Rarement utilisée. Append-only.
- Rattachement d'un produit provisoire à un produit existant sous un autre code : même mécanique (ligne tracée, annulable).
- Produit provisoire dont l'EAN apparaît ensuite dans un import : le groupe rejoint la fiche du catalogue de lui-même, sans geste et sans création de référence ; l'historique est intact.

## 4. Retraits : `dates_courtes_retraits` (append-only)

| Colonne | Rôle |
|---|---|
| id, site, groupe (clé) | identité |
| etat | signalé, retiré physiquement, démarque comptabilisée |
| quantite | unités concernées |
| auteur, cree_le, commentaire | trace |
| annule_le, annule_par, motif_annulation | annulation tracée |

- Le retrait physique diminue la quantité active de la tournée de son geste (section 3, point 4). C'est un mouvement à part entière, ni une correction ni une démarque : 8 relevés moins 3 retirés donnent 5, l'historique indique « 3 retirés par R1 à 10:05 ».
- Geste « trouvé et retiré » : pour un retrait sans relevé préalable dans la tournée, un seul geste écrit un relevé de 3 et un retrait de 3 (deux lignes liées, même clé d'idempotence de geste). Quantité active zéro, 3 dans « à comptabiliser », aucun refus de plancher.
- Les unités retirées alimentent la liste « à comptabiliser » du manager. L'état « démarque comptabilisée » exige manager, gérant ou créateur ; le renfort ne peut pas le poser. Aucune écriture comptable.
- `inventaire_mouvements` n'est pas utilisée (`quart_id` obligatoire).

## 5. Réglage de station

Un réglage booléen « accès caissière », fermé par défaut, modifiable par manager, gérant ou créateur seulement, propre à la station. Peut se loger dans `station_config` ou dans une table dédiée (à arbitrer au lot 1). Hypothèse de travail : la caissière autorisée ne voit que ses propres relevés.

## 6. Synchronisation

- États côté appareil : Enregistré, En attente, Refusé.
- Une opération rejouée porte la même clé d'idempotence : le serveur renvoie le résultat de la première.
- Refus du serveur (plancher, droits) : visible, jamais silencieux.
- Chaque geste (relevé, correction, retrait) porte l'heure du geste relevée sur l'appareil, en plus de la clé d'idempotence. Le rattachement à la tournée utilise l'heure du geste, jamais l'heure de réception : un geste fait hors ligne le dimanche 23:50 et reçu le lundi 8:00 compte dans la tournée du dimanche. L'heure de réception est conservée pour la trace.

## 7. Droits sur les tables

- Politique de ligne : site égal au site de l'employé ; rôles selon `matrice-permissions.md`.
- Retrait des accès `anon` et `public` ; pas de suppression, de troncature ni de références pour `authenticated` ; mise à jour limitée aux colonnes d'annulation.

## 8. Points non vérifiés

- Noms exacts des rôles du serveur.
- Emplacement du réglage de station.
- Couverture du libellé normalisé au delà des deux périodes mesurées (voir `questions-metier.md`).
