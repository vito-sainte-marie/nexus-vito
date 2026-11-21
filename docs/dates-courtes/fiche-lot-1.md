# Fiche lot 1 : socle métier et données

Statut : documentation. Aucun code ni migration.

## 1. Objectif

Poser le modèle de relevé et de consolidation : relevés, corrections, tournées, groupes station + EAN + date limite, historique, anti-doublon, droits, isolation multisite.

Une seule date est saisie, la « Date limite », sans type : DLC et DDM sont traitées de la même façon (même clé, mêmes seuils, même règle).

## 2. Ce que le lot livre (une fois codé, plus tard)

- Table de relevés append-only, table de corrections append-only, tables de tournées et de correspondances, vue ou fonction de consolidation.
- Droits portés par le serveur (voir `matrice-permissions.md`).
- Réglage de station d'ouverture de l'accès caissière.
- Détail des tables et clés : `modele-donnees.md`.

## 3. Règles de consolidation

- Clé de groupe : station + EAN normalisé + date limite exacte. Sans EAN : station + libellé normalisé + date limite exacte (section 5).
- Deux dates limites pour un même EAN : deux groupes.
- Jamais de fusion sur le nom commercial seul.
- Normalisation de l'EAN : chiffres seuls, EAN-8 et EAN-13 avec contrôle de la clé ; un UPC ou un code interne n'est pas converti de force en EAN.

Tournée (l'employé ne choisit rien, le serveur rattache le relevé à la tournée en cours) :

- Les relevés d'un même groupe dans la même tournée s'additionnent : 4 au frigo et 3 en gondole donnent 7. Les saisies d'un même EAN et d'une même date limite se cumulent, avec corrections positives et négatives.
- Chaque nouvelle tournée est un contrôle indépendant : toutes les quantités actives repartent de zéro. Les quantités de la tournée précédente restent consultables dans l'historique, présentées comme historique ; elles ne s'additionnent jamais à la nouvelle tournée.
- Une date non revue dans la tournée en cours n'a ni alerte active ni demande de retrait. Son absence n'est ni une vente, ni une destruction, ni une démarque : aucun mouvement n'est écrit.
- Parcours libre dans toute la boutique : pas de zones, pas de confirmation des anciennes dates.
- Une tournée n'est jamais fermée. Par défaut, une par semaine calendaire (lundi 00:00, heure de la Martinique), par station. Un manager, un gérant ou un créateur peut en ouvrir une à la main : geste tracé, avec une confirmation intégrée à l'écran, car il remet toutes les quantités actives à zéro. Proposition à valider par Guardian.
- « Corriger le relevé » reste réservé aux erreurs de saisie.

Quantité active d'un groupe : relevés non annulés, plus corrections non annulées, moins retraits physiques, de la tournée en cours seulement, jamais inférieure à zéro.

Quels gestes comptent :

- Un relevé, une correction ou un retrait appartient à la tournée de son geste et ne compte que dans celle-ci.
- Un geste fait hors ligne compte à l'heure du geste (relevée sur l'appareil), jamais à l'heure de réception par le serveur.
- Une correction ou un retrait d'une tournée précédente n'a aucun effet sur la quantité active de la nouvelle tournée ; il reste dans l'historique, et un retrait reste dans « à comptabiliser ».
- Exemple : 6 et 4 donnent 10 ; correction de moins 2 donne 8. Les deux relevés et la correction restent visibles.
- Les relevés, corrections et retraits de toutes les tournées restent affichés sous le groupe, ceux des tournées précédentes comme historique.

Geste « trouvé et retiré » : le lundi matin, un renfort trouve 3 articles périmés d'un produit pas encore relevé dans la tournée. La quantité active est zéro et le plancher refuserait un retrait seul. Un geste unique écrit un relevé de 3 et un retrait de 3 : quantité active zéro, 3 dans « à comptabiliser », aucun refus de plancher. Renfort autorisé, car le geste combine deux droits déjà donnés au renfort (relever, confirmer un retrait physique) et aucun droit comptable.

## 4. Corrections

