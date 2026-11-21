# Modèle de données et règles de consolidation

Propositions en prose et en tables. Aucun SQL exécutable. Aucun nom n'est figé avant validation. Rien n'est appliqué sur Test ni en Production.

Modèle de référence dans le dépôt : tables append-only à annulation tracée (`produits_justifications_marge`, `produits_tva_confirmations`) : auteur égal à l'utilisateur connecté, site obligatoire, politique par site, mise à jour limitée aux colonnes d'annulation, pas de suppression.

## 1. `dates_courtes_releves` (append-only)

| Colonne | Rôle |
|---|---|
| id | identifiant du relevé |
| site | station, obligatoire |
| ean | EAN normalisé, nul si produit sans EAN |
| reference_catalogue | identifiant stable du produit (produit sans EAN), nul si EAN |
| libelle_vu | nom affiché au moment du relevé, pour mémoire, jamais clé |
| dlc | date exacte (jour calendaire, fuseau Martinique) |
| type_date | DLC ou DDM (voir question 2) |
| quantite | entier strictement positif |
| provisoire | vrai si EAN inconnu du catalogue |
| photo_ref | référence de photo facultative |
| cle_idempotence | fabriquée sur l'appareil au geste |
| auteur | employé connecté |
| releve_le | date et heure |
| annule_le, annule_par, motif_annulation | annulation tracée |

Contraintes : site obligatoire ; ean ou reference_catalogue renseigné, jamais les deux vides ; quantité positive ; unicité (site, cle_idempotence).

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

## 3. Clé de groupe et consolidation

- Clé : site + ean normalisé + dlc. Sans EAN : site + reference_catalogue + dlc.
- Quantité consolidée = somme des quantités des relevés non annulés + somme des deltas non annulés, plancher à zéro.
- Calculée par vue ou fonction, jamais stockée comme vérité. Un éventuel cache est recalculable.
- Les relevés et corrections sont tous affichés sous le groupe.

## 4. Retraits : `dates_courtes_retraits` (append-only)

| Colonne | Rôle |
|---|---|
| id, site, groupe (clé) | identité |
| etat | signalé, retiré physiquement, démarque comptabilisée |
| quantite | unités concernées |
| auteur, cree_le, commentaire | trace |
| annule_le, annule_par, motif_annulation | annulation tracée |

Droits : l'état « démarque comptabilisée » exige manager, gérant ou créateur. Aucune écriture comptable. `inventaire_mouvements` n'est pas utilisée (`quart_id` obligatoire).

## 5. Réglage de station

Un réglage booléen « accès caissière », fermé par défaut, modifiable par manager, gérant ou créateur seulement, propre à la station. Peut se loger dans `station_config` ou dans une table dédiée (à arbitrer au lot 1).

## 6. Synchronisation

- États côté appareil : Enregistré, En attente, Refusé.
- Une opération rejouée porte la même clé d'idempotence : le serveur renvoie le résultat de la première.
- Refus du serveur (plancher, droits) : visible, jamais silencieux.

## 7. Droits sur les tables

- Politique de ligne : site égal au site de l'employé ; rôles selon `matrice-permissions.md`.
- Retrait des accès `anon` et `public` ; pas de suppression, de troncature ni de références pour `authenticated` ; mise à jour limitée aux colonnes d'annulation.

## 8. Points non vérifiés

- Couverture de `normalized_products.external_product_id` pour les produits sans EAN.
- Noms exacts des rôles du serveur.
- Emplacement du réglage de station.
