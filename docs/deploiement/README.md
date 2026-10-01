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

## 01/10/2026 — accorder un droit peut supprimer une condition d'arrêt

Pour renseigner la rubrique de volume d'un préflight, il avait été envisagé
d'accorder `SELECT` au rôle de lecture seule sur les deux tables visées. Mesuré
en conteneur jetable, sur une fixture reproduisant la forme Production (RLS
activée, policy `using (site = (select current_employee_site_id()))`, fonction
du socle `select site_id from employees where id = auth.uid()`, rôle `login
nobypassrls`), avec **2 400** et **6 800** lignes réellement présentes :

| rubrique | sans `grant` | avec `grant select` |
|---|---|---|
| `count(*)` | `permission denied` | **`0`** |

Le `grant` ne rend pas la table lisible : il rend le refus silencieux. Une
connexion `psql` n'a pas de jeton, `auth.uid()` vaut NULL, la policy ne retient
aucune ligne. Et `0` satisfait une condition d'arrêt formulée « moins de 1 M
lignes ».

**Règle.** Avant d'élargir un droit pour rendre une mesure possible, mesurer ce
que ce droit change — et vérifier qu'il ne transforme pas un refus en valeur
plausible. Un `permission denied` est une condition d'arrêt qui fonctionne ;
une valeur obtenue en la supprimant vaut moins que le refus qu'elle remplace.

**Corollaire.** Un volume ne se lit pas par `count(*)` sous RLS. Il se lit par
`pg_stat_user_tables.n_live_tup` et `pg_total_relation_size()`, qui ne sont
filtrés ni par privilège ni par RLS — et jamais par `pg_class.reltuples`, qui
vaut **-1** sur une table jamais analysée, et -1 n'est pas « petit ».

Détail et bloc de lecture exécutable :
`preflight-20260919103000-production.md` §16.

## 01/10/2026 — relire un bloc comme un geste à frapper, pas comme un texte

Les blocs SQL des §11 et §16.5 du préflight `20260919103000` avaient été
écrits, relus, et jamais relus **comme un geste qu'on va frapper**. Relus à ce
titre au moment de livrer l'application, ils portaient quatre défauts.

| défaut | ce que le bloc faisait | ce qu'il prétendait faire |
|---|---|---|
| noms de contraintes croisés entre les deux tables, un troisième absent | rubrique vide **quoi qu'il arrive** | constater l'absence des 3 contraintes |
| `select 'temps_reel' is distinct from 'regularisation'` | `true`, toujours | témoin de non-régression du trigger |
| 3 `count(*)` sur 8 colonnes, 3 contraintes, 1 trigger | 12 objets mesurés | « 13 objets attendus » |
| `information_schema.columns` | dépend d'un privilège | compter des colonnes |

Trois règles en sortent.

**Une rubrique vide ne prouve rien tant que la requête n'a pas été prouvée
capable de rendre quelque chose.** Un nom d'objet mal orthographié produit
exactement la même lecture qu'une absence réelle — et c'est l'absence qui
ouvre la porte. Tout contrôle dont le résultat attendu est « vide » ou « 0 »
doit être éprouvé une fois contre un état où il doit rendre non-vide.

**Un contrôle qui ne référence que des littéraux n'est pas un contrôle.** Si
l'expression ne cite ni table, ni catalogue, ni colonne, son résultat est
décidé à l'écriture, pas à l'exécution. Elle figurait pourtant dans le critère
de validation du `commit`.

**Compter les objets annoncés.** Le texte disait 13, les contrôles en
mesuraient 12 ; l'objet manquant était la fonction, c'est-à-dire la garde
elle-même. L'écart se voit en additionnant, pas en relisant.

Le biais commun aux trois premiers : **le défaut penche vers le GO.**
Troisième occurrence documentée sur ce même dossier. Quand une erreur de
mesure a une direction, c'est toujours celle qui débloque.

## 01/10/2026 — une requête d'audit se relit sous l'identité qui la jouera

