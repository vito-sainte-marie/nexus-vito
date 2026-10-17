# Essai de faisabilité : base Supabase jetable en CI

Date : 17/10/2026. Branche : `essai/base-jetable-ci-20261017`, partie du rail `5fb448ab`.
Cadre : GO de Frédéric du 17/10/2026, voie 2, expérimentation isolée uniquement.

## Verdict

**GO pour une intégration future**, sous les conditions du dernier paragraphe.

Les six critères du GO sont tenus. Le rejeu complet passe en 14 à 17 secondes. La preuve RLS établit à la fois des autorisations et des refus. Le schéma reconstruit correspond nom pour nom au schéma de Test. Aucun accès distant n'est nécessaire.

## Ce qui a tourné

Workflow isolé `.github/workflows/essai-base-jetable.yml`. Il se déclenche uniquement sur `essai/base-jetable-*`, avec un jeton en lecture seule, sans secret. Le script de rejeu refuse tout `PGHOST` qui n'est pas local.

- Image : `supabase/postgres:17.6.1.166`, la même version que Test.
  Empreinte `sha256:b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86`.
- Trois variantes dans le même run :

| Variante | Historique rejoué | Migrations | Réussies | Échecs | Rejeu | Job complet |
|---|---|---|---|---|---|---|
| branche, brut | rail (`supabase/migrations`) | 314 | 307 | 7 | 13 à 17 s | 46 s |
| production, brut | branche `production` (8e8b7ba) | 313 | 309 | 4 | 14 à 16 s | 54 s |
| branche, socle | rail + socle hors migrations | 314 | **314** | **0** | 14 à 17 s | 83 s |

Runs de référence : 39074639462, 39074775716, 39074923285, tous verts. Les résultats sont lus dans les annotations des check-runs.

## Premier échec (variante brute)

**#28 `20260731172849_remote_schema.sql`, ligne 235 : `relation "storage.objects" does not exist`.**

L'image Postgres crée le schéma `storage` mais pas ses tables. Sur Supabase, c'est le service Storage (`storage-api`) qui les crée, pas nos migrations.

Obstacles suivants (marqués « possiblement en cascade » par le script) :
- #74, #77, #238, #313 : même cause, `storage.objects` ou `storage.buckets` absents ;
- #259, #260 : rôle `nexus_ci_recette` inexistant. **Aucune migration ne le crée** : sur Test, il a été créé à la main. L'historique n'est donc pas autosuffisant sur ce point. Ces deux migrations n'existent que sur le rail.

