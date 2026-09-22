# Preuve #65 — création réelle d'objets sur un schéma reproduisant les 276 migrations Production

*Exigence arbitrée : « une preuve sur un schéma reproduisant exactement l'état des
276 migrations Production, puis appliquer uniquement la 277e migration #65 et
vérifier les objets attendus. Cela peut être fait dans un environnement jetable ;
aucune écriture Production n'est nécessaire. »*

**Verdict de la preuve : VERTE et NON VIDE.** La 277e migration crée 13 objets
mesurés, n'en retire aucun, et sa garde de rôle mord là où la RLS ne mord pas.
Ceci lève le trou de preuve de #65 ; cela **ne vaut pas GO de fusion**.

Date : 22/09/2026. Aucune écriture Test ni Production. Aucun réseau vers Supabase.

## 1. L'environnement jetable

| Élément | Valeur |
|---|---|
| Image | `supabase/postgres:17.6.1.175` |
| Moteur | PostgreSQL **17.6** — identique à Production (`server_version_num` 170006) |
| Conteneur | `nexus-jetable`, local, port 55432, détruit à volonté |
| Source des 276 | `git archive origin/production supabase/migrations` |
| Application | ordre de nom de fichier, `psql -v ON_ERROR_STOP=1`, une transaction par fichier |
| Résultat | **276 / 276 appliquées, zéro erreur** |

### Un échafaudage a été nécessaire, et il est déclaré

L'image Supabase livre le **schéma** `storage` mais pas ses tables : elles sont
posées par le service `storage-api`, absent d'un conteneur nu. La 28e migration
(`20260731172849_remote_schema.sql`) s'arrêtait donc sur
`relation "storage.objects" does not exist`.

`storage.buckets`, `storage.objects`, `storage.foldername()` et
`storage.filename()` ont été recréées à l'identique du modèle Supabase, **avant**
les 276, en tant que `supabase_admin`. C'est un échafaudage d'environnement, pas
un objet du produit : aucune des 276 ni la 277e ne le modifie, et il est hors du
périmètre mesuré ci-dessous (les huit rubriques d'instantané couvrent `public` et
`storage`, ce qui rend l'échafaudage visible dans l'avant **et** dans l'après,
donc neutre au différentiel).

## 2. L'instantané, avant et après

Huit rubriques relevées avant et après la 277e : colonnes, contraintes, index,
policies, routines, tables, triggers, types. **4 369 lignes** dans l'instantané
d'avant.

Migration appliquée, et une seule :
`supabase/migrations/20260919103000_carburant_reception_regularisation_releve_manuscrit.sql`
(extraite de `fe36a8e`, 147 lignes, sha256
`1a02adca37af32b6ea3ffa3ec41b43968502d75bd515877b47e1d4073a8d6caf`).

### Ce que la 277e AJOUTE — 13 objets

**Huit colonnes**

| Table | Colonne | Type | NULL | Défaut |
|---|---|---|---|---|
| `carburant_reception_visites` | `mode_saisie` | text | NON | `'temps_reel'` |
| `carburant_reception_visites` | `regularisation_motif` | text | oui | — |
| `carburant_reception_visites` | `regularisation_par` | uuid | oui | — |
| `carburant_reception_visites` | `regularisation_par_nom` | text | oui | — |
| `carburant_reception_visites` | `regularisation_le` | timestamptz | oui | — |
| `carburant_reception_visites` | `controle_terrain_par` | text | oui | — |
| `carburant_reception_visites` | `justificatif_url` | text | oui | — |
| `carburant_reception_mesures` | `source` | text | NON | `'saisie_nexus'` |

**Trois contraintes de vérification**
`carburant_reception_visites_mode_saisie_check`,
`carburant_reception_visites_regularisation_coherente_check`,
`carburant_reception_mesures_source_check`.

**Une routine** `public.nexus_garde_regularisation_reception()`, `SECURITY DEFINER`.

**Un trigger** `trg_garde_regularisation_reception`, `before insert or update`
sur `carburant_reception_visites`.

### Ce que la 277e RETIRE

**Rien.** Le différentiel inverse est vide.

**C'est la levée exacte du motif de NO GO.** Sur Test la même migration était un
no-op — zéro objet créé. Sur un schéma qui reproduit réellement les 276, elle
crée treize objets. Le vide de la preuve Test venait de la dérive de Test, pas de
la migration.

## 3. La garde mord — treize cas, dont un contre-témoin

Un objet créé n'est pas un objet qui sert. Treize cas joués en transactions
annulées, sur le schéma à 277 migrations, avec un site, un pompiste et un
manager.

