# Manifeste de promotion Production — addendum courant, append-only

Ce fichier **complète** `docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/manifeste-migrations-production-1.md`
(le « manifeste historique », clos avec le lot `NEXUS-PRODUCTION-READINESS-1-20260908`,
`DECISION_CONSOMMEE` le 11/09/2026). Il ne le remplace pas et ne le réécrit
jamais.

## Pourquoi ce fichier existe

`test_manifeste_migrations_complet_20260909.js` exige que CHAQUE migration
postérieure à `VERSION_PRODUCTION` (`20260904175722`) soit classée
incluse/exclue/bloquée. Le manifeste historique a déjà été étendu deux fois
après sa clôture initiale (« Ajouts du 09/09/2026 », « INCLUSES — lot
correctif du 11/09/2026 ») — mais chaque extension exigeait de rouvrir et
réécrire un fichier appartenant à un lot officiellement clos, ce que
`decision-4.md` du lot `NEXUS-CONTINUITE-TERRAIN-1-20260920` interdit
désormais par principe pour tout geste qui ne fait que TRANSPORTER des
migrations déjà appliquées ailleurs (Test, ou une branche non rapatriée).

Ce fichier est le point d'ajout pour ce cas récurrent : une nouvelle section
**datée et attribuée à un lot Handoff**, jamais une modification d'une
section existante — ici comme dans le manifeste historique lui-même. La
suppression ou la modification d'une section déjà publiée y serait aussi
illégitime qu'elle le serait dans un `request-N.md`/`decision-N.md` du
registre Handoff.

## Garde d'immuabilité du manifeste historique

Empreinte SHA256 figée du manifeste historique au moment de la rédaction de
cet addendum (calculée en lecture seule, jamais recalculée pour « corriger »
un écart — un écart détecté signale une réécriture, pas une erreur de cette
empreinte) :

```
59f9f95e9fe03e9227f1355885da3f68474a1fae097dfa58193ed1ae3dc90fa7  docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/manifeste-migrations-production-1.md
```

`outils/verifier-manifeste-migrations-complet.js` la vérifie avant de lire le
manifeste historique : si elle ne concorde plus, le mécanisme refuse de
conclure plutôt que de certifier sur un fichier qui a changé sous lui.

## Mécanisme de lecture combinée (câblé dans le contrôle réel)

`outils/verifier-manifeste-migrations-complet.js` lit le manifeste
historique **et** ce fichier, et considère une migration classée dès qu'elle
est citée dans l'un OU l'autre. Ce module est démontré et éprouvé par
mutation dans `test_manifeste_migrations_append_only_20260921.js`, et,
depuis `decision-5.md` du lot `NEXUS-CONTINUITE-TERRAIN-1-20260920`, **est
câblé** dans le contrôle réel `test_manifeste_migrations_complet_20260909.js` :
celui-ci lit désormais ce fichier en plus du manifeste historique, et refuse
de conclure si l'empreinte figée ci-dessus ne concorde plus avec le manifeste
historique réel.

---

## Addendum du 21/09/2026 — lot `NEXUS-CONTINUITE-TERRAIN-1-20260920`

**PROPOSITION — non arbitrée.** Cette section applique aux 14 migrations
transportées par ce lot (`request-4.md`) exactement la même règle
déterministe que `test_manifeste_migrations_complet_20260909.js` applique
déjà (une migration est Test/CI si et seulement si elle le DÉCLARE dans son
propre en-tête, ou si elle touche le rôle `nexus_ci_recette`) — je n'invente
aucun nouveau critère de classement, je rejoue celui qui existe déjà contre
les 14 fichiers réels du dépôt. Vérifié par lecture de code le 21/09/2026,
aucune des 14 ne se déclare Test/CI et aucune ne touche `nexus_ci_recette` :

### Proposées incluses dans une future release Production (14 migrations)

1. `20260914210000_mes_ecarts_caisse_projection_employe`
2. `20260916193000_prise_de_poste_ninvente_plus_la_fin`
3. `20260916194000_regularisation_fins_inventees_prise_de_poste`
4. `20260916195000_cloture_source_cycle_pilote`
5. `20260916210000_mes_ecarts_caisse_masque_le_provisoire`
6. `20260919160000_horaires_moteur_unique_et_retard_nullable`
7. `20260919180000_planning_source_officielle_projection_normalisee`
8. `20260919200000_import_planning_google_sheets`
9. `20260919220000_bascule_source_planning_tracee`
10. `20260919240000_horodatage_serveur_planning_shifts`
11. `20260919260000_bascule_source_planning_date_effet`
12. `20260919280000_source_precedente_a_la_date_d_effet`
13. `20260920120000_droits_v_planning_officiel`
14. `20260920140000_bascule_source_precedente_et_change_le`

### Ce que cette classification ne fait pas

Elle ne promeut rien en Production, n'exécute aucun SQL, ne modifie ni le
manifeste historique ni `main`/`production`. Elle ne tranche pas non plus la
question métier de savoir si ces 14 migrations DOIVENT être promues (ordre,
fenêtre de déploiement, dépendances applicatives) — seulement qu'aucune
d'elles ne se déclare Test/CI, ce qui est un fait mécanique, pas un jugement.
La décision de les inclure réellement dans une release reste une gate
Orchestrator/Frédéric distincte, comme pour toutes les entrées du manifeste
historique.

