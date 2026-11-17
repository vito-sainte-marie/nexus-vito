# Dossier technique T2 : registres tarifaires versionnés (projet, non exécuté)

Version 6 du 16/11/2026 : procédure d'exécution contrôlée sur Test, préparée et répétée en local, non lancée (execution_test/PROCEDURE-EXECUTION-TEST.md). Aucune migration exécutée en Test ni en Production. Decenium non touché.
Le projet Test n'a été lu qu'en lecture seule (catalogue : rôles, fonctions, colonnes, contraintes, politiques, privilèges).

| Dossier | Contenu |
| --- | --- |
| `migrations/` | Quatre migrations Test envisagées (ordre : 100000, 100100, 100200, 100300), données initiales de recette Sainte-Marie, deux retours arrière. |
| `recette/` | Socle reconstruit depuis le catalogue réel de Test, 159 contrôles, script de recette sur base PostgreSQL 16 jetable, résultats. |
| `adaptateur/` | Adaptateur registres vers contexte du moteur T1, 8 tests, non-régression sur les 440 références de Sainte-Marie. |
| `comptes_recette/` | Garde du projet Test, création et désactivation des deux gérants de recette, preuve d'accès pour Test. Non exécutés. |
| `execution_test/` | Procédure d'exécution Test, preuves avant/après en lecture seule, contrôle entre migrations, empreintes SHA-256. |
| `v1/` | Migrations de la version 1, pour comparaison. |

## Réponse aux six conditions

1. Fonctions d'identité et de rôle. `auth.uid()`, `current_employee_site_id()`, `current_employee_role()` et `je_suis_createur()` sont recopiées
   à l'identique depuis Test dans `recette/00_*` et `recette/01_*`. `auth.uid()` de Test lit `request.jwt.claim.sub` puis `request.jwt.claims` : contrôle 99e.
2. Fonctions SECURITY DEFINER. Les deux fonctions de la version 1 sont supprimées. Raison : leur propriétaire, `postgres`, a BYPASSRLS en Test,
   donc elles lisaient tous les sites. La règle « pas de rétrogradation » passe par un déclencheur ordinaire, exécuté avec les droits de la personne.
   Aucune fonction `tarif_*` n'est SECURITY DEFINER (contrôle 99). Les trois fonctions d'aide existantes restent SECURITY DEFINER, comme en Test :
   elles ne lisent que la ligne `employees` de la personne connectée.
3. Intégrité. Clés étrangères composites (id, site) pour les versions, les applications et les décisions ; déclencheur d'application (prix décidé actif,
   même site, nature autre que « maintenu ») ; vue `v_tarif_incoherences` ; service_role privé de UPDATE (hors annulation), DELETE et TRUNCATE ;
   anon privé d'EXECUTE sur les fonctions tarif. Contrôles 87 à 99f.
4. Exceptions effectives. Une ligne par référence, par priorité : décision du gérant (validee ou levee), sinon produit d'appel enregistré (validé),
   sinon candidature ou refus. Une candidature ou un refus ne neutralise plus un produit d'appel ; il est signalé dans `candidature_ou_refus_sans_effet`.
   Contrôles 46, 47c, 80 à 86.
5. Retours arrière. `retour_arriere_base_jetable_t2.sql` refuse de tourner si une ligne existe (contrôle 70) et supprime tout sur base vide (72).
   `retour_arriere_avec_donnees_t2.sql` archive dans un schéma daté, vérifie les comptes, coupe les accès et retire les vues, sans détruire de ligne (71).
6. Compatibilité. Socle rebâti depuis le catalogue réel : base et tables détenues par `postgres` non superutilisateur avec BYPASSRLS,
   `auth` détenu par `supabase_auth_admin`, privilèges par défaut de Supabase (ALL pour anon, authenticated, service_role). Les migrations
   s'exécutent sous ce rôle, deux fois de suite (idempotence). Écarts connus : PostgreSQL 16 ici contre 17.6 en Test ; trois déclencheurs de `sites`
   non reproduits, sans lien avec T2.

## Point d'attention

Le rôle `postgres` (éditeur SQL, connecteur MCP) et `service_role` contournent la RLS : pour eux, l'isolation par site repose sur les clés étrangères
composites et les déclencheurs, pas sur les politiques. Les registres de recette doivent donc être saisis avec un compte gérant de Test, sous RLS.

## Rejouer

- `bash recette/executer_recette_locale.sh` (crée puis détruit une base locale ; résultat : 159 OK, 0 échec) ;
- `node adaptateur/test_adaptateur_registres_t2.js` (8 tests) ;
- `node adaptateur/non_regression_t1_t2.js` (440 références identiques à T1 v2 ; nécessite le dossier `t1` voisin).
