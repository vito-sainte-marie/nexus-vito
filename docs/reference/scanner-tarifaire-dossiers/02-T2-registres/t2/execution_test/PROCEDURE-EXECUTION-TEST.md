# Procédure d'exécution contrôlée des migrations T2 sur Supabase Test (préparée, NON LANCÉE)

Projet visé : Supabase Test `udljdqxerrbbbajxubfn`, et lui seul. Production et Decenium hors périmètre.
Lancement uniquement sur autorisation écrite distincte. La création des identités de recette et les scripts 40, 50, 41
et les données de recette relèvent d'une autre autorisation.

## Ce que l'autorisation doit couvrir

1. L'envoi unique de la sonde `05_sonde_arret_sur_erreur.sql`, qui échoue toujours, puis les quatre envois de migration, dans l'ordre, et rien d'autre.
2. Les lectures de preuve (scripts 10, 20, 30), qui ne sont qu'une requête SELECT chacune.
3. Retour arrière : AUCUN retour arrière automatique (contrat du 16/11/2026, 21 h 56). En cas d'arrêt, même avec des objets partiels,
   compte rendu et attente d'un nouvel accord avant `retour_arriere_base_jetable_t2.sql`.

## Gel des fichiers

Les fichiers envoyés sont ceux du dossier v6, octet pour octet : `EMPREINTES-SHA256.txt`.
Avant chaque envoi, l'empreinte du fichier est recalculée et comparée. Au moindre écart : arrêt.

## Déroulé

| Étape | Action | Attendu | Si écart |
| --- | --- | --- | --- |
| 0 | `10_preuve_avant.sql` (lecture) | `est_projet_test` vrai, `objets_tarif_existants` 0, `sites_recette` 2, dernière migration 20261115213306 | Arrêt. Une migration plus récente que 20261115213306 est examinée avant de continuer. |
| 0 bis | Envoi de `05_sonde_arret_sur_erreur.sql`, nom `tarif_sonde_arret_sur_erreur` ; puis `06_controle_sonde.sql` (lecture) | Erreur renvoyée ; `table_sonde` faux, `sonde_enregistree` 0 : le canal arrête et annule tout | Arrêt : aucune migration T2 par ce canal |
| 1 | Envoi de `20261118100000_tarif_registres.sql`, nom `tarif_registres` | Aucune erreur ; script 20 : `10:1:0:0:0:0` | Arrêt |
| 2 | Envoi de `20261118100100_tarif_registres_controles_rls.sql`, nom `tarif_registres_controles_rls` | Script 20 : `10:5:13:30:0:10` | Arrêt |
| 3 | Envoi de `20261118100200_tarif_registres_vues.sql`, nom `tarif_registres_vues` | Script 20 : `10:5:13:30:11:10` | Arrêt |
| 4 | Envoi de `20261118100300_tarif_registres_comptes_desactives.sql`, nom `tarif_registres_comptes_desactives` | Script 20 : `10:5:13:40:11:10` | Arrêt |
| 5 | `30_preuve_apres.sql` (lecture) | `empreinte_hors_t2` identique à l'étape 0 ; 10 tables, 10 RLS forcées, 11 vues security_invoker, 5 fonctions tarif, 0 SECURITY DEFINER, 10 politiques restrictives, 0 droit anon, 0 DELETE/UPDATE/TRUNCATE, 0 ligne ; 4 migrations T2 enregistrées dans l'ordre | Arrêt et compte rendu |

Avant chaque envoi (étapes 1 à 4) : empreinte SHA-256 du fichier recalculée et comparée, script 20 relancé (état de l'étape précédente,
identifiant système de Test vérifié par la garde en tête du fichier). Après chaque envoi : script 20 conservé dans `preuves/`.

Format du script 20 : tables, fonctions, déclencheurs, politiques, vues, tables à RLS forcée.

## Arrêt immédiat sur erreur SQL

- Dans un fichier : chaque fichier part en un seul envoi et ne contient ni BEGIN ni COMMIT. PostgreSQL exécute alors l'ensemble
  comme une seule transaction : la première erreur annule tout le fichier. La documentation de Supabase ne précise pas ce point
  pour l'envoi de migration. Après toute erreur, le script 20 vérifie donc que l'état est resté celui de l'étape précédente.
- Entre deux fichiers : aucun envoi après une erreur ou un état différent de l'attendu. Pas de nouvel essai sans analyse et sans nouvelle autorisation.
- Par le canal réel : la sonde de l'étape 0 bis crée une table puis provoque une erreur dans le même envoi. Si le canal arrête et annule,
  il ne reste ni table ni migration enregistrée. Vérifié en local pour un envoi unique de plusieurs instructions : aucune table restante.
- Gardes intégrées : chaque migration s'arrête d'elle-même hors du projet Test, et l'ordre 100000, 100100, 100200, 100300 est imposé par les fichiers.
- Répétition sur le socle local de Test (contrôles 160 à 168) : quatre étapes isolées, une transaction chacune, états intermédiaires conformes ;
  une erreur introduite au milieu de 100000 ne laisse aucun objet ; preuves avant et après identiques hors T2 ; retour arrière gardé.

## Preuves conservées

Dans `preuves/` du dossier, horodatées : sortie de l'étape 0, résultat de chaque envoi, sortie du script 20 après chaque étape,
sortie de l'étape 5, empreintes SHA-256 des fichiers envoyés. Elles sont jointes au compte rendu d'exécution.

## Variante : exécution par psql, depuis votre poste

`psql "$URL_TEST" -v ON_ERROR_STOP=1 --single-transaction -f <fichier>`, un fichier à la fois, dans l'ordre, avec les mêmes lectures 10, 20 et 30.
L'adresse de connexion reste dans une variable d'environnement, jamais dans un fichier. Cette voie n'inscrit pas les migrations dans
l'historique Supabase : à éviter, sauf décision contraire.

## Point d'attention

L'envoi de migration enregistre un numéro de version horodaté au moment de l'envoi, différent du nom des fichiers. C'est déjà le cas
des migrations récentes de Test. La règle du dépôt (`supabase/README-migrations.md`) demande de garder les numéros enregistrés par Supabase :
les fichiers du dépôt seront renommés après exécution, dans la PR T2.