- « Ajouter des unités » : ajoute un relevé au groupe, sans toucher à l'existant.
- « Corriger le relevé » : écrit une correction signée (positive ou négative) liée à un relevé ou à un groupe.
- Chaque correction enregistre produit et date limite, quantité, auteur, date et heure, motif s'il est donné, cible.
- Changement de date : une correction moins n sur l'ancien groupe et une plus n sur le nouveau, liées entre elles.
- Annulation : trace conservée, motif obligatoire.
- Plancher à zéro : vérifié côté serveur sous verrou de ligne sur le groupe. Une correction qui ferait passer sous zéro est refusée, avec le refus visible.
- Une correction n'est ni une vente ni une démarque.

## 5. Produit sans EAN et EAN inconnu

Cas : pain, viennoiserie ou produit sans code-barres. Identification par le nom via la recherche rapide (suggestions dès les premières lettres, un geste).

Clé retenue : station + libellé normalisé + date limite exacte. Libellé normalisé : date en tête retirée, casse et espaces unifiés. `libelle_vu` reste une mémoire d'affichage.

Constat de Guardian, Production, lecture seule, filtrée sur la station, sur GO du pilote (21/11) :

- `normalized_products` est vide en Production : `external_product_id` ne peut pas servir de clé.
- Deux dernières périodes d'import : 64 articles sans EAN dans la dernière, 56 dans la précédente. 48 retrouvés avec un libellé identique, 49 avec un libellé normalisé, 0 doublon de libellé normalisé dans une même période.
- Les 15 autres sont surtout hors périmètre (cartes prépayées, timbre, consigne gaz, codes promo) ou de vraies nouveautés. Un seul renommage alimentaire : « Pain Chocolat - 68P » devient « Pain Chocolat - 96P ».
- Pour les produits avec EAN : dans une même période, aucun EAN n'est porté par deux fiches (0 sur 784 dans la période en cours, 0 dans la précédente). D'une période à l'autre, 6 EAN changent de libellé : 4 par date en tête, 2 par renommage. La clé EAN les garde dans un seul groupe.

Renommage : un geste manager tracé « même produit que… » (table de correspondances, annulable, rarement utilisé) rattache l'ancien libellé au nouveau, historique intact. Le renfort ne peut pas le poser. Tant que rien n'est fait, les deux libellés donnent deux groupes.

Contrôle prévu : une liste des groupes dont le libellé normalisé disparaît d'un import à l'autre, pour que le manager les rattache. La couverture au delà des deux périodes mesurées n'est pas mesurée.

EAN inconnu du catalogue :

- L'entrée provisoire porte l'EAN lu et un nom libre facultatif, marquée « provisoire ». NEXUS ne crée aucune référence.
- Quand l'EAN apparaît dans un import, le groupe rejoint la fiche du catalogue de lui-même, historique intact, marque retirée.
- Le manager voit la liste des produits encore provisoires et peut rattacher une ligne à la main à un produit sous un autre code (geste tracé : auteur, date ; renfort refusé).

## 6. Anti-doublon

- Clé d'idempotence fabriquée sur l'appareil au moment du geste, envoyée avec l'opération.
- Une opération renvoyée (coupure, rejouement) compte une fois ; la deuxième réception est reconnue et renvoie le résultat de la première.
- Corrections simultanées : verrou de ligne sur le groupe, ordre d'arrivée serveur, plancher revérifié.

## 7. Droits et isolation

- `site_id` obligatoire sur chaque ligne ; politique de sécurité par ligne limitée au site de l'employé ; aucun accès `anon`.
- Pas de suppression. Mise à jour limitée aux colonnes d'annulation.
- Accès caissière : activé par réglage de station, seulement par manager, gérant ou créateur ; refusé par le serveur à toute autre personne, y compris renfort et caissière. Valable pour la station concernée uniquement. Portée de lecture (ses propres relevés) et emplacement du réglage : hypothèses de travail.
- Ouverture manuelle d'une tournée (avec confirmation à l'écran et trace du geste), rattachement d'un produit provisoire et geste « même produit que… » : manager, gérant, créateur ; refusés au renfort et à la caissière.

## 8. Recettes du lot

Voir `plan-recette.md` : cas 1 à 5, 6b, 6c, 7, 8, 10, 12 à 17, 16b, 21 à 32, 34 (et 6, 15 pour la part lot 1).

## 9. Limites

- Aucun nom de colonne n'est figé avant validation.
- Couverture du libellé normalisé mesurée sur deux périodes seulement.
- Noms de rôles du serveur à vérifier contre la base.
- Rien n'a été joué sur Test.