---

## Addendum du 01/10/2026 — deux migrations, deux statuts opposés

Ce lot ajoute deux estampilles au dépôt, et il importe qu'elles ne soient pas
classées ensemble : l'une est **déjà en Production**, l'autre **ne l'est pas**.

### Déjà appliquée en Production — constatée, pas promue (1 migration)

1. `20260919103000_carburant_reception_regularisation_releve_manuscrit`

**Ce fichier n'est pas une nouveauté : c'est une absence réparée.** Il est
enregistré en Production (lecture du 01/10/2026 15 h 01 UTC, verdict
`MIGRATION_APPLIQUEE — 13/13`, 13 objets constatés nom par nom) et il existait
sur `production` sans exister sur le rail. `test_migrations_immuables_20260905.js`
le signalait depuis le 20/09 : « Migrations de production absentes de cette
branche ». Mesuré rouge sur le rail propre à `f6e3f33`, avant toute écriture de
ce lot — ce rouge n'appartenait pas à ce lot, il l'attendait.

Le fichier a été **copié verbatim** depuis `origin/production`, et l'identité a
été vérifiée par l'objet git lui-même : blob `b51aaec6` des deux côtés, 8988
octets, sha256 identique. Une migration appliquée est immuable dans son
identité : elle se copie, elle ne se réécrit pas.

Ce classement **ne promeut rien** — la cible la porte déjà. Il rend le dépôt
véridique sur ce que la base fait.

### Proposée incluse dans une future release Production (1 migration)

2. `20261001160000_revoque_garde_regularisation_reception_anon_authenticated`

Un `revoke` pur : aucun objet créé, modifié ou supprimé. Elle retire
l'`EXECUTE` de `anon` et `authenticated` sur
`public.nexus_garde_regularisation_reception()`, que la migration n° 1 avait
voulu fermer par `revoke … from public` — un instrument qui ne pouvait pas
mordre, Supabase accordant ces `EXECUTE` par grants **nommés**.

Elle ne se déclare pas Test/CI et ne touche pas `nexus_ci_recette` : même
critère déterministe que les 14 de l'addendum du 21/09, rejoué, pas réinventé.

**Pourquoi l'ordre entre les deux compte.** La n° 2 agit sur une fonction que
la n° 1 crée. Tant que le rail ne portait pas la n° 1, le dépôt contenait un
`revoke` visant une fonction qu'aucune de ses migrations ne crée : rejoué sur
une base vierge, le garde `if exists` de la n° 2 aurait rendu son avis
« fonction ABSENTE » et le lot aurait **réussi sans rien fermer**. C'est
précisément le faux succès que la procédure de la n° 2 refuse de compter.
Descendre la n° 1 n'est donc pas un à-côté : c'est ce qui rend la n° 2
falsifiable.

### Proportion, à dire honnêtement

L'exposition pratique fermée par la n° 2 est **nulle** :
`nexus_garde_regularisation_reception()` est `returns trigger`, un appel direct
échoue à la compilation, et PostgreSQL ne consulte pas `EXECUTE` quand un
trigger se déclenche. Ce qui est réel est la divergence entre ce que le dépôt
affirme et ce que la base fait. Une intention écrite qui n'agit pas est pire
qu'une intention absente : elle se relit comme une protection.

### Ce que cet addendum ne fait pas

Il ne promeut rien, n'exécute aucun SQL, ne modifie ni le manifeste historique
ni `main`/`production`, et ne tranche pas la fenêtre de déploiement. L'application
du `revoke` à Production reste le geste de Frédéric
(`outils/revoke-garde-regularisation-production-a-executer-par-frederic.sql`),
sous la gate humaine, et le GO du 01/10/2026 porte sur le revoke seul — ni
fusion, ni déploiement.

---

## Addendum du 02/10/2026 — correctif anomalie terrain Carburants (issue #28)

### Proposée incluse dans une future release Production (1 migration)

1. `20261002000000_station_config_fuseau_horaire_nullable`

