# Procédure Production NEXUS — qualification de l'ordre `migration → code`

Addendum à la procédure de déploiement Production. **Append-only** : une
section publiée ici ne se réécrit pas, elle se complète par une section
datée.

## Ce que cette garde ajoute, et ce qu'elle ne double pas

Le dépôt possède déjà un classement des migrations :
`test_manifeste_migrations_complet_20260909.js` et
`outils/verifier-manifeste-migrations-complet.js` exigent que chaque
migration postérieure à `VERSION_PRODUCTION` soit citée au manifeste et
classée **incluse / exclue / bloquée**.

Cet axe répond à : *cette migration appartient-elle à la release ?*

Il ne répond pas — et ne prétend pas répondre — à : *dans quel ordre
l'appliquer par rapport au code, et contre quel état réellement mesuré de
la base cible ?* Mesuré le 30/09/2026 : le contrôle existant passe **6/6 sur
le rail**, `20260919103000_carburant_reception_regularisation_releve_manuscrit`
comprise, alors que l'ordre de cette migration n'était qualifié nulle part et
que son application avant le code #65 était justement la question ouverte.
Ni `verifier-manifeste-migrations-complet.js` ni le test qui le câble ne
contiennent les mots `registre`, `catalogue`, `appliquée`, `ordre` ou
`lock` : leur « refus de conclure sur une base mouvante » désigne le
*fichier* manifeste, pas la base de données.

Les deux axes restent séparés, et **ne doivent pas se citer l'un l'autre** :
un fichier qui redirait l'appartenance à la release créerait la
documentation concurrente que la maison interdit. Le manifeste dit *si* ;
ce fichier dit *dans quel ordre, contre quel état mesuré, quand*.

## La règle

Une PR qui introduit une migration dont le code dépend **ne peut pas être
déclarée prête à fusionner** tant que l'état de la base cible et l'ordre
`migration → code` ne sont pas explicitement qualifiés.

`outils/garde-ordre-migration-code.js` l'applique. Il est **statique** : il
lit deux refs Git et un fichier JSON. Il n'ouvre aucune base, ne nomme aucun
secret, n'a aucun accès réseau — propriété éprouvée par le contrôle F2 de
`test_garde_ordre_migration_code_20260930.js`, qui lit la source de la garde
et refuse d'y trouver `PGPASSWORD`, `psql`, `service_role`, `SUPABASE_`,
`DB_URL`, `https://` ou un `require` de `https`/`net`/`tls`.

```
node outils/garde-ordre-migration-code.js <candidat> <cible>
# défauts : HEAD contre origin/production
```

La garde compare les deux arbres de `supabase/migrations/` **par différence
d'ensembles, jamais par cardinal**. Le 30/09/2026, « 277 contre 276 » avait
laissé croire à un écart d'un fichier sans jamais dire *lequel*. Une
migration présente dans la cible et absente du candidat est un refus
(`MIGRATION_RETIREE`) : un candidat doit être un sur-ensemble de sa cible.

## Les cinq états

| état | ce qu'il affirme | ce qu'il doit prouver |
|---|---|---|
| `migration_deja_appliquee` | les objets sont déjà là | une mesure **catalogue** + `objets_constates` citant **tous** les objets créés par le fichier. Une liste partielle est refusée et le refus nomme l'objet manquant. |
| `additive_compatible_avant_code` | on peut l'appliquer avant le code sans rien casser | aucun DDL destructif ; aucune colonne `not null` sans défaut ; et le code **de la cible** ne nomme aucun des nouveaux identifiants. |
| `exige_code_d_abord` | le code doit précéder | une `procedure` désignant un fichier qui **existe**. |
| `atomique_ou_procedure_speciale` | migration et code indissociables | la même exigence de procédure. Cet état *suppose* le DDL destructif au lieu d'être contredit par lui. |
| `etat_inconnu` | rien n'est mesuré | **refus fermé**. |

Absent, vide ou non reconnu vaut `etat_inconnu` : `MIGRATION_NON_QUALIFIEE`,
`ETAT_NON_RECONNU`, `ETAT_INCONNU`.

### Pourquoi « état inconnu = refus fermé » n'est pas du formalisme

`20260919103000` est idempotente : `add column if not exists`,
`exception when duplicate_object`, `create or replace`,
`drop trigger if exists`. On pourrait croire qu'un état inconnu est sans
risque, puisqu'un rejeu ne peut pas échouer. C'est l'inverse :
`if not exists` passe **en silence** sur une colonne qui existe déjà *avec
une autre définition*. **L'idempotence ne rend pas l'état inconnu sûr — elle
le rend muet.**

### Pourquoi la mesure doit venir du catalogue, jamais du registre

Source de mesure recevable : `catalogue`, `schema`, `schéma`. Tout le reste
(`registre`, `supabase_migrations`, `migration list`) est refusé
`MESURE_NON_RECEVABLE`.

Mesuré sur Test le 30/09/2026 : **le schéma portait la totalité des objets de
`20260919103000` alors que son estampille était absente du registre**, et
**286 des 287 lignes du registre ont `statements` à `NULL`**. Un registre
atteste qu'un outil a inscrit une ligne. Il n'atteste pas qu'un objet existe,
ni qu'il a la définition attendue. Seul le catalogue
(`information_schema`, `pg_catalog`) répond à la question posée.

### Pourquoi une mesure périme

