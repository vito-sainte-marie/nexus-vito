# Base jetable, Journal Piste et helpers d'identité : livrables de l'arbitrage du 17/10/2026

Branche `essai/base-jetable-ci-20261017`. Run de référence **39076525882** (commit `cc6445da`), trois jobs verts.
Toutes les épreuves ont tourné dans le runner jetable (`supabase/postgres:17.6.1.166`, même version que Test), sur trois reconstructions : rail brut, rail avec socle, production brute.
Test n'a été que **lu** (catalogue). Production n'a pas été interrogée.

Une réussite sur base jetable n'est pas une preuve de compatibilité avec Supabase Test. Les écarts connus sont listés au livrable 2.

---

## Fait nouveau, à lire en premier : la migration Journal Piste est appliquée sur Test

Constaté en lecture seule, le 17/10 vers 22:40 UTC :
- `supabase_migrations` porte `20261017140000_journal_piste_config_alertes_qualifications`, sans instructions enregistrées (tampon posé à la main) ;
- les trois tables existent, une configuration est posée (`vito-sainte-marie`, version 1, 22:31:22 UTC, `modifie_par` vide) ;
- le job `nexus-journal-piste` (jobid 34, utilisateur `postgres`) est actif et a tourné une fois, avec succès, à 22:35 UTC ;
- les 16 fonctions du lot sont présentes. 15 corps sont identiques octet pour octet à request-3. `piste_evaluer_site` ne diffère que par des commentaires retirés.

Chronologie : request-3 publiée à 22:27:50 UTC, verdict **STOP_REQUIRED** de l'arbitre à 22:30:07, application à 22:31:22. Aucun commit ni commentaire ne l'annonce. Selon Frédéric, l'application vient de l'autre session Claude Code. Rien n'a été défait : c'est une écriture sur Test, elle relève de sa décision.

---

## Livrable 1. Recette Journal Piste sur base jetable

### Résultats, identiques sur les trois reconstructions

| Épreuve | Résultat |
|---|---|
| Preuve **avant** la migration | échoue proprement : `relation "public.carburant_index_config" does not exist` |
| Migration request-3 | appliquée, 47 à 82 ms, ses postconditions internes passent |
| Preuve de request-3 **après**, telle quelle | **107 OK / 2 KO** (P5 et P6) |
| Même preuve, motif LIKE corrigé | **109 OK / 0 KO** |
| Planification | un seul job `nexus-journal-piste`, utilisateur `postgres`, actif. `authenticated` et `anon` n'ont pas l'usage du schéma `cron` |
| Mutants | **23 tués sur 23**, avec la preuve d'origine comme avec la preuve corrigée |

### Les deux KO viennent de la preuve, pas de la migration

P5 et P6 désignent les fonctions du lot par `like any (array['%_piste','piste_%','%_piste_%'])`. Dans LIKE, `_` remplace n'importe quel caractère. Le motif `'%_piste_%'` attrape donc `est_pompiste_du_jour` (« ...m**piste_**du... »), une fonction partagée préexistante, exécutable par `anon`, avec `search_path=public`.

La base jetable de request-3 ne rejouait pas l'historique, d'où son 109/109. Sur une base qui a tout l'historique, **Test compris**, la preuve d'origine rendra 107/109.

Correction : échapper `_` (`'%\_piste'`, `'piste\_%'`, `'%\_piste\_%'`). C'est le seul changement. Il est produit par `journal-piste/corriger-preuve.sh`, à côté de l'original, et il est vérifié : 2 occurrences remplacées, 4 lignes de diff. Le corriger dans la preuve officielle revient à la session qui porte le lot.

### Mutants

Chaque mutant affaiblit une seule protection. Il est joué avec la preuve dans une transaction annulée, puis la base est vérifiée revenue à son état. Un mutant n'est compté comme tué que s'il fait apparaître un KO que le témoin ne rend pas, **valeur obtenue comprise**. Sans cette règle, le faux KO P5 masquait tout mutant qui ne faisait que l'aggraver.

| Mutant | Tué par |
|---|---|
| 17 `revoke` retirés un par un | 6 par les postconditions de la migration elle-même, 11 par la preuve |
| helpers rendus usurpables (F-1) | A1 (le pompiste avec sa table temporaire lit les alertes) et P6 |
| `search_path=public` partout (F-2) | P6 (16 fonctions) |
| `grant all` au lieu de `grant select` | postcondition de la migration |
| `piste_evaluer_site` ouverte à `authenticated` | E1, E2 |
| politique de lecture des alertes `using (true)` | A1, L2, L3 |
| migration de request-2 entière | A1, C6 (alerte résolue à tort), P6 |

