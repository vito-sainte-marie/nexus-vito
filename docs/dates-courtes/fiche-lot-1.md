# Fiche lot 1 : socle métier et données

Statut : documentation. Aucun code ni migration.

## 1. Objectif

Poser le modèle de relevé et de consolidation : relevés, corrections, groupes station + EAN + DLC, historique, anti-doublon, droits, isolation multisite.

## 2. Ce que le lot livre (une fois codé, plus tard)

- Table de relevés append-only, table de corrections append-only, vue ou fonction de consolidation.
- Droits portés par le serveur (voir `matrice-permissions.md`).
- Réglage de station d'ouverture de l'accès caissière.
- Détail des tables et clés : `modele-donnees.md`.

## 3. Règles de consolidation

- Clé de groupe : station + EAN normalisé + DLC exacte.
- Quantité consolidée = somme des relevés non annulés + somme des corrections (positives et négatives) non annulées, jamais inférieure à zéro.
- Exemple : 6 et 4 donnent 10 ; correction de moins 2 donne 8. Les deux relevés et la correction restent visibles.
- Deux DLC pour un même EAN : deux groupes.
- Jamais de fusion sur le nom commercial seul.
- Normalisation de l'EAN : chiffres seuls, EAN-8 et EAN-13 avec contrôle de la clé ; un UPC ou un code interne n'est pas converti de force en EAN.

## 4. Corrections

- « Ajouter des unités » : ajoute un relevé au groupe, sans toucher à l'existant.
- « Corriger le relevé » : écrit une correction signée (positive ou négative) liée à un relevé ou à un groupe.
- Chaque correction enregistre produit et DLC, quantité, auteur, date et heure, motif s'il est donné, cible.
- Changement de date : une correction moins n sur l'ancien groupe et une plus n sur le nouveau, liées entre elles.
- Annulation : trace conservée, motif obligatoire.
- Plancher à zéro : vérifié côté serveur sous verrou de ligne sur le groupe. Une correction qui ferait passer sous zéro est refusée, avec le refus visible.
- Une correction n'est ni une vente ni une démarque.

## 5. Produit sans EAN

Cas : pain, viennoiserie ou produit sans code-barres. Identification par le nom via la recherche rapide (suggestions dès les premières lettres, un geste). La clé est station + référence catalogue de la fiche choisie + DLC exacte. Jamais le texte tapé.

Stabilité de la référence catalogue, vérifiée dans le schéma :

- La table `products` contient une ligne par produit et par période d'import (`periode_debut`, `periode_fin`). Son `id` change à chaque période : il ne peut pas servir de clé stable. `article` est un libellé libre, `code_barres` est facultatif.
- Le candidat stable est `normalized_products.external_product_id` (unique par site, avec `barcode`, `label`, `product_id`), qui évite déjà toute identification par libellé.
- Si l'on clé sur `products.id`, deux imports de période différente donneraient deux groupes pour le même produit physique.

Deux options pour l'éviter :

- Option A : clé sur `normalized_products.external_product_id`. Pas de nouvelle table. Dépend du fait que cet identifiant est renseigné pour les produits concernés.
- Option B : table de références dédiée au module (identifiant stable propre, rattachée au produit choisi, créée au premier relevé). Indépendante de l'import, mais ajoute une table à entretenir.

Recommandation : A si la couverture de `external_product_id` est démontrée pour les produits sans EAN, sinon B. Cette couverture n'a pas été mesurée (aucune lecture Production sans GO). Voir `questions-metier.md`.

## 6. Anti-doublon

- Clé d'idempotence fabriquée sur l'appareil au moment du geste, envoyée avec l'opération.
- Une opération renvoyée (coupure, rejouement) compte une fois ; la deuxième réception est reconnue et renvoie le résultat de la première.
- Corrections simultanées : verrou de ligne sur le groupe, ordre d'arrivée serveur, plancher revérifié.

## 7. Droits et isolation

- `site_id` obligatoire sur chaque ligne ; politique de sécurité par ligne limitée au site de l'employé ; aucun accès `anon`.
- Pas de suppression. Mise à jour limitée aux colonnes d'annulation.
- Accès caissière : activé par réglage de station, seulement par manager, gérant ou créateur ; refusé par le serveur à toute autre personne, y compris renfort et caissière. Valable pour la station concernée uniquement.

## 8. Recettes du lot

Voir `plan-recette.md` : cas 1, 2, 3, 4, 5, 6, 7, 8, 10 et recettes caissière et produit sans EAN.

## 9. Limites

- Aucun nom de colonne n'est figé avant validation.
- Couverture réelle de `external_product_id` non mesurée.
- Rien n'a été joué sur Test.