Corrige l'anomalie terrain « Enregistrer les prix du mois » (HTTP 400,
PostgREST 23502 sur `station_config?on_conflict=site`). Cause racine :
`20260905131500_fuseau_horaire_par_site` avait fait `DROP DEFAULT` sur
`station_config.fuseau_horaire` sans le `DROP NOT NULL` compagnon, alors que
le client avait, le même jour, cessé d'écrire cette colonne — rendant
impossible TOUT upsert `station_config` (`INSERT ... ON CONFLICT DO UPDATE`
valide la ligne proposée, défauts/NULL compris, avant même de vérifier le
conflit). Cette migration ne fait qu'`ALTER COLUMN fuseau_horaire DROP NOT
NULL` : aucune table créée, aucun défaut réintroduit, aucune donnée touchée.

Elle ne se déclare pas Test/CI et ne touche pas `nexus_ci_recette` : même
critère déterministe que les entrées précédentes de cet addendum, rejoué, pas
réinventé.

### Ce que cet addendum ne fait pas

Il ne promeut rien, n'exécute aucun SQL (aucun accès Supabase depuis le canal
GitHub Issue qui a produit ce correctif), ne modifie ni le manifeste
historique ni `main`/`production`. La preuve de la cause racine est statique
(`test_station_config_upsert_fuseau_horaire_23502_20261002.js`, rejoue le
schéma réel et les 15 payloads d'upsert réels du dépôt) ; la preuve
comportementale SQL (`outils/epreuve-station-config-upsert-fuseau-horaire-
23502-20261002.sql`) reste à exécuter par quiconque dispose d'un accès réel à
`nexus-test`, ce que ce canal n'a jamais eu.

---

## Addendum du 03/10/2026 — même famille, deux cas différents (`horaires`, `site`)

### Proposée incluse dans une future release Production (1 migration)

1. `20261003120000_station_config_horaires_nullable`

Ferme le second cas de la famille ouverte par l'addendum du 02/10 :
`station_config.horaires` était `NOT NULL` **sans défaut**, sans aucun écrivain
qui le possède, donc tout upsert de la table devait le joindre pour passer.
Mesuré en conteneur jetable le 03/10/2026 : l'échec `23502` survient **aussi
quand la ligne existe déjà** (`ON CONFLICT (site) DO UPDATE` construit et valide
la ligne candidate entière avant de chercher le conflit) — le commentaire du
dépôt qui disait « échouerait si la ligne n'existe pas encore » était faux, et
faux dans le sens qui rassure. Il a été corrigé dans
`NEXUS-Parametres-Station-v1.html`.

La migration ne fait qu'`ALTER COLUMN horaires DROP NOT NULL`. Aucun défaut n'y
est posé, et ne doit jamais l'être : le moteur unique de
`20260919160000_horaires_moteur_unique_et_retard_nullable` tolère déjà NULL
explicitement (`if v_horaires is null then return;`), tandis qu'un DEFAULT
substituerait des horaires muets à une absence que l'arbitrage du 19/09/2026
(option b1) veut visible. `DROP NOT NULL` n'efface aucune donnée existante :
re-mesuré une troisième fois.

Elle ne se déclare pas Test/CI et ne touche pas `nexus_ci_recette` : même
critère déterministe que les entrées précédentes, rejoué, pas réinventé.

### Correction d'un verdict antérieur : `site` n'a PAS besoin de migration

Le verdict du 02/10 classait `horaires` et `site` « même famille de défaut »,
les deux `NOT NULL` sans défaut sur la même table. **C'était faux pour `site`**,
et il importe de dire pourquoi, parce que le défaut penchait du côté de l'action.

`site` est la **clé primaire** de `station_config` (`station_config_pkey
PRIMARY KEY (site)`, déclarée exactement une fois dans tout le jeu de
migrations, par la baseline). Son `NOT NULL` n'est pas une contrainte oubliée :
c'est la cible du `ON CONFLICT`. Postgres **refuse** de le relâcher — mesuré :
`ERROR: column "site" is in a primary key`, et l'attribut reste `NOT NULL`
après la tentative. Les 15 appels upsert du dépôt le fournissent tous, 15 sur
15.

L'erreur venait du prédicat de mesure, pas de la base : `attnotnull AND NOT
atthasdef` ne distingue pas une clé primaire d'une contrainte résiduelle. Le
dépôt le savait déjà — son propre détecteur excluait `site` nommément. Ce
prédicat naïf est désormais **reproduit exprès** dans
`test_station_config_horaires_nullable_et_site_pk_20261003.js`, qui affirme
qu'il signale bien `site` là où le détecteur du dépôt ne le fait jamais : une
garde dont on ne peut pas montrer ce qu'elle retient n'est pas une garde. La
même épreuve vérifie qu'**aucune** migration du jeu ne relâche la clé primaire,
et sa contre-épreuve prouve que ce détecteur mord sur une migration inventée.

Ce que `site` demande n'est donc pas une migration mais une garde : elle existe,
et une mutation a dû être **réaimée** avant de la croire muette (le premier
mutant frappait un upsert sur une autre table, 276 lignes plus loin).

### Retrait du colmatage : une dépendance d'ORDRE, pas un reste de ménage

Quatorze des quinze appels upsert joignent `horaires` sans le posséder — onze via
la variable `horairesUpsert`, deux via une relecture `existant`, un via
`chargerHorairesPourUpsert()` dans App. Un seul le possède légitimement,
l'enregistrement des horaires lui-même. Tout cet appareil n'existe que parce que
la colonne était `NOT NULL` sans défaut.

Son retrait n'est **pas** inclus dans ce lot, et l'ordre est contraignant : la
migration doit avoir atteint la base visée **avant** que le code cesse de
fournir la colonne. L'inverse casse tous les upserts de la table, y compris sur
les lignes existantes (voir ci-dessus). Le colmatage reste donc en place,
désormais documenté comme transitoire à son propre emplacement.

### Ce que cet addendum ne fait pas

Il ne promeut rien, n'exécute aucun SQL sur Production ni sur `nexus-test`, ne
modifie ni le manifeste historique ni `main`/`production`, et ne retire aucun
colmatage. Les preuves de cause et de contrat sont statiques
(`test_station_config_horaires_nullable_et_site_pk_20261003.js`, 16
vérifications, ses cinq gardes éprouvées par mutation) et comportementales en
conteneur jetable local. La relecture de la structure sur `nexus-test` lui-même
reste à prendre : l'hôte direct du projet Test était injoignable sur le port
5432 le 03/10/2026 alors qu'IPv6 fonctionnait par ailleurs — observation de
transport datée, jamais « Test est injoignable ».

---

## Addendum du 03/10/2026, 17 h — écriture de recette bornée sur `station_config` (SEC-023)

### EXCLUE — Test/CI uniquement (1 migration)

1. `20261003170000_ecriture_bornee_station_config_recette_23502` — **EXCLUE — Test/CI**

Première entrée **EXCLUE** de cet addendum : les quatre sections datées qui
précèdent classaient toutes « Proposée incluse ». La marque est donc portée
deux fois, sur le titre **et** sur la ligne, parce que le contrôle réel
(`test_manifeste_migrations_complet_20260909.js`) l'accepte sur la ligne **ou**
sur le titre le plus proche : une classification ne doit pas dépendre de celle
des deux lectures qui se trouve marcher.

**Ce qu'elle débloque, mesuré.** À l'étape 52 du run Tests `37131612297`
(rail `620b8418b681cafa327079be0a18698903d96274`, 03/10/2026 14 h 59 UTC),
l'épreuve request-20 est refusée à sa première écriture :
`ERROR: permission denied for table station_config` — SQLSTATE **42501**, pas
23502. Relevé en base : le rôle `nexus_ci_recette` ne détient **aucun droit de
table** sur `public.station_config`, seulement quatre droits de **colonne** en
lecture posés par `20260909110000`. Sa politique `lecture_recette_station_test`
est donc inerte faute de droit derrière elle. Piège de lecture à ne pas
refaire : `information_schema.role_table_grants` n'énumère pas les droits de
colonne et rendait une rubrique vide, indiscernable d'une absence.

**Autorisation humaine.** Frédéric Bragance, 03/10/2026, verbatim : « une
capacité d'écriture TEST strictement minimale permettant à l'épreuve request-20
d'exécuter ses deux cas synthétiques sur public.station_config », bornée aux
deux identifiants `nexus-test-repro-23502-neuf` et
`nexus-test-repro-23502-existant`, sans aucun droit d'écriture sur
`nexus-station-test` ni sur un site réel, et traçable par migration.

**Pourquoi EXCLUE, et pourquoi ce n'est pas un choix de confort.** Elle
n'accorde de droits qu'au rôle `nexus_ci_recette`, qui n'existe pas en
Production : son corps s'ouvre sur un `if not exists (select 1 from pg_roles …)
then raise notice … return`, donc appliquée là-bas elle ne ferait rien. Mais
« elle ne ferait rien » n'est pas une raison de la promouvoir : son en-tête
déclare **« TEST/CI UNIQUEMENT — à ne PAS appliquer en Production »**, et c'est
cette déclaration, pas son innocuité supposée, qui exige la marque ci-dessus.
Même critère déterministe que les quatre migrations EXCLUES du 09/09/2026 dans
le manifeste historique, rejoué, pas réinventé.

**Bornée sur les deux axes à la fois, comme SEC-018.** Les droits sont bornés
aux seules colonnes que l'épreuve renseigne, et les lignes aux deux seuls
identifiants synthétiques par trois politiques RLS. Un droit sans politique
écrirait partout ; une politique sans droit ne s'appliquerait à rien. Aucun
`DELETE`, aucun `TRUNCATE`, aucun droit de table, aucun élargissement général
de `nexus_ci_recette`.

**Sa preuve de bornage est désignée, et elle ne peut pas vivre sur un poste.**
`outils/epreuve-bornage-ecriture-recette-station-config-20261003.sql` refuse de
conclure si `current_user` n'est pas `nexus_ci_recette` ou si le rôle contourne
la RLS (code `BORNAGE-000`, contre-témoigné : lancée sous `postgres` elle sort
en 3). Depuis ce Mac, `set role nexus_ci_recette` est refusé par PostgreSQL 16
— `pg_has_role(…,'MEMBER')` vaut vrai, `USAGE` vaut faux — et `postgres` porte
`rolbypassrls` : une mesure prise d'ici ne prouverait donc rien du bornage.
Elle est pour cette raison câblée dans la CI, à l'étape « Bornage de l'écriture
de recette sur station_config (SEC-023) ». Son versant statique est
`test_droits_ci_dans_migrations_20260909.js` — 10/10, éprouvé par cinq
mutations qui rougissent chacune sur sa propre cible.

### Ce que cet addendum ne fait pas

Il ne promeut rien et ne modifie pas le manifeste historique, dont l'empreinte
reste celle figée plus haut. Il ne classe pas les onze migrations du rail encore
non qualifiées. Il ne vaut ni autorisation de fusion, ni autorisation de
déploiement, ni application sur une base. À l'heure où il est écrit, la
migration qu'il classe est **écrite et non appliquée** : l'appliquer sur
`nexus-test` et rejouer l'épreuve request-20 sous `nexus_ci_recette` sont deux
gestes distincts, et le second est la seule preuve qui compte.

---

## Addendum du 03/10/2026, 18 h — la lecture que `excluded.*` exige (SEC-023 bis)

### EXCLUE — Test/CI uniquement (1 migration)

1. `20261003180000_lecture_excluded_station_config_recette_23502` — **EXCLUE — Test/CI**

**Ce qui restait refusé, mesuré.** `20261003170000` a été appliquée sur
`nexus-test`. Au run Tests `37143142272`, tentative 2 (rail
`58899b5adc1db5d097480607990b27c6b2d923d8`, job `111261916475`), l'épreuve
request-20 échoue encore, au premier upsert, en
`ERROR: 42501: permission denied for table station_config`, localisé
`aclcheck_error, aclchk.c:2843`. Les droits d'écriture étaient là ; c'est une
**lecture** qui manquait.

**Cause, prouvée.** Dans `on conflict (site) do update set col = excluded.col`,
`excluded.col` est une lecture de `col`, et PostgreSQL exige le droit SELECT de
colonne. L'épreuve lit `excluded.prix_carburants`, `excluded.horaires` et
`excluded.updated_at`. `20261003170000` n'ouvrait en lecture que
`prix_carburants`, parce que son raisonnement ne regardait que les projections
de la PARTIE B. La preuve a été rejouée dans un conteneur `postgres:17` jetable,
avec les vrais fichiers et un rôle `nexus_ci_recette` `nobypassrls` :

- avec `20261003170000` seule, même 42501 au même `aclchk.c:2843` ;
- après `20261003180000`, l'épreuve request-20 est menée à terme ;
- l'épreuve de bornage passe BORNAGE-000 à 006 ;
- aucune ligne synthétique ne subsiste ;
- la migration est rejouable.

**Pourquoi une seconde migration.** `20261003170000` est appliquée et
estampillée : on ne la retouche pas. `20261003180000` rejoue sa borne entière
(mêmes droits, mêmes trois politiques) et y ajoute
`select (horaires, updated_at)`.

**Effet de bord déclaré.** La politique préexistante
`lecture_recette_station_test` (SEC-018) rend désormais lisibles `horaires` et
`updated_at` de la ligne `nexus-station-test` pour `nexus_ci_recette`. C'est une
lecture seulement : l'écriture y reste refusée (BORNAGE-003 et BORNAGE-004).
Aucun site réel n'est lisible.

**Garde ajoutée.** Dans `test_vehicule_migration_ecriture_bornee_test_20261003.js`,
toute colonne lue par `excluded.*` dans les deux épreuves doit appartenir à
`SELECT_ATTENDU`. Une mutation (retirer `updated_at`) la fait rougir.

**EXCLUE pour le même motif que `20261003170000`.** Son en-tête déclare
« TEST/CI UNIQUEMENT ». Cet addendum ne vaut ni fusion, ni déploiement, ni
application.

## Addendum du 03/10/2026, 19 h — l'exécution que les CHECK exigent (SEC-023 ter)

### EXCLUE — Test/CI uniquement (1 migration)

1. `20261003190000_execute_mappage_station_config_recette_23502` — **EXCLUE — Test/CI**

**Ce qui restait refusé, mesuré.** `20261003180000` a été appliquée sur
`nexus-test` (véhicule : `ECRITURE_BORNEE_APPLIQUEE`). Au run Tests
`37144179897` (rail `65854d03f77f979afc9399372b55c417ef96b850`, job
`111264611567`), l'épreuve request-20 échoue encore, ligne 59, en
`ERROR: 42501: permission denied for function planning_mappage_est_valide`
(`aclchk.c:2843`). Les droits de colonne sont là ; c'est un droit sur une
**fonction** qui manque.

**Cause.** Deux contraintes CHECK de `station_config`
(`station_config_planning_alias_check` et
`station_config_planning_codes_sites_check`, posées par `20260919180000`)
appellent `public.planning_mappage_est_valide(jsonb)`. Une contrainte CHECK
s'évalue avec les droits de l'écrivain. Or cette fonction n'est accordée qu'à
`authenticated` et `service_role`.

**Seul privilège manquant, d'après l'inventaire lu sur Test.**

- `station_config` a quatre CHECK, dont deux seulement appellent une fonction
  non intégrée.
- Ses deux triggers sont `security definer`.
- Les défauts de colonne sont des constantes.

La fonction est `immutable` et en `sql`. Elle ne lit aucune table, donc
l'EXECUTE ne divulgue rien.

**Pourquoi une troisième migration.** `20261003190000` rejoue la borne entière
de `20261003180000` : mêmes colonnes et mêmes trois politiques. Elle y ajoute
`grant execute on function public.planning_mappage_est_valide(jsonb) to
nexus_ci_recette`. Elle devient la dernière porteuse, donc le plafond. Elle
n'apporte aucun effet de bord nouveau.

**Gardes ajoutées** dans `test_vehicule_migration_ecriture_bornee_test_20261003.js` :

- Toute fonction appelée par un CHECK de `station_config`, dans l'ensemble des
  migrations, doit recevoir EXECUTE dans l'artefact du véhicule.
- Le véhicule mesure cet EXECUTE (8e colonne). Il ne rend
  `ECRITURE_BORNEE_APPLIQUEE` que s'il est présent.
- Deux mutations les font rougir : retirer le grant, et retirer l'exigence.

**EXCLUE pour le même motif que `20261003170000`.** Son en-tête déclare
« TEST/CI UNIQUEMENT ». Cet addendum ne vaut ni fusion, ni déploiement, ni
application.

---

## Addendum du 04/10/2026 — rapatriement des 13 migrations FDJ de Production

### Déjà appliquées en Production — constatées, pas promues (13 migrations)

1. `20260916220000_fdj_quart_relie_a_la_prise_de_poste` (blob `da63f087`)
2. `20260916220100_fdj_caisse_cycle_de_vie_colonnes` (blob `9ab34b4d`)
3. `20260916220200_fdj_caisse_journal_evenements` (blob `b135172f`)
4. `20260916220300_fdj_demandes_correction_apres_validation` (blob `583e71a4`)
5. `20260916220400_fdj_mouvements_auteur_et_date_effet` (blob `ab9cb103`)
6. `20260916220500_fdj_commande_ouverture_quart` (blob `42597c1d`)
7. `20260916220600_fdj_commandes_caisse_employe` (blob `a957e5dc`)
8. `20260916220700_fdj_commandes_caisse_manager` (blob `e0137d73`)
9. `20260916220800_fdj_projection_employe` (blob `dfdbfb7c`)
10. `20260916220900_fdj_projection_progression` (blob `4268f62f`)
11. `20260916221000_fdj_commandes_activations_et_mouvements` (blob `43aa4fc5`)
12. `20260916221100_fdj_commande_saisie_caisse_manager` (blob `7015d459`)
13. `20261004120000_fdj_fermer_ancienne_correction_caisse_employe` (blob `357766cf`)

**Même cas que `20260919103000` à l'addendum du 01/10 : une absence réparée,
pas une nouveauté.** Ces fichiers sont arrivés sur `production` par la fusion
de la PR #73 (`638f3f4`, 04/10/2026 11 h 18 UTC) sans exister sur le rail.
`test_migrations_immuables_20260905.js` rougissait donc le rail depuis cette
fusion.

**Constat en Production, en lecture seule** (`begin read only`, 04/10/2026
14 h 12 UTC) : les 13 versions sont enregistrées dans
`supabase_migrations.schema_migrations`, pour un registre de 294 lignes.

**Identité vérifiée** : chaque fichier a été copié verbatim depuis
`origin/production` (`30544c9`). Pour les 13, le blob calculé dans le rail est
identique à l'objet git de `production`. Aucun fichier ne se déclare Test/CI
et aucun ne touche `nexus_ci_recette`.

Ce classement **ne promeut rien**, puisque la cible porte déjà ces migrations.
Il rend le rail véridique sur ce que la base fait.

### Effet sur la garde REVOKE-FONCTION-RÔLES-NOMMÉS

Les douze fichiers du 16/09 précèdent le seuil `20261001000000` de
`outils/garde-revoke-fonction-roles-nommes.js`. La garde les compte donc en
dette, et la dette mesurée passe de 18 à 23 (+6, −1) :

- **−1** : `public.fdj_corriger_caisse_employe(uuid,numeric,text,text)` est
  fermée par `20261004120000`, postérieure au seuil et conforme.
- **+5** : `fdj_date_metier`, `fdj_numero_quart_depuis_prise_de_poste`,
  `fdj_ouvrir_quart_depuis_prise_de_poste`,
  `fdj_transferer_responsabilite_quart` et `fdj_ma_progression_caisse`. Elles
  ont toutes la même forme : `revoke … from public`, `revoke … from anon`,
  puis `grant execute … to authenticated` explicite. L'intention de garder
  `authenticated` est écrite en SQL, mais pas sous le marqueur
  `nexus-acl-intention` (créé le 01/10, après elles).
- **+1** : `%s`, de `20260916221100`. **C'est un artefact de la garde**, pas
  une fonction. Un bloc `do` y applique ce même schéma ACL à deux fonctions
  par `execute format('revoke all on function %s …', v_sig)`, et la garde lit
  le paramètre de format comme une signature. Défaut de la garde laissé
  ouvert, signalé, non corrigé ici.

**Mesure en Production, en lecture seule** (04/10/2026) : sur les sept
fonctions concernées, plus `fdj_saisir_caisse_manager` et
`fdj_demandes_correction_du_quart` couvertes par le `%s`,
`has_function_privilege('anon', …, 'EXECUTE')` est **faux partout**, et vrai
pour `authenticated`. `fdj_corriger_caisse_employe` est fermée aux deux.
L'augmentation de dette est **formelle** (intention non marquée) : elle ne
correspond à aucune exposition à `anon`. Ces fichiers sont immuables, et
seule une migration nouvelle pourrait poser le marqueur.

### Ce que cet addendum ne fait pas

Il ne vaut ni fusion, ni déploiement, ni application, ni écriture en
Production.

## Addendum du 04/10/2026 (suite) — la garde lisait `%s` comme une fonction : dette réelle 47

L'addendum précédent signalait un défaut de la garde REVOKE-FONCTION-RÔLES-NOMMÉS
sans le corriger : l'entrée `%s` de `20260916221100`. Il est corrigé dans
`outils/garde-revoke-fonction-roles-nommes.js`. Aucune migration n'est modifiée.

### Ce qui était faux

`20260916221100` révoque deux fonctions dans une boucle :
`foreach v_sig in array v_sigs loop execute format('revoke all on function %s
from public, anon', v_sig)`. La garde lisait le `%s` comme une signature. Elle
comptait une fonction fictive et ne voyait pas les deux vraies.

Le défaut était plus large que ce fichier. Six migrations FDJ du 16/09 suivent
le même modèle. En tout, **30 fonctions réelles** n'étaient lues par la garde
qu'à travers ce fantôme.

### La correction

- Un revoke `execute format('revoke … on function %s|%I|%L from <rôles>', <var>)`
  est résolu par la boucle `foreach <var> in array <tableau>` qui le précède,
  puis par la déclaration `<tableau> text[] := array['…', …]`. Chaque
  littéral devient une entrée réelle, avec les rôles écrits dans le gabarit.
- Un gabarit que la garde ne sait pas résoudre bloque, au lieu d'être compté
  ou ignoré : code `REVOKE_DYNAMIQUE_NON_RESOLU`, **quelle que soit
  l'estampille**, même sous le seuil. Une signature contenant `%` n'est donc
  plus jamais relevée ni mise en dette.
- La règle du seuil ne change pas. Au-delà de `20261001000000`, une boucle qui
  oublie `authenticated` rend `REVOKE_INCOMPLET` (épreuve R13).

Épreuves ajoutées dans `test_garde_revoke_fonction_roles_nommes_20261001.js` :

- **R11** rejoue le fichier réel `20260916221100` : aucune clé ne contient `%`,
  et les deux vraies fonctions sont relevées avec `public` et `anon` révoqués ;
- **R12** : une boucle non résoluble et un `%s` nu bloquent, même sous le seuil ;
- **R13** : au-delà du seuil, une boucle incomplète est refusée ;
- **R14** : sur le dépôt réel, il ne reste aucun `%` et aucun non résolu.

Contre-épreuve par mutation : on débranche la résolution et on remet le
`continue` silencieux sur un gabarit. R8 rougit alors (la dette mesurée
s'effondre). Si l'on ajuste en plus la dette pour faire passer R8, c'est R11
qui rougit, car `fdj_saisir_caisse_manager` n'est plus relevée.

### Dette recalculée : 23 → 47

La garde vise 63 fonctions par un revoke.

| | Entrées |
|---|---|
| Dette annoncée par l'addendum précédent | 23 |
| − l'entrée fantôme `%s` | −1 |
| + fonctions FDJ réelles masquées et non statuées pour `authenticated` | +25 |
| **Dette mesurée et gelée (`DETTE_GELEE`)** | **47** |

Parmi les 30 fonctions résolues, 5 sont conformes et ne comptent pas.
`fdj_calculer_caisse` et `fdj_cle_idempotence` révoquent `public`, `anon` **et**
`authenticated` dans leur boucle. Les 25 autres révoquent `public` et `anon`,
puis accordent explicitement `authenticated` sans le marqueur
`nexus-acl-intention`.

La dette se répartit ainsi : **30 entrées FDJ** (5 statiques déjà comptées et
25 issues des boucles) et **17 hors FDJ**, inchangées.

### Exposition réelle — mesure en Production, lecture seule (04/10/2026)

`has_function_privilege` a été mesuré sur les 47 signatures, sous
`begin read only`, projet `uzhjpqpctpvxytxpxoqz`.

| | Nombre |
|---|---|
| Signatures absentes de Production | 1 : `basculer_source_planning(text,text,text)`, seule la surcharge à 4 arguments existe |
| `anon` peut exécuter | **5** |
| `authenticated` peut exécuter | 45 |
| Ni l'un ni l'autre | 1 : `run_scheduled_inventory_reviews()`, ACL `{postgres=X}` |

**Les 30 entrées FDJ, une par une : `anon` = faux, `authenticated` = vrai.**
Aucune n'est une exposition. Chacune est un **marqueur d'intention manquant**.
L'accès `authenticated` est voulu et écrit en SQL par un `grant`, mais il n'est
pas déclaré sous `nexus-acl-intention`, qui a été créé après ces fichiers.

Les **5 ouvertures à `anon`** sont toutes hors FDJ. Elles figuraient déjà parmi
les 23 de l'addendum précédent : la correction ne les crée pas et ne les masque
pas.

- `_generate_inventory_review_core(text,date,date,text)`,
  `generate_inventory_review(text,date,date,text)` et `stats_fondateur()` :
  SECURITY DEFINER, ACL `{postgres,anon,authenticated,service_role}=X` ;
- `inventaire_enregistrer_transfert_localise(…)` : documentée le 11/09
  (`lots/NEXUS-POINTAGE-CORRECTIF-1-20260911/securite-fonctions-security-definer-1.md`),
  la fonction vérifie `auth.uid()`, et rien n'y a été touché sans GO ;
- `nexus_identifiant_de_connexion(text)` : ouverte à `anon` **par conception**.
  C'est le login non énumérable, appelé avant toute session.

Ces cinq ouvertures sont une dette préexistante. Elles sont signalées ici sans
être traitées : les fermer exigerait une migration Production et un GO par
geste, hors du périmètre de cette correction.

### Ce que cet addendum ne fait pas

Il ne requalifie aucune entrée et ne vaut ni fusion, ni déploiement, ni
migration, ni écriture en Production. Il ne modifie aucun fichier de migration.

## Addendum du 04/10/2026 (lot anon5) — fermer `anon` sur quatre des cinq ouvertures hors FDJ

Lot sécurité indépendant du chantier FDJ et de la Phase C (C4, carnets FDJ,
Point Zéro inventaire) : rien ici ne les touche.

### Proposée incluse dans une future release Production (1 migration)

1. `20261004130000_revoquer_anon_quatre_fonctions_hors_fdj`
   (sha256 `43489265936d14bcc06b4804d31f8e511505605d296c694bd39b70d8e74730b1`)

Elle traite les cinq ouvertures à `anon` relevées par l'addendum précédent.
Elles ont été re-mesurées en Production le 04/10/2026, en lecture seule
(`begin read only`, `uzhjpqpctpvxytxpxoqz`) : les cinq fonctions sont SECURITY
DEFINER, propriété de `postgres`, avec l'ACL
`{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`
et PUBLIC absent. Les md5 de `prosrc` sont égaux en Production et sur
nexus-test.

| Fonction | ACL cible | Exposition `anon` |
|---|---|---|
| `_generate_inventory_review_core(text,date,date,text)` | `service_role` seul | **accidentelle, grave** : aucun contrôle, agrégats d'inventaire de n'importe quel site, appelée seulement par deux SECURITY DEFINER de `postgres` et le cron |
| `generate_inventory_review(text,date,date,text)` | `authenticated`, `service_role` | accidentelle : `revoke … from public` seul (20260803020504/021549) |
| `inventaire_enregistrer_transfert_localise(…)` | `authenticated`, `service_role` | accidentelle : `revoke … from public` seul (20260831102427/102512) |
| `stats_fondateur()` | `authenticated`, `service_role` | accidentelle : `GRANT ALL TO anon` de la baseline 20260101000000 |
| `nexus_identifiant_de_connexion(text)` | **inchangée** | **voulue** : login non énumérable, appelé avant toute session (20260904175747) |

La migration est strictement additive (revoke et grant seulement). Elle porte
un marqueur `nexus-acl-intention … garde authenticated (motif)` pour chacune
des trois RPC conservées. Garde : `test_securite_anon_quatre_fonctions_20261004.js`.

### Dette de la garde revoke : 47 → 43

Les listes avant et après ont été comparées. Exactement quatre signatures
sortent : les quatre fonctions que la migration statue nommément. Aucune autre
n'entre ni ne sort. La dette baisse donc pour une cause démontrée : ce n'est pas
une reclassification.

### Recette nexus-test (`udljdqxerrbbbajxubfn`), 04/10/2026

La migration a été appliquée par psql `--single-transaction`, estampille
comprise (registre 305 → 306). Les cas ont été joués avant et après
l'application, chacun dans une transaction annulée.

| Cas | Avant | Après |
|---|---|---|
| anon → core | EXECUTE OK (lecture inter-site) | REFUS 42501 |
| anon → generate_inventory_review | atteinte (`accès refusé`) | REFUS 42501 |
| anon → transfert | atteinte (`AUTH_REQUISE`) | REFUS 42501 |
| anon → stats_fondateur | atteinte (`Non autorisé`) | REFUS 42501 |
| anon → nexus_identifiant_de_connexion | EXECUTE OK | EXECUTE OK |
| manager-test → core en direct | EXECUTE OK | REFUS 42501 |
| manager-test → generate_inventory_review (son site) | OK (rapport rendu) | OK, core atteinte via le DEFINER |
| manager-test → generate_inventory_review (autre site) | `accès refusé` | `accès refusé` |
| manager-test → transfert réel sur fixtures annulées | — | OK, stock 10 → 7, mouvement créé |
| anon → transfert sur le même jeu | — | REFUS 42501 |
| test-createur → stats_fondateur | OK (3 sites) | OK (3 sites) |
| manager-test → stats_fondateur | `Non autorisé` | `Non autorisé` |
| service_role → core | EXECUTE OK | EXECUTE OK |
| postgres → run_scheduled_inventory_reviews (cron) | EXECUTE OK | EXECUTE OK |

Les fixtures du transfert ne laissent aucun résidu : 0 zone et 0 produit
`ANON5` mesurés après l'annulation.

**Absence de régression causale.** Avant le correctif, `anon` n'obtenait déjà
aucun résultat utile des trois RPC : leur corps le refusait. Aucun parcours
fonctionnel ne pouvait donc dépendre de cet accès. Seule `core` rendait des
données à `anon`, et aucun écran ne l'appelle. Les appelants servis sont
`nexus-inventaire-manager-donnees.js`, `nexus-rapport-direction-donnees.js`,
`nexus-inventaire-stock-transfert-v2.js` et `NEXUS-Admin-Sites-v1.html`. Tous
passent par `nexus-auth.js` ou `getSession`, donc par le rôle `authenticated`
simulé ci-dessus.

Limite : le parcours a été prouvé au niveau RPC, avec le rôle et le JWT que
PostgREST transmet. Aucune recette navigateur connectée n'a été jouée.

### Divergence propre à nexus-test, hors périmètre

`run_scheduled_inventory_reviews()` est ouverte à `anon`, `authenticated` et
`service_role` sur Test (md5 `bb5fa665…`). En Production, elle est fermée
(`{postgres=X}`, md5 `45707923…`). Elle est signalée ici, pas traitée.

### Ce que cet addendum ne fait pas

Il ne vaut ni fusion, ni déploiement, ni migration, ni écriture en Production.
Il ne modifie aucune migration historique. Il ne traite pas
`current_employee_role()`, `current_employee_site_id()` ni `je_suis_createur()`,
exécutables par PUBLIC et `anon` mais hors du périmètre des cinq.