Limite : 9 des 11 revoke tués par la preuve ne le sont que par la postcondition de catalogue P5 (« anon a EXECUTE »), pas par un refus joué. Cinq d'entre eux portent sur des fonctions de déclencheur, qu'aucun client ne peut appeler directement.

### Inventaire exhaustif de la surface ouverte : 51 droits ajoutés, 0 retiré

Mesuré par différence d'inventaire avant et après (`inventaire-droits.sql`), et non déduit du SQL.

**Ce que la migration ouvre aux clients (`authenticated`) :**
- EXECUTE sur 4 fonctions SECURITY DEFINER, toutes avec `search_path = pg_catalog, public, pg_temp` :
  - `enregistrer_config_piste(jsonb, text)`
  - `qualifier_alerte_piste(uuid, text, text, uuid)`
  - `evaluer_controles_piste()`
  - `piste_manager_du_site(text)`
- SELECT sur les 3 tables `carburant_index_config`, `carburant_index_alertes`, `carburant_index_qualifications`, filtré par 3 politiques SELECT (`piste_manager_du_site(site)`).
- RLS active sur les 3 tables.

**Ce qui n'est ouvert à aucun client :**
- `anon` : rien ;
- `authenticated` : aucune écriture sur les tables, aucune fonction interne.

**Planification :** 1 job pg_cron, `*/5 * * * *`, exécuté par `postgres`.

**Point que request-3 ne mentionne pas :** `service_role` reçoit, par les privilèges par défaut de Supabase, EXECUTE sur les 16 fonctions et tous les droits sur les 3 tables. C'est le rôle serveur, qui contourne déjà la RLS : pas d'ouverture côté client, mais cela doit figurer dans l'inventaire soumis à l'arbitrage.

**Fonctions privilégiées du lot :** 11 SECURITY DEFINER, 5 INVOKER. Les 16 ont `pg_temp` en dernier.

---

## Livrable 2. Écarts de fidélité avec Test

| # | Écart | Effet sur les preuves |
|---|---|---|
| 1 | Tables Storage absentes de l'image Postgres (créées par `storage-api`) | 4 à 7 migrations échouent en brut ; corrigé dans la variante socle |
| 2 | Rôle `nexus_ci_recette` créé à la main sur Test, aucune migration | 2 migrations échouent en brut ; socle le crée en NOLOGIN |
| 3 | Test possède 5 rôles LOGIN absents de la jetable : `cli_login_postgres`, `nexus_ci_recette`, `nexus_claude_readonly`, `nexus_claude_ro`, `nexus_executor_readonly` | non exercés par les preuves |
| 4 | `nexus_executor_readonly` : sa version Test `20261012200026` s'intitule « role_without_login », mais le rôle a LOGIN, et aucun fichier ne le crée dans le dépôt | à éclaircir, voir livrable 5 |
| 5 | Rail et production ont divergé : 22 migrations rail seulement, 21 production seulement | Test n'est reproduit que par la réunion des deux |
| 6 | Collision de version : `20261009120000` désigne sur le rail `nexus_paye_items_types_heures_verify` et en production `mes_regularisations_projection_employe`. Test l'enregistre sous ce second nom | un rejeu Supabase du rail sur Test sauterait le fichier paye |
| 7 | Deux fichiers appliqués sur Test sous une autre version : `station_config_fuseau_horaire_nullable` (fichier 20261002000000, Test 20261002233051) et `versements_groupes_regularisation` (fichier 20261013140000, Test 20261013220411) | aucun au niveau des noms ; l'ordre réel diffère |
| 8 | `20261017140000` (Journal Piste) appliquée sur Test **sans fichier dans le dépôt**, uniquement dans request-3.md | l'historique ne la reproduit pas |
| 9 | Comparaison par noms seulement : corps de fonctions, expressions de politiques et GRANT non comparés globalement | pour Journal Piste, les 16 corps ont été comparés un par un |
| 10 | PostgREST et un vrai JWT ne sont pas exercés : l'identité est posée par `set role` et les claims | les refus prouvés sont ceux de la base, pas ceux de l'API |
| 11 | Version de `storage-api` (v1.83.5) peut différer de Test | sans effet sur Journal Piste |
| 12 | Données de Test non reproduites, par choix : semis synthétiques | les volumes et les cas réels ne sont pas couverts |