| # | Cas | Attendu | Obtenu |
|---|---|---|---|
| T1 | `temps_reel` par un pompiste | passe | **passe** |
| T2 | `regularisation` par un pompiste | refus `42501` | **refus, par la garde** |
| T3 | `regularisation` par un manager | passe | **passe** |
| T4 | `regularisation` sans motif | refus | **refus, check de cohérence** |
| T5 | `temps_reel` portant des champs de régularisation | refus | **refus, check de cohérence** |
| T6 | `regularisation_le` antérieure à `heure_fin` | refus | **refus, check de cohérence** |
| T7 | `mode_saisie` hors vocabulaire | refus | **refus, check de vocabulaire** |
| T8 | `source` de mesure hors vocabulaire | refus | **refus, check de vocabulaire** |
| T9 | UPDATE vers `regularisation`, pompiste non de service | refus | **0 ligne, arrêté par la RLS en amont** |
| T10 | UPDATE vers `regularisation`, **pompiste DU JOUR** | refus | **refus, par la garde** |
| T11 | UPDATE vers `regularisation` par le manager | passe | **passe, 1 ligne** |
| T12 | **contre-témoin** : garde retirée, on rejoue T2 | passe | **passe** |
| T13 | `service_role` sans employé connecté | passe | **passe** |

**T10 est le cas décisif.** La policy UPDATE laisse passer le pompiste de service
(`est_pompiste_du_jour` mesuré à `true` dans la transaction). La RLS ne le
refuse donc pas — c'est la garde qui le refuse. Sans elle, réserver la
régularisation au manager n'aurait vécu que dans l'écran, exactement la dette
constatée le 18/09 sur le rôle du jour.

**T12 est le contre-témoin.** Le rouge de T2 vient bien du trigger : retiré, la
même insertion passe. Un banc qui ne sait pas montrer d'où vient son rouge ne
prouve rien.

**T9 est une observation, pas un défaut.** Un pompiste hors service voit son
UPDATE silencieusement réduit à zéro ligne par la RLS, sans erreur. La garde ne
se déclenche pas parce qu'elle n'a rien à voir. Le refus existe, il est
seulement muet.

## 4. Deux constats à porter au dossier

### 4.1 `revoke ... from public` ne ferme toujours pas `anon` — 4e occurrence

La migration écrit `revoke all on function
public.nexus_garde_regularisation_reception() from public`. Mesure de l'ACL
après application :

```
postgres=X/postgres ; anon=X/postgres ; authenticated=X/postgres ; service_role=X/postgres
has_function_privilege('anon', …, 'execute')          = true
has_function_privilege('authenticated', …, 'execute') = true
```

Supabase accorde `EXECUTE` par **grants nommés** issus des default privileges :
révoquer à `PUBLIC` ne les touche pas. Pour fermer, il faut nommer `anon` et
`authenticated`.

**Portée réelle : faible, et il faut le dire.** C'est une fonction de trigger
sans argument ; l'appel direct est refusé par le moteur
(`trigger functions can only be called as triggers`, vérifié). Le privilège
résiduel n'ouvre donc aucun chemin d'écriture. Ce qui est en défaut, c'est
l'intention écrite dans la migration, qui n'est pas celle obtenue — et c'est la
quatrième fois que la même ligne échoue de la même façon.

### 4.2 La 277e porte un horodatage antérieur à **neuf** migrations déjà appliquées

`20260919103000` trie **avant** neuf versions déjà en Production, de
`20260919160000` à `20260920140000`. La preuve ci-dessus a été menée dans
l'ordre réel de déploiement — les 276 puis celle-ci en dernier — donc le
résultat ne dépend pas de ce défaut de numérotation. Deux des neuf consomment
`current_employee_role` / `est_pompiste_du_jour` sans redéfinir les tables de
réception : aucune contradiction sémantique.

Le risque est **outillage**, pas schéma : la CLI Supabase refuse ou avertit
lorsqu'un fichier local doit s'insérer avant la dernière migration distante.
À traiter avant le déploiement, par renommage de la version ou par application
explicite.

## 5. Reproduire

Prérequis : Docker, `git`, et un clone du dépôt. Aucun secret, aucun accès
Supabase.

```bash
D=$(mktemp -d)
git archive origin/production supabase/migrations | tar -x -C "$D" --strip-components=2
docker run -d --name nexus-jetable -e POSTGRES_PASSWORD=jetable -p 55432:5432 \
  supabase/postgres:17.6.1.175
# … échafaudage storage en supabase_admin (§1) …
docker cp "$D" nexus-jetable:/mig276
docker exec nexus-jetable bash -c \
  'cd /mig276; for f in $(ls *.sql | sort); do psql -v ON_ERROR_STOP=1 -U postgres -d postgres -q -f "$f" || exit 1; done'
# instantané avant, puis la 277e seule, puis instantané après, puis comm -13 / -23
docker rm -f nexus-jetable
```

## 6. Ce que cette preuve n'autorise pas

Elle lève le motif de NO GO de #65, et rien d'autre. Restent hors autorisation :
fusion vers `production` ou `main`, déploiement, migration Supabase Production,
écriture de données Production. Le constat §4.1 et le constat §4.2 sont à
arbitrer avant qu'un GO de déploiement soit demandé.