La branche `production` rejouée est `8e8b7ba` (fusion de la PR #137 le 17/10 à 19:16 UTC), 313 fichiers.

Point de vigilance : sans `--single-transaction`, une migration qui échoue en cours de route reste appliquée jusqu'à la ligne fautive. C'est le cas de #28 dans la variante brute.

pg_cron et pg_net sont disponibles dans l'image réelle. Les échecs pg_cron de la répétition locale (PG16 nu) ne se reproduisent pas.

## La variante « socle »

Elle ajoute, avant le rejeu, exactement les deux prérequis que l'essai a mesurés et qui existent sur Test hors migrations :
1. le rôle `nexus_ci_recette`, en `NOLOGIN` et sans mot de passe ;
2. les tables Storage, créées par `supabase/storage-api:v1.83.5` lancé sur la base jetable, puis arrêté.

Aucune migration n'est réécrite ni sautée. La variante brute reste rejouée et visible à côté.

Résultat : 314 sur 314.

## Preuve RLS sous identités distinctes : 11 sur 11

Fichier `preuve-rls.sql`. Une seule transaction, terminée par ROLLBACK, avec des données synthétiques préfixées `essai-`. L'identité est endossée comme le fait PostgREST : rôle et claims du JWT.

| Cas | Attendu | Obtenu |
|---|---|---|
| anon lit les relevés | refus | refus |
| `current_employee_site_id()` pompiste A, manager B, anon | site A, site B, null | idem |
| pompiste A lit | site A seul | site A seul |
| manager B lit | site B seul | site B seul |
| manager A écrit sur le site B | refus | refus |
| manager A écrit sur son site | accepté | accepté |
| pompiste A modifie le site B | 0 ligne | 0 ligne |
| manager A supprime sur son site | 0 ligne | 0 ligne |
| contre-témoin propriétaire | 3 lignes | 3 lignes |

La preuve sait aussi échouer. En répétition locale, deux mutations ont été appliquées, puis vérifiées comme réellement en place avant lecture :
- `select using (true)` : 8 sur 11, les cas 1, 3 et 4 tombent ;
- `insert with check (true)` : 9 sur 11, les cas 5 et 9 tombent.

Retour à l'état sain : 11 sur 11.

## Fidélité par rapport à Test

Comparaison en lecture seule, sur le catalogue uniquement (noms, aucune donnée).

**Le rail et production ont divergé.**
- Le rail n'a pas les 21 migrations livrées en production depuis le 05/10 (régularisations, continuité FDJ, poste le plus fréquent…).
- Production n'a pas 22 migrations du rail (rôle de recette, mode Test, droits de recette sur station_config…).
- Test a reçu les deux.

Aucune des deux branches, seule, ne reconstruit Test.

**Réunion des deux reconstructions comparée à Test** (empreinte md5 des listes triées) :

| | Reconstruction (branche socle ∪ production) | Test | Empreinte |
|---|---|---|---|
| tables | 175 | 175 | identique (`315d77ed…`) |
| politiques | 388 | 388 | identique (`09ecf6b0…`) |
| fonctions | 169 | 169 | identique (`9b3b109e…`) |

Pour les fonctions, la version de production de `fdj_incrementer_appro_shift_count` (SECURITY DEFINER) a été retenue, puisque c'est la plus récente.

Limites de fidélité, à connaître avant toute intégration :
1. La comparaison porte sur les **noms** des tables, politiques et signatures de fonctions. Les corps de fonctions, les expressions de politiques, les GRANT et les déclencheurs ne sont pas comparés.
2. Test enregistre trois versions sans fichier dans le dépôt : `20261002233051`, `20261012200026`, `20261013220411`. Elles n'ont laissé aucune trace au niveau des noms. Leur contenu n'est pas connu.
3. Cinq fichiers du rail n'apparaissent pas sous leur version dans `schema_migrations` de Test : 20260919103000, 20261001160000, 20261002000000, 20261004200000, 20261004200100. Ils sont probablement appliqués sous une autre version, à vérifier.
4. Les deux migrations du 17/10 (20261017120000, 20261017130000) ne sont pas encore sur Test.
5. Le socle Storage vient d'une version de `storage-api` qui peut différer de celle de Test.
6. Les données de Test ne sont pas reproduites, et c'est voulu. Les preuves utilisent un semis synthétique.

## Ce que l'essai n'a pas touché

- `tests.yml`, le rail (toujours à `5fb448ab`) et le relais : intacts. Aucun commentaire n'a été publié sur #28 depuis le premier push de l'essai.
- Bases Test et Production : aucune écriture. Test a seulement été lu, sur le catalogue, à travers les accès existants.
- Secrets et privilèges : aucun créé, aucun élargi. Le mot de passe du conteneur est local au runner et disparaît avec lui.

## Recommandation

GO pour une intégration future, dans un lot distinct, à quatre conditions :
1. **Choisir l'historique de référence.** Tant que le rail et production divergent, une base jetable ne reproduit Test qu'en rejouant les deux. Réconcilier les deux branches vaut mieux que de câbler ce contournement.
2. **Écrire le rôle `nexus_ci_recette` dans une migration** (ou le documenter comme prérequis d'environnement), pour que l'historique devienne autosuffisant.
3. **Garder la variante brute à côté de la variante socle**, pour qu'un nouvel écart hors migrations se voie toujours.
4. **Traiter l'ordre de la boucle à part** (preuves avant décision de l'arbitre), comme le prévoit le GO, avec son étude des contrats, échecs et reprises.

## Rejouer l'essai

Pousser un commit sur une branche `essai/base-jetable-*`. Les résultats arrivent en annotations du run « Essai base jetable (isolé) ». Les listes d'inventaire sont découpées en morceaux numérotés, car une annotation est tronquée à 4 096 caractères.