---

## Livrable 3. Plan de réconciliation des migrations (préparation, rien n'est câblé)

À conduire comme un lot distinct, par le Handoff.

1. **Trier les 22 migrations propres au rail.**
   - Environ 15 sont spécifiques à Test : rôle de recette, mode Test, données de la station de test, droits CI.
   - 6 sont des corrections produit ou sécurité qui n'existent pas en production :
     - `login_non_enumerable` ;
     - `actor_role_human_pour_autorisation_frederic` ;
     - `revoque_garde_regularisation_reception_anon_authenticated` ;
     - `station_config_fuseau_horaire_nullable` ;
     - `station_config_horaires_nullable` ;
     - `revoquer_anon_quatre_fonctions_hors_fdj`.

     À vérifier en priorité : la production a-t-elle un équivalent sous un autre nom ? La mesure demande un accès Production, donc un GO.
   - S'y ajoute le doublon paye (même contenu, md5 identique, sous deux versions).
2. **Sortir les migrations propres à Test de la chaîne commune.** Elles iraient dans un dossier d'environnement, par exemple `supabase/test/`, rejoué uniquement sur Test et sur la jetable « socle ». La création de `nexus_ci_recette` y entre aussi.
3. **Ramener production dans le rail** par une fusion ordinaire de `production` vers le rail, après l'étape 2, pour que l'historique commun soit celui qui part en production.
4. **Résoudre la collision `20261009120000`** : renuméroter le fichier paye du rail sur sa version production (`20261013132532`), déjà enregistrée sur Test.
5. **Reconstituer en fichiers ce qui n'existe qu'en base**, comme pour SEC-018 :
   - `20261012200026` (rôle `nexus_executor_readonly`) ;
   - `20261017140000` (Journal Piste, si elle est conservée) ;
   - les deux versions décalées.
6. **Ensuite seulement**, étudier l'intégration de la jetable avant l'arbitrage, dans un lot séparé comme vous l'avez demandé : contrats, échecs, reprises. La variante brute reste rejouée à côté de la variante socle.

---

## Livrable 4. Analyse de sécurité des helpers partagés

### La faiblesse est réelle

`current_employee_site_id()`, `current_employee_role()` et `je_suis_createur()` sont SECURITY DEFINER, avec `search_path=public`, exécutables par `anon` et `authenticated`. Ils lisent `employees` sans schéma. Avec ce search_path, une table temporaire `employees` passe avant `public.employees`.

Mesuré sur la jetable, sur les trois historiques, avec une vraie politique RLS (`select_employees`) :

| Cas | Attendu | Obtenu |
|---|---|---|
| `authenticated` crée une table temporaire `employees` | refus | acceptée |
| site vu par le helper après usurpation | site A | **site B** |
| rôle vu par le helper | pompiste | **manager** |
| `je_suis_createur()` | false | **true** |
| employés du site B lisibles par le pompiste A | 0 | **2** |

Test présente exactement la même forme (lecture du catalogue). Production n'a pas été mesurée.

### Ce qui en dépend

Sur Test : **312 politiques sur 391**, sur **129 tables**. Par helper : `current_employee_site_id` 306, `current_employee_role` 152, `je_suis_createur` 49. S'y ajoutent 11 fonctions qui appellent ces helpers.

Tous les modules sont concernés. Sur la jetable production : inventaire (29 tables), FDJ (20), carburant (18), import (7), missions (5), planning, caisse, régularisations, et les autres.

Le même repérage signale **41 autres fonctions SECURITY DEFINER de même forme** (pg_temp absent ou pas en dernier, table nommée sans schéma). Ce n'est qu'un repérage, à relire une par une : régularisations, FDJ caisse, inventaire, `stats_fondateur`…

### Exploitabilité en conditions réelles : faible aujourd'hui

Pour créer la table temporaire, il faut exécuter du DDL dans une session SQL. Or :
- **Par l'API (PostgREST, GraphQL)**, un client ne peut appeler que des fonctions exposées. Aucune fonction appelable par `anon` ou `authenticated` n'exécute de SQL dynamique (mesuré sur Test et sur les trois jetables).
- **`anon` et `authenticated` n'ont pas LOGIN**, donc pas de connexion directe.
- **Les rôles LOGIN de Test** ne peuvent pas en tirer profit :
  - `authenticator` et `cli_login_postgres` peuvent déjà devenir `authenticated` et poser les claims JWT de leur choix. Usurper par la table temporaire ne leur apporte rien de plus, et leurs mots de passe sont des secrets.
  - `nexus_ci_recette`, `nexus_claude_ro`, `nexus_claude_readonly` et `nexus_executor_readonly` ne peuvent pas devenir `authenticated`. Les politiques de `nexus_ci_recette` sont bornées par des noms de site littéraux, sans helper.