Le bloc de lecture APRÈS du préflight #65 était exact — pour le rôle qui
applique la migration. Sous le rôle de lecture seule qui doit réellement
l'exécuter, il rendait une lecture fausse de deux façons, et aucune des deux
ne se voit à l'œil.

| rubrique | sous un rôle restreint | ce qu'on aurait lu |
|---|---|---|
| `count(*)` sur une table hors liste blanche | `permission denied` | la requête entière meurt — rien n'est mesuré |
| `information_schema.columns` | ne montre que les objets privilégiés | « colonnes absentes » sur une base où elles existent |

Trois règles qui en sortent :

1. **Une requête d'audit se relit sous l'identité qui la jouera**, pas sous
   celle qui l'a écrite. `pg_catalog` n'est pas filtré par les privilèges ;
   `information_schema` l'est.
2. **Un audit ne lit jamais une donnée métier pour mesurer une structure.**
   Un volume se lit par `n_live_tup`, jamais par `count(*)` : le `count(*)`
   échoue, ou se tait sous RLS, et dans les deux cas il emporte la mesure.
3. **Un verdict se répète avant d'être proposé**, sur un environnement où la
   réponse est connue, avec au moins un contre-témoin qui le fait sortir du
   vert. Un contre-témoin a montré ici qu'une lecture visant des tables
   inexistantes annonçait « 1/13 » — un état partiel imaginaire — tant que la
   garde de capacité n'existait pas.

## 01/10/2026 — un refus mal motivé coûte plus cher qu'une panne

La lecture APRÈS de #65 a refusé de s'exécuter en annonçant « l'URL ne désigne
pas le projet attendu ». La garde avait raison de s'arrêter et tort sur le
motif : l'entrée de trousseau ne contenait pas une URL du tout, mais un mot de
passe. Aucune référence de projet ne pouvait s'y trouver.

Trois règles en sortent.

1. **Avant de corriger ce qui est refusé, mesurer ce qui refuse.** Deux
   hypothèses opposées existaient — référence attendue fausse, ou valeur
   stockée inattendue. Corriger la mauvaise aurait cassé la garde au lieu du
   script. La référence a donc été vérifiée contre l'arbre du dépôt, et la
   valeur contre sa seule forme (longueur, classes de caractères), jamais
   contre son contenu.
2. **Un script qui implémente une phrase de documentation n'a mesuré personne.**
   Le document de rôle annonçait « contenant l'URL complète » ; la convention
   réellement en usage dépose le mot de passe. Le même fichier portait les
   deux : la branche Test faisait juste, trois lignes au-dessus de la branche
   Production qui faisait faux. Relire la voie qui échoue à la lumière de la
   voie jumelle qui marche.
3. **Choisir une identité n'est pas la constater.** Composer une URL avec un
   rôle de lecture seule ne dit pas sous quelle identité le serveur accepte la
   session. `current_user` est désormais demandé au serveur et comparé à
   l'attendu, et la liste blanche refuse `postgres` avant même la connexion —
   une capacité constatée n'est jamais une autorisation. Chaque refus a son
   propre code de sortie, pour qu'il rougisse en disant lequel.

## 01/10/2026 — la mesure a eu lieu : une qualification se prouve acceptée, et elle périme

La lecture APRÈS a été jouée par Frédéric le 01/10/2026 à 15 h 01 UTC et a
rendu `MIGRATION_APPLIQUEE — 13/13`. L'état `etat_inconnu` de
`qualification-ordre-migration-code.json` a été remplacé par
`migration_deja_appliquee`. Trois règles sont sorties de cette consommation,
et aucune n'était évidente avant de l'avoir faite.

1. **Un compte n'est pas une correspondance.** « 13 constatés pour 13
   attendus » ne dit rien : deux ensembles de treize peuvent différer. La
   liste attendue a donc été dérivée du fichier de migration par
   `extraireObjets()` — la fonction de la garde elle-même, pas une liste
   recopiée à la main — puis comparée **nom par nom** aux treize mesurés :
   zéro attendu non constaté, zéro constaté non attendu. Le fichier de
   qualification porte cette phrase, pour que personne ne relise l'égalité des
   comptes comme une preuve.