`mesure.le` est obligatoire, doit être lisible, non future, et plus récente
que `NEXUS_QUALIFICATION_HEURES` (défaut **72 h**) — sinon
`MESURE_SANS_DATE`, `MESURE_DANS_LE_FUTUR`, `MESURE_PERIMEE`.
`mesure.cible` est obligatoire : une mesure prise sur Test ne qualifie pas
Production.

C'est l'invariant déclaré par Frédéric, appliqué ici : *le résultat d'une
mesure est une observation datée, pas une propriété permanente du canal. Une
impossibilité constatée le 28 septembre ne doit jamais devenir « Claude ne
peut pas faire X » en octobre sans nouvelle mesure.*

## Forme du fichier de qualification

`docs/deploiement/qualification-ordre-migration-code.json`, clé = estampille.

```json
{ "migrations": { "20260919103000": {
    "etat": "additive_compatible_avant_code",
    "mesure": { "source": "catalogue", "le": "2026-09-30T14:00:00Z",
                "cible": "uzhjpqpctpvxytxpxoqz", "par": "frederic" },
    "objets_constates": ["mode_saisie", "..."],
    "procedure": "docs/deploiement/....md",
    "justification": "une phrase qui dit pourquoi" } } }
```

## Première prise de la garde, 30/09/2026

Lancée pour de vrai, elle a attrapé deux choses que personne ne regardait :

**Candidat `5dcdaaa55f5804f88594c91c272439cf77a123b0` contre
`origin/production`** — 277 contre 276, **1 nouvelle, 0 retirée** :
`20260919103000`. La garde en a extrait les **13 objets** (8 colonnes,
3 contraintes, 1 fonction, 1 trigger) et constaté que **le code du candidat
nomme 9 de ces identifiants**. Verdict : `MIGRATION_NON_QUALIFIEE`. La garde
reproduit donc seule, par analyse statique, le risque d'ordre établi à la
main — ce qui fait de ce NO-GO une mesure et non une opinion.

**Rail `handoff-continuite-20260920` contre `origin/production`** — 287 contre
276, **11 nouvelles, 0 retirée**, aucune qualifiée. Ce sont exactement les
11 estampilles hors-bande déjà connues sur Test. Fait nouveau : **le code du
rail lui-même dépend de quatre d'entre elles** —
`nexus_identifiant_de_connexion` (20260904175747), `est_pompiste_du_jour`
(20260906113147), `nexus_live_events` et ses deux policies (20260907222249),
`recette_ci_site_test` (20260908033743). Le rail est donc lui-même non
qualifié au regard de sa propre règle neuve.

Ces 11 migrations ne sont **pas** qualifiées d'office par ce fichier. Les
qualifier demanderait une mesure catalogue sur Production que je ne peux pas
prendre, et les déclarer sans mesure serait précisément la faute que la garde
existe pour empêcher.

### Conséquence pour le câblage CI

Brancher cette garde dans `.github/workflows/deploiement-production.yml`
**fermerait le rail** jusqu'à ce que ces 11 estampilles soient qualifiées.
C'est pourquoi le câblage est un **geste préparé distinct**, nommé comme tel,
et non inclus dans le même commit que la garde : une preuve de fonction n'est
pas une preuve de câblage, et un câblage qui bloque tout est désactivé dans la
semaine.

### Limite connue de l'extraction d'identifiants

`20260908035027_lecture_sites_role_ci_recette_pour_evaluation_rls.sql` ne rend
« aucun identifiant extrait » : c'est une migration de `grant` seuls, qui ne
crée aucun objet nommé. Une migration de droits purs échappe donc à la
détection de dépendance du code. Limite assumée et écrite ici plutôt que
découverte plus tard.

## Premier préflight écrit sous cette règle

`docs/deploiement/preflight-20260919103000-production.md` applique la grille
ci-dessus à la migration de #65, au SHA `5dcdaaa55f5804f88594c91c272439cf77a123b0`.
Conclusion : `NO_GO_MIGRATION_PRODUCTION`, non parce que la migration serait
défectueuse — elle est additive, idempotente, applicable avant le code — mais
parce que l'état AVANT de Production n'a jamais été mesuré. La règle s'est donc
d'abord appliquée à son propre cas.

## 01/10/2026 — la rubrique 3 du préflight pouvait rendre vide pour invisible

Section ajoutée, rien au-dessus n'est réécrit.

Le préflight `preflight-20260919103000-production.md` lisait les colonnes de
l'état AVANT dans `information_schema.columns`. Cette vue **ne montre que les
objets sur lesquels le rôle courant détient un privilège**. Mesuré le
01/10/2026 en conteneur jetable `supabase/postgres:17.6.1.175`, objets créés à
l'image des réels, rôle sonde sans privilège dessus : `information_schema`
rend **0** colonne là où `pg_attribute` en rend **6**.

Conséquence : un rôle sans droit produit une rubrique 3 vide, et le préflight
lit « rubriques 3 à 6 vides » comme une autorisation. **Le faux négatif penche
vers le GO.** `pg_constraint`, `pg_proc` et `pg_trigger` ne sont pas filtrés
par privilège — les rubriques 4, 5 et 6 étaient honnêtes.

**Règle ajoutée à cet axe.** Une mesure catalogue produite pour trancher une
absence doit être lue dans `pg_catalog`, jamais dans `information_schema`, et
l'identité qui la joue doit être nommée dans le rapport. Une rubrique vide sans
identité nommée est une **lecture incomplète**, donc un refus fermé — pas une
absence constatée.

Le correctif de requête est au §15.5 du préflight. Le verdict
`NO_GO_MIGRATION_PRODUCTION` est maintenu : l'état AVANT reste non mesuré.