C'est donc une **faiblesse latente**. Elle deviendrait exploitable dès qu'une fonction exposée exécuterait du SQL construit, ou qu'un rôle de connexion recevrait `authenticated`. Point aggravant : une table temporaire survit à la transaction. Sur une connexion PostgREST partagée, elle toucherait les requêtes des autres utilisateurs.

### Correctif minimal proposé, éprouvé sur la jetable seulement

```sql
alter function public.current_employee_site_id() set search_path = pg_catalog, public, pg_temp;
alter function public.current_employee_role()    set search_path = pg_catalog, public, pg_temp;
alter function public.je_suis_createur()         set search_path = pg_catalog, public, pg_temp;
```

Trois ALTER, sans changement de corps, de droit ou de politique. Joué dans une transaction annulée, sur les trois historiques :
- usurpation : 4 cas sur 4 tenus après correctif. Seule la création de la table temporaire reste possible, et elle n'a plus d'effet ;
- non-régression : preuve RLS 11/11 ;
- après annulation, l'état d'origine est vérifié (`search_path=public`).

À ne pas faire : retirer TEMP à `authenticated`. `generer_planning_mensuel`, fonction INVOKER, crée des tables temporaires et casserait.

Seconde étape possible, hors correctif minimal : la même correction sur les 41 fonctions repérées, après relecture.

---

## Livrable 5. Prochaines décisions humaines, isolées des opérations préautorisées

**Décisions qui vous reviennent :**
1. **État actuel de Test, Journal Piste.** La migration y est appliquée et le job tourne toutes les 5 minutes. Deux choix :
   - la conserver (régularisation a posteriori) ;
   - la retirer : `cron.unschedule('nexus-journal-piste')`, `drop` des fonctions et des 3 tables, `drop column config_snapshot`.

   Arrêter le job seul est l'action la plus légère et se défait sans peine.
2. **Surface Journal Piste.** Les 51 droits inventoriés ci-dessus, dont 7 ouverts à `authenticated`, plus le job pg_cron. Le GO ou le refus porte sur cette liste.
3. **Lot sécurité helpers.** GO ou non pour appliquer les trois ALTER sur Test. La Production demanderait un GO distinct, après mesure de son état.
4. **`nexus_executor_readonly`.** Ce rôle LOGIN existe sur Test sans fichier, alors que son nom de version dit « sans login ». Il faut savoir qui l'utilise avant de le documenter ou de lui retirer LOGIN.
5. **Réconciliation.** Valider le tri du livrable 3, en particulier le sort des 6 corrections absentes de production.

**Ce qui ne demande pas de décision** (outillage, preuve, jetable) :
- corriger le motif LIKE de la preuve, par la session du lot ;
- rejouer cette recette à chaque nouvelle version du SQL, en poussant sur `essai/base-jetable-*` ;
- préparer les fichiers du livrable 3 sur une branche, sans les fusionner.

---

## Rejouer

Pousser sur une branche `essai/base-jetable-*`. Les résultats sortent en annotations du run « Essai base jetable (isolé) ».

| Fichier | Rôle |
|---|---|
| `journal-piste/migration-request-3.sql` | migration extraite telle quelle de request-3 |
| `journal-piste/preuve-request-3.sql` | preuve extraite telle quelle de request-3 |
| `journal-piste/migration-request-2.sql` | témoin historique |
| `journal-piste/rejouer-candidat.sh` | preuve avant, application, preuve après, inventaire des droits |
| `journal-piste/mutants.py`, `journal-piste/jouer-mutants.sh` | mutants |
| `journal-piste/corriger-preuve.sh` | variante corrigée de la preuve |
| `inventaire-droits.sql` | surface de permissions |
| `helpers/usurpation-helpers.sql`, `helpers/dependants-helpers.sql`, `helpers/correctif-minimal-helpers.sql` | analyse des helpers |

Empreintes md5 des extraits :
- migration request-3 : `1a22e40c99dc593fc6fb046bda003fe1` ;
- preuve request-3 : `210e50b39821f6e22ff85f60e73266b0` ;
- migration request-2 : `da3cbda86179e1898110281200ba7c3f`.