2. **Une qualification écrite n'est pas une qualification acceptée.** Le seul
   contrôle qui vaut est de rejouer la garde sur la situation qu'elle juge —
   ici le candidat qui introduit la migration contre son parent réel, pas
   contre une cible devinée — et de lire `ok=true code=QUALIFIE`. Trois
   contre-témoins ont ensuite montré qu'elle mord encore, chacun rouge par son
   propre motif : un objet retiré de la liste → `OBJETS_NON_CONSTATES` nommant
   l'objet manquant ; la mesure vieillie à 73 h → `MESURE_PERIMEE` ; la source
   passée de `catalogue` à `registre` → `MESURE_NON_RECEVABLE`. Un vert
   obtenu sans contre-témoin ne distingue pas une garde satisfaite d'une garde
   débranchée.
3. **Une mesure est une observation datée, pas une propriété de la base.** La
   qualification cesse de qualifier le 04/10/2026 à 15 h 01 UTC, et la garde
   refusera de nouveau. Ce n'est pas une régression à corriger : c'est le
   dispositif qui fonctionne. La renouveler ne demande aucun nouvel outil,
   seulement de rejouer celui qui existe.

Une réserve a été consignée au même endroit : la même lecture constate — et ne
suppose plus — que `anon` et `authenticated` détiennent toujours `EXECUTE` sur
`nexus_garde_regularisation_reception` en Production. Cette dette se ferme par
un `revoke` nommant les deux rôles, jamais en éditant `20260919103000`.

Enfin, la portée du verdict. `13/13` ne lève que l'axe « ordre migration →
code » du préflight. Il n'autorise ni la fusion, ni l'approbation du
déploiement `github-pages` en attente, qui restent des gestes humains sous GO
distincts.

## 01/10/2026 — une option mal nommée a produit un REFUS crédible

Immédiatement après, en rejouant la garde sur l'état qui allait être commité,
l'appel a été écrit `controler({ candidat, cible })`. L'option s'appelait
`candidate`. Elle a donc été ignorée sans un mot, le candidat est retombé sur
`HEAD`, et la garde a rendu un refus parfaitement crédible : vingt migrations
non qualifiées, chacune nommée, chacune motivée. Rien dans ce refus n'était
faux — il ne portait simplement pas sur la PR jugée. Il n'a été démasqué que
parce que la sortie imprime les refs réellement reçues : `candidat : HEAD`.

La réparation n'est pas de mieux écrire l'appel.

1. **Un appel mal nommé doit être incapable de produire un verdict**, vert ou
   rouge. `controler()` refuse désormais toute clé hors contrat et lève, au
   lieu de compléter les trous par des valeurs par défaut. Un défaut de
   programmation ne doit pas pouvoir s'exprimer dans le vocabulaire des
   verdicts, parce qu'il s'y lit comme un verdict.
2. **Une valeur par défaut est un piège quand elle est plausible.** `HEAD`
   était un repli raisonnable pour un usage en ligne de commande ; c'est ce
   caractère raisonnable qui a rendu le faux refus indétectable à la lecture.
3. **Le vocabulaire doit être d'une seule langue.** Toutes les autres options
   sont françaises — `cible`, `depot`, `qualification`, `maintenant`,
   `heures` ; `candidate` était la seule anglaise. `candidat` est maintenant
   accepté et désigne la même ref ; les deux orthographes en désaccord lèvent,
   la garde ne choisit pas.
4. **Une sortie doit nommer ses entrées.** C'est la seule raison pour laquelle
   ce défaut a été vu plutôt que cru. Toute garde qui résout une ref doit
   imprimer la ref résolue, pas celle qu'on croit lui avoir passée.

Trois épreuves (G1, G2, G3) couvrent ces règles, et chacune a été vérifiée
rouge isolément contre la garde d'avant le correctif — G1 masquait G2, qui
masquait G3, donc les trois ont été mesurées séparément.
