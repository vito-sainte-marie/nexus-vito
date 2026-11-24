# RLS lot 2 — relevé des lecteurs (fiche avant migration)

Migration : `supabase/migrations/20261125140000_rls_lot2_lectures_gestion_inventaire_lots.sql` (non appliquée, rien en Production).
Recette : `outils/recette/rls_lot2/01_recette_rls_lot2.sql` (Test uniquement, rollback final, rapport `RAPPORT_RLS_LOT2`).

## Ce que le lot change

1. **12 tables sans écran employé** : la lecture passe de « même site (ou créateur) » à « manager ou gérant du site, ou créateur sur une station à accès autorisé ». Les anciennes politiques SELECT sont remplacées par `select_gestion_<table>`.
   campagnes_nexus, campagnes_nexus_imports, carburant_sonde_alertes, moteur_documentaire_etat, employee_contraintes, employee_indisponibilites, controles_stock, panier_moyen_quotidien, stock_releves, marge_exceptions, product_locations, product_photos.
2. **controles_stock** : l'INSERT, ouvert à tout `authenticated`, est réservé au manager/gérant de la station.
3. **inventaire_lots** : la politique `ecriture_inventaire_lots` (ALL, même site) est remplacée par trois politiques INSERT/UPDATE/DELETE réservées au manager/gérant du site. `select_inventaire_lots` n'est pas touchée.
4. **recette_ci_site_test** (audits_caisse, carburant_releves) : supprimée sauf sur Test (identifiant système 7678069749886157684).

## Accessibilité : aucun écran employé ne casse

Les 20 pages qui lisent ces tables portent `nexusRequireGestion`, sauf NEXUS-App-v1. Dans celle-ci, les chargements concernés (marge, campagnes, `nexus-desktop.js:583`) tournent dans `initPosteManager`, donc manager/gérant seulement.

## Relevé des lecteurs et écrivains (.js et .html, hors tests)

| Table | Lectures | Écritures |
|---|---|---|
| campagnes_nexus | nexus-desktop.js:583 (manager), Campagne-v2 (+ Achats, Ventes, Livraison, Objectifs), Import-v1, Produits-v1, Campagne-v1 | Campagne-v2, Campagne-v1 |
| campagnes_nexus_imports | Campagne-v2, Import-v1, Campagne-v1 | idem |
| carburant_sonde_alertes | Brief-v1 | Brief-v1 (update) |
| moteur_documentaire_etat | Boite-Reception-v1 | — |
| employee_contraintes | Planning-v1 | Planning-v1 |
| employee_indisponibilites | Planning-v1, nexus-paye-donnees.js (Paye-v1) | Planning-v1 |
| controles_stock | Scanner-Stock-v1, nexus-conseiller-donnees.js | Scanner-Stock-v1 (insert) |
| panier_moyen_quotidien | Campagne-v2, nexus-import-donnees.js, Import-v1, Campagne-v1 | import |
| stock_releves | Campagne-v2 (+ Livraison), nexus-import-donnees, Import-v1, Scanner-Stock, Produits-v1, nexus-conseiller-donnees, Tempo-v1 | import |
| marge_exceptions | Scanner-v1, nexus-app-donnees `chargerMargePlusHome`, nexus-brief-donnees `chargerMargePlus`, Capital-v1, Parametres-Station-v1 | Parametres-Station-v1 |
| product_locations, product_photos | Produits-v1 | Produits-v1 |
| inventaire_lots | Tracabilite-v1, Inventaire-Manager-v1 | Tracabilite-v1 (insert, update) |

Autres références : `outils/reinitialiser-scenario-test.sh`, `migrations_import_pipeline.sql`, `supabase/repairs/20261112_nettoyage_doublons_products.sql` (superuser, hors RLS), `supabase/functions/api-v1/index.ts` (clé service-role : la RLS ne s'y applique pas).

## Fonctions de base

- SECURITY DEFINER, donc insensibles à la RLS de l'appelant : `nexus_detecter_sonde_a_verifier`, `nexus_stock_lire_etat_donnees`.
- Exécutées avec les droits de l'appelant (touchées seulement pour un appelant non gestionnaire, qui n'a pas d'écran pour les appeler) : `campagne_ventes_publier`, `generer_planning_mensuel`, `import_publier_panier`, `import_publier_stock`, `import_publier_ventes`, `verifier_depassements_heures`.

## Points à arbitrer ou à savoir

- Critère « Test » de la suppression de `recette_ci_site_test` : `pg_control_system().system_identifier`.
- Les politiques recréées sont `to authenticated` (elles étaient `public`).
- Écritures `inventaire_lots` réservées à la gestion : Tracabilite-v1 est une page gardée gestion.
- À signaler hors lot : d'autres politiques nommées « recette » existent sur `station_config`. Non traitées ici.
- L'empreinte d'artefact ne se mesure pas en local : `MIGRATIONS_REELLES_NOMBRE` passe à 353, la valeur de `MIGRATIONS_REELLES_EMPREINTE` est à mesurer par la CI ou Guardian.
