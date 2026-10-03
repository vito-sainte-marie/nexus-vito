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

### Quand une mesure périme

`mesure.le` est obligatoire, lisible et non future (`MESURE_SANS_DATE`,
`MESURE_DANS_LE_FUTUR`). `mesure.cible` est obligatoire : une mesure prise sur
Test ne qualifie pas Production.

Depuis le 03/10/2026, une mesure ne périme plus à l'horloge. Jusque-là, elle
tombait au bout de 72 h. Elle porte désormais `mesure.blob_migration`,
l'empreinte Git du fichier de migration qu'elle a qualifié
(`git rev-parse <ref>:<chemin>`). La garde la compare au même fichier dans le
candidat :

- empreinte absente ou abrégée → `MESURE_SANS_PERIMETRE` ;
- empreinte du candidat incalculable → `PERIMETRE_INCALCULABLE` ;
- fichier différent → `MESURE_HORS_PERIMETRE`.

Une preuve reste acquise tant qu'aucun changement n'affecte ce qu'elle
vérifie. L'horloge faisait tomber l'axe le 04/10/2026 alors que rien n'avait
bougé.

**Ce que la garde ne voit pas.** Une base modifiée sans que le dépôt bouge.
L'horloge ne la voyait pas non plus : elle refusait au hasard du calendrier,
pas à la dérive. Le 03/10/2026, une relecture a trouvé le revoke
`20261001160000` déjà effectif en Production, alors que la mesure du 01/10
disait « trou confirmé ». Cette dérive est rattrapée par la relecture que
chaque procédure d'application fait avant d'écrire, pas par cette garde.

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
   l'objet manquant ; la mesure vieillie à 73 h → `MESURE_PERIMEE` (refus retiré le 03/10/2026, remplacé par l'empreinte du fichier : une migration retouchée → `MESURE_HORS_PERIMETRE`) ; la source
   passée de `catalogue` à `registre` → `MESURE_NON_RECEVABLE`. Un vert
   obtenu sans contre-témoin ne distingue pas une garde satisfaite d'une garde
   débranchée.
3. **Une mesure est une observation datée, pas une propriété de la base.** La
   qualification cesse de qualifier le 04/10/2026 à 15 h 01 UTC, et la garde
   refusera de nouveau. Ce n'est pas une régression à corriger : c'est le
   dispositif qui fonctionne. La renouveler ne demande aucun nouvel outil,
   seulement de rejouer celui qui existe.
   *Addendum du 03/10/2026 : cette échéance est levée. La qualification
   dure désormais tant que le fichier de migration ne change pas (voir « Quand
   une mesure périme »).*

Une réserve a été consignée au même endroit : la même lecture constate — et ne
suppose plus — que `anon` et `authenticated` détiennent toujours `EXECUTE` sur
`nexus_garde_regularisation_reception` en Production. Cette dette se ferme par
un `revoke` nommant les deux rôles, jamais en éditant `20260919103000`.

*Addendum du 03/10/2026 : une relecture seule à 20 h 59 UTC constate l'ACL
fermée (`{postgres=X/postgres,service_role=X/postgres}`), alors que
l'estampille `20261001160000` est absente du registre (280 lignes) : le revoke
a été appliqué hors bande. L'inscrire au registre est une écriture Production,
soumise au GO de Frédéric.*

*Addendum du 03/10/2026, 21 h 10 UTC : l'estampille `20261001160000` est
inscrite au registre sur GO de Frédéric (`version` et `name` seuls,
`statements` NULL comme les lignes hors bande voisines) ; registre 280 → 281.
Aucun effet sur l'ACL, déjà fermée.*

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

## 01/10/2026 — un `revoke` qui n'a jamais mordu, et la garde qui le dira désormais

La lecture Production du 01/10 rendait `MIGRATION_APPLIQUEE — 13/13`. Dans la
même rubrique, elle rendait l'ACL de la fonction de garde :
`{postgres=X,anon=X,authenticated=X,service_role=X}` — alors que la migration
`20260919103000` contient `revoke all on function … from public;`.

Le dépôt a écrit l'intention de fermer. La base dit que rien ne s'est fermé.

**1. `revoke … from public` ne ferme ni `anon` ni `authenticated`.** Supabase
accorde `EXECUTE` par `ALTER DEFAULT PRIVILEGES … TO anon, authenticated,
service_role` : ce sont des **grants nommés**, pas l'entrée pseudo-rôle
`PUBLIC`. Retirer à `public` retire quelque chose qui n'a jamais été donné là.
C'est la **quatrième** occurrence. La leçon était déjà écrite en prose dans
`20260916210000` — « apres trois occurrences du meme motif ». Elle était sous
les yeux de qui a écrit la quatrième. **Une leçon qu'aucune machine ne mesure
n'est pas une leçon, c'est un souvenir.**

**2. La proportion se dit avant le remède, pas après.** L'exposition pratique
fermée ici est **nulle** : la fonction est `returns trigger`, un appel direct
échoue à la compilation, et PostgreSQL ne consulte pas `EXECUTE` quand un
trigger se déclenche. Ce qui est réel, c'est la **divergence entre ce que le
dépôt affirme et ce que la base fait** — et une intention écrite qui n'agit pas
est pire qu'une intention absente, parce qu'elle se relit comme une protection.

**3. Le discriminant doit trancher dans les deux sens.** Avant le revoke, un
appel direct par `authenticated` échoue sur `trigger functions can only be
called as triggers` : le contrôle d'ACL a donc été **passé**, preuve que le rôle
détenait bien `EXECUTE`. Après, il échoue sur `permission denied for function`.
Sans cette paire, « ça refuse dans les deux cas » se lirait « rien n'a changé ».
Mesuré sur banc `supabase/postgres:17.6.1.175`, ACL reproduite octet pour octet,
chaque objet du banc vérifié **un par un** — au premier essai la fonction avait
disparu entre deux fenêtres, et la répétition exerçait la branche « absente » en
croyant exercer l'autre.

**4. Le défaut à réparer n'est pas le grant, c'est le silence.** 28 fonctions du
dépôt portent un `revoke` ; **18 ne nomment ni `anon` ni `authenticated`**, dont
11 nomment `public` et un seul des deux rôles. Les fermer en bloc serait faux :
`mes_ecarts_caisse()` est une RPC appelée par un écran connecté,
`authenticated` **doit** la garder. `outils/garde-revoke-fonction-roles-nommes.js`
exige donc que l'intention soit **dite** — rôle nommé dans le `revoke`, ou
marque `-- nexus-acl-intention: … garde <rôle> (motif)`. Un motif vide est un
refus. La garde BLOQUE à partir de `20261001000000` et **gèle la dette à 18**,
comparée **dans les deux sens** : une dette qui diminue en silence est aussi
invisible qu'une dette qui grandit.

**5. Un état de qualification peut être vrai par absence de matière.** Un
`revoke` ne crée aucun objet. `migration_deja_appliquee` passait donc en
annonçant « 0 objet(s) constaté(s) un par un » : le seul contrôle de cet état
est un constat objet par objet, et sur un ensemble vide il ne peut rien
démentir. `additive_compatible_avant_code` passait pour la même raison — rien à
trouver. **Un vert obtenu par absence n'est pas un vert.** Corrigé :
`DEJA_APPLIQUEE_SANS_OBJET_MESURABLE`, et la fiche est qualifiée
`atomique_ou_procedure_speciale`, le seul état qui exerce ici un contrôle réel
(`fs.existsSync` sur la procédure).

Le trou du point 5 n'a pas été trouvé en relisant la garde : il a été trouvé en
la **mutant**. Quatre mutations sur cinq étaient attrapées ; la cinquième ne
l'était pas. Dix épreuves (R1–R10) couvrent la nouvelle garde, l'épreuve E5
couvre le correctif, et chacune a été vérifiée rouge isolément contre la version
d'avant. Une prédiction s'est révélée fausse en chemin — une mutation rougissait
R1 et non R2 — et c'est noté plutôt que corrigé après coup.

L'application du revoke à Production reste le geste de Frédéric.

### Note de méthode — un `| tail` fait mentir le code de sortie

En vérifiant les deux gardes de ce lot, j'ai écrit qu'`garde-ordre-migration-code.js`
« rend 0 sur un REFUS » — ce qui aurait été un défaut grave, une garde qui refuse
sans rien arrêter. C'était faux. La commande était
`node garde.js 2>&1 | tail -40; echo $?` : en shell, `$?` après un pipe rend le
code du **dernier** élément, c'est-à-dire celui de `tail`, toujours 0. Mesurée
sans pipe, la garde rend bien 1.

C'est la **troisième** fois dans ce chantier qu'un pipe rend un chiffre
plausible et faux (un `| wc -l` avait rendu « 0 » sur une panne DNS au lieu de
la signaler). La règle : **le code de sortie d'une garde se mesure sans pipe**,
en redirigeant vers un fichier, ou avec `PIPESTATUS`. Une garde « vérifiée
câblée » à travers un pipe n'est pas vérifiée.

#### Correctif du même jour — le remède proposé était lui aussi faux

Quelques minutes après avoir écrit la règle ci-dessus, je l'ai appliquée pour
mesurer un `git push` : `… | sed …` puis `echo "${PIPESTATUS[0]}"`. Résultat
affiché : **rien**. Le shell de cet hôte est `zsh`, où les tableaux sont indexés
à partir de 1 et où la variable s'appelle `pipestatus` ; `${PIPESTATUS[0]}` n'y
désigne aucun élément et rend la chaîne vide. Mesuré des deux côtés :

| shell | `false \| true` puis… | rend |
|---|---|---|
| zsh | `${PIPESTATUS[0]}` | *(vide)* |
| zsh | `${pipestatus[1]}` | `1` |
| bash | `${PIPESTATUS[0]}` | `1` |

Une chaîne vide dans un `echo` ne ressemble pas à une erreur : elle ressemble à
un champ non renseigné. C'est le même piège que celui que la note dénonçait,
d'un cran plus bas — **la quatrième occurrence**, et cette fois dans le remède
lui-même.

Donc la règle, resserrée : **rediriger vers un fichier et lire `$?` sur une
commande sans pipe.** C'est la seule forme qui ne dépend ni du shell, ni de
l'indexation d'un tableau, ni de la mémoire de celui qui relit. `PIPESTATUS`
reste correct sous `bash -c '…'` explicite, et nulle part ailleurs ici.

Ce qu'il faut en retenir au-delà du shell : **un dispositif de mesure se mesure
aussi.** J'ai proposé un instrument de contrôle sans le vérifier sur l'hôte où
il devait servir — exactement le reproche que ce chantier fait aux gardes qui
passent à vide.

### Le même jour, un troisième cran — la garde refusait sans rien arrêter

Le fichier `outils/revoke-garde-regularisation-production-a-executer-par-frederic.sql`
a reçu une garde de précondition : si la fonction visée est absente de la base,
elle lève une exception plutôt que d'afficher un `notice` qui se lit comme un
succès. Écrite, elle paraissait suffisante. Répétée sur banc, elle ne l'était pas.

Mesure du 01/10/2026, base sans la fonction, client lancé **sans
`ON_ERROR_STOP`** — c'est-à-dire dans les conditions de l'éditeur SQL de
Supabase, qui n'est pas `psql` :

| ce qu'on attendait | ce qui s'est produit |
| --- | --- |
| le script s'arrête | le script **continue** jusqu'à la fin |
| l'erreur est le dernier mot | l'`ARRET` défile hors de l'écran |
| les sections suivantes ne tournent pas | elles tournent et affichent des tableaux **vides** |
| code de sortie non nul | code de sortie **0** |

Les trois dernières lignes visibles étaient trois tableaux à `(0 rows)` et un
`DO` tranquille. **Un refus invisible n'est pas un refus.** C'est exactement le
reproche que ce chantier adresse aux gardes qui passent à vide, cette fois dans
le dispositif censé l'empêcher.

**1. Une garde ne doit pas dépendre du client qui la lance.** `ON_ERROR_STOP`
aurait corrigé le symptôme, mais c'est une option de `psql`. Le fichier est
destiné à un éditeur web. Ce qui tient quel que soit le client est tenu par le
serveur : le fichier est désormais une **transaction unique**, et toute exception
annule l'intégralité du passage.

**2. Afficher un verdict et engager un verdict sont deux actes différents.** La
section 3 imprimait `FERME` dans un tableau. Un tableau se lit avec les yeux et
s'oublie. Une section 5 a été ajoutée : elle relit l'ACL et le trigger, et
**refuse de confirmer la transaction** si l'état n'est pas exactement celui
attendu. Trois mutations l'ont vérifiée — revoke redevenu `from public`, trigger
désactivé, `service_role` privé d'`EXECUTE` — et les trois finissent sur
`ROLLBACK` avec l'ACL inchangée. Une garde qui n'a jamais refusé n'est pas une
garde.

**3. Accéder au registre des migrations pouvait faire échouer la garde sur la
mauvaise question.** `supabase_migrations.schema_migrations` n'existe pas
partout. Sans précaution, le bloc échouait sur « relation does not exist » : un
message qui parle du registre alors que la question porte sur la fonction. Le
test passe par `to_regclass`, et une base sans registre affiche désormais
« registre de migrations absent » puis continue, parce que la précondition
réelle est la présence de la fonction, pas celle de l'estampille.

**4. L'exposition fermée est bien nulle, et c'est maintenant mesuré.** Après le
revoke, sur banc : l'appel direct par `authenticated` est refusé
(`permission denied for function`), le **trigger mord toujours** sur une
régularisation sans relevé, et une insertion légitime passe. PostgreSQL ne
vérifie pas `EXECUTE` quand un trigger se déclenche. Le revoke est donc une
affaire d'hygiène et de cohérence dépôt/base, pas une urgence — affirmation déjà
écrite plus haut, désormais adossée à trois observations plutôt qu'à un
raisonnement.

**5. Un banc qu'on démonte est un banc qu'il faut remonter.** J'avais détruit le
conteneur de répétition en clôturant le lot, puis modifié le fichier sans le
rejouer. Les trois défauts ci-dessus étaient tous invisibles à la lecture. Le
coût d'un banc est de deux minutes ; le coût d'un refus muet appliqué à
Production ne se mesure pas à l'avance.

### Le même jour, l'épilogue — le `revoke` a été appliqué, et c'est un rapport, pas ma mesure

Le 01/10/2026 vers 16 h 48 UTC, Frédéric a appliqué le `revoke` directement sur
Supabase Production `uzhjpqpctpvxytxpxoqz` et en a publié le compte rendu depuis
son compte, en commentaire de l'issue #28 (identifiant `5936147053`). Les deux
états qu'il rapporte :

| | ACL de `public.nexus_garde_regularisation_reception()` |
| --- | --- |
| avant | `postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres` |
| après | `postgres=X/postgres,service_role=X/postgres` |

L'état d'après est **exactement** ce que la section 5 du script exige : ni `anon=`
ni `authenticated=` dans l'ACL, `service_role=X` et `postgres=X` conservés,
trigger `trg_garde_regularisation_reception` toujours `tgenabled='O'`. Le compte
rendu ajoute « transaction terminée sans exception », ce qui est la description
juste du `begin; … commit;` installé le même jour.

**1. Un détail faux de mon côté authentifie le rapport.** Le compte rendu situe
le trigger sur `carburant_reception_visites`. Mon banc jetable, lui, avait
utilisé `carburant_receptions` — un nom que j'avais inventé pour la répétition.
La migration `20260919103000` tranche à ses lignes 143-146 : la vraie table est
`carburant_reception_visites`. Le rapport est donc exact sur un point où je me
trompais, ce qu'un compte rendu recopié depuis mes propres écrits n'aurait pas pu
être.

**2. Ce n'est pas pour autant une mesure.** Je n'ai aucun chemin de lecture vers
Production, et je ne dois pas en chercher. Ce qui est consigné ici est donc une
**observation datée, rapportée par un humain** — pas une propriété constatée par
l'outillage. Elle se convertit en mesure pour un coût nul : le script est
idempotent, et le rejouer sur une base déjà fermée repasse par la section 2 sans
rien changer, puis par la section 5 qui relit l'ACL et affiche le même
`VERDICT ENGAGEANT`. Une seconde exécution ne prouve pas plus que la première,
mais elle fait exister la preuve dans le dossier.

**3. L'effet est en Production, l'estampille n'y est pas.** La migration
`supabase/migrations/20261001160000_revoque_garde_regularisation_reception_anon_authenticated.sql`
porte désormais une intention déjà réalisée sur la cible, sans figurer au
registre `supabase_migrations.schema_migrations`. C'est la classe de divergence
déjà connue — un changement appliqué hors bande. Elle est ici **sans
conséquence**, et il faut le dire précisément plutôt que de s'en inquiéter : le
corps de cette migration est un `if exists … revoke all … from anon,
authenticated`, strictement idempotent. Quand elle passera par le chemin normal,
elle ne fera rien et dira qu'elle n'a rien fait. Ce qui reste vrai, en revanche,
c'est que `origin/production` compte toujours 277 estampilles et que la garde
d'ordre continuera, légitimement, à présenter `20261001160000` comme nouvelle.

**4. Le champ `reserve` de la fiche `20260919103000` n'est pas corrigé.** Il dit
que la dette est « désormais CONSTATEE en Production ». C'était vrai à la date de
la mesure, et une fiche de qualification est un relevé daté : la réécrire
effacerait l'observation au lieu de la prolonger. Rien ne lit ce champ — les
occurrences de `reserve` dans le dépôt désignent un `validated_with_reserve`
d'inventaire, sans rapport. C'est ce paragraphe-ci qui porte la suite.

### Et le run rouge du même soir n'était pas une panne

Le run Claude `36894784954`, déclenché à 16 h 48 UTC par ce même commentaire,
s'est terminé en `failure` au bout de **onze secondes**. Ce n'est pas un run qui
a échoué, c'est un run qui n'a pas commencé :

```
##[error]Aucun rail NEXUS désigné dans le déclencheur. Ajoutez NEXUS_BASE_BRANCH=<branche>
         au commentaire. Aucun repli n'est appliqué : un rail se désigne, il ne se devine pas.
...
Refus publié sur #28.
```

**5. Le même mécanisme a dit oui trois heures plus tôt.** Le commentaire
`5933837032`, du 01/10 à 14 h 45 UTC, portait `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
et le réveil a répondu en vingt-deux secondes. Celui de 16 h 48 ne le portait
pas et a été refusé. Deux issues opposées, le même jour, pour le même workflow,
selon la seule présence de la désignation : c'est la démonstration la plus nette
que le dispositif de refus du 26/09 fonctionne. Le défaut n'est pas dans le rail,
il est dans le déclencheur — et un futur lecteur qui verrait ce rouge comme une
régression à réparer casserait une garde qui fait son travail.

## 01/10/2026 — « code promu d'abord, migration ensuite » n'a été exécuté qu'à moitié

La fusion de la PR #65, le 01/10 à 13 h 49 UTC, a mis la connexion Production
hors service. Le symptôme terrain était « Connexion au serveur impossible », ce
qui désigne un réseau. Ce n'était pas le réseau.

### Ce que la mesure dit

`origin/production` est à `adee9bbcb6fd7e0af7632730ede185e655d04580`. Son
parent `2bc7b39dd73a` portait **276** migrations ; `adee9bb` en porte **277**.
La seule migration que la fusion a transportée est celle du lot
`20260919103000`, déjà appliquée. **La fusion de #65 n'a transporté aucune
migration du login.**

Or l'artefact servi à Production appelle, ligne 146 de `NEXUS-Login-v1.html`,
la fonction `public.nexus_identifiant_de_connexion(p_prenom)`. La lecture
datée du catalogue Production — prise le 01/10 à 15 h 01 UTC avec l'identité
`nexus_prod_readonly_login` — ne la trouve pas. Le front appelle une fonction
qui n'existe pas sur sa cible.

### Pourquoi personne n'a été averti

Trois causes, et elles s'additionnent.

**L'ordre était écrit, pas outillé.** La migration
`20260904175747_login_non_enumerable.sql` dit elle-même, dans son en-tête :
« Les deux vont ensemble, dans cet ordre : code promu, puis migration
appliquée. » La phrase est exacte. Elle était dans un commentaire. Rien ne
mesurait qu'on l'avait suivie, et la seconde moitié n'a pas eu lieu.

**La migration n'était pas dans le lot.** Elle vit sur le rail, pas sur la
branche de #65. Une PR qui promeut du code appelant une RPC absente de sa
cible était, jusqu'à aujourd'hui, un état parfaitement vert.

**La porte était restée ouverte « provisoirement ».** La migration
antérieure `20260904105148` écrit : « On ne conserve QUE le SELECT, dont
l'écran de connexion a besoin — provisoirement… ». Ce provisoire a duré
**27 jours**, et c'est lui qui a permis à l'écran de fonctionner sans la
fonction jusqu'au 01/10. Autrement dit : la panne n'est pas apparue quand la
dépendance a été créée, mais quand le palliatif a été retiré. Un provisoire
sans date d'expiration est une panne différée.

### Le cas qui aurait dû bloquer ce déploiement

`outils/garde-rpc-front-definie-sur-la-cible.js`, exercée sur les références
réelles — `--candidat adee9bb --cible 2bc7b39` — rend **un BLOCK,
`RPC_FRONT_REFUS`, code de sortie 1**. Le contre-témoin sur le rail rend
`RPC_FRONT_CONFORME`, code 0. La garde existait donc déjà, et la question
n'était pas de l'écrire mais de la **placer avant le build** : c'est l'objet
du correctif `docs/deploiement/cablage-garde-rpc-production.patch`, mesuré par
`test_cablage_garde_rpc_production_20261001.js`.

Ce correctif voyage comme un **patch** et non comme une édition, parce que
`.github/workflows/deploiement-production.yml` n'existe **que sur
`origin/production`** : il est absent du rail, comme tout `.github/deploiement/`.
Une épreuve mesure le patch ; elle ne peut pas mesurer un fichier qui n'est pas
là.

### Le point aveugle, nommé

`extraireObjets()`, dans `outils/garde-ordre-migration-code.js`, ne voit ni
`revoke` ni `alter view`. Deux instructions décisives de la migration du login
lui sont donc invisibles :

```sql
revoke select on public.employees_public from anon;
alter view public.employees_public set (security_invoker = true);
```

Conséquence à écrire noir sur blanc : la garde **serait incapable de refuser
l'ordre inverse**. Élargir `extraireObjets()` est un travail distinct, pas
encore fait.

Autre mesure du même genre : **aucun fichier du front, sur `adee9bb`, ne nomme
`employees_public`**. La vue n'est plus lue par l'écran ; seule la RPC l'est.
Le `revoke` ne casse donc rien côté écran — et c'est ce qui rend le correctif
petit.

### Deux leçons du banc, qui dépassent ce lot

Le banc jetable (`supabase/postgres:17.6.1.175`, sept passages, 01/10) a
démenti deux choses que je croyais acquises.

**Une garde qui lit le texte de l'ACL est verte pour la mauvaise raison.**
`\ddp` sur ce moteur montre, pour le schéma `public` et le propriétaire
`postgres`, des default privileges `function → postgres=X, anon=X,
authenticated=X, service_role=X`. Une fonction créée dans `public` porte donc
`anon=X` **avant tout `grant`**. Chercher `anon=X` dans `proacl` reste vert
même quand les deux `grant execute` ont disparu — c'est la mutation M5 du
banc, et elle **passe**. La seule lecture saine est
`has_function_privilege(role, signature, 'EXECUTE')`. Même famille que le
`revoke … from public` qui ne ferme pas `anon` : à chaque fois, c'est **le rôle
nommé** qu'il faut interroger.

**Un `raise exception` n'arrête pas un fichier `.sql`, et `psql` sort 0.** Le
refus défile hors de l'écran et le code de sortie ment. La transaction protège
la base — elle est la seule garde indépendante du client — mais elle ne rend
pas le refus visible. D'où une relecture terminale placée **après le `commit;`**,
qui imprime `ETAT_FINAL …` en dernière ligne dans tous les cas. Le code de
sortie est une observation, pas une garantie du fichier.

### Ce qui rend une recette possible sans aucun compte

L'écran de connexion déployé distingue deux échecs par deux messages
différents, et c'est une chance :

| ce qui s'affiche | ce que ça prouve |
| --- | --- |
| « Connexion au serveur impossible… » | l'appel RPC a échoué — la fonction manque |
| « Prénom ou code PIN incorrect. » | l'appel RPC a **répondu** — la fonction est là |

Un prénom volontairement inexistant et n'importe quoi en guise de code suffisent
donc à discriminer AVANT et APRÈS, **sans toucher un compte réel et sans saisir
un PIN réel**. C'est la recette de
`docs/deploiement/procedure-migration-login-production.md`, §7.

### Ce qui reste ouvert, et ce n'est pas un oubli

`authenticated` garde le SELECT sur `employees_public` : la porte est
rétrécie, pas condamnée — largement neutralisée par `security_invoker = true`,
mais pas fermée. L'énumération n'est que **partiellement** close : on supprime
la possibilité de *lister*, pas celle de *confirmer* un prénom deviné. Le
remplacement durable — Edge Function, limitation de tentatives atomique,
verrouillage de compte, réponse et délai homogènes — est un **lot séparé**.

Enfin, l'estampille `20260904175747` ne sera **pas** posée au registre par cet
artefact. Production portera donc l'effet sans la trace : une divergence
**nommée**, exactement du même genre que celle de `20261001160000`. Une
divergence nommée n'est pas une dérive.

La fiche de qualification de `20260904175747` est **préparée et non insérée**,
dans la procédure, avec ses champs de mesure vides. Le `_lecture` du fichier de
qualification l'interdit en toutes lettres, et un rapport d'absence transmis par
un tiers est une donnée, pas une `mesure`. Elle ira **sous la clé
`20260904175747` dans `migrations`** — **jamais en éditant `20260919103000`**.

## 01/10/2026 — une instruction de documentation prescrivait une variable que personne n'avait définie

La procédure de remise en service du login (`procedure-migration-login-production.md`, §4)
disait de jouer l'artefact ainsi :

```bash
psql "$URL_PRODUCTION" -v ON_ERROR_STOP=1 -f outils/migration-login-production-a-executer-par-frederic.sql
```

`$URL_PRODUCTION` n'a jamais été défini nulle part dans ce dépôt. `psql` a reçu une chaîne
vide — ce qui **ne lève aucune erreur de variable manquante**, un paramètre d'environnement
absent se développant simplement en rien — et s'est rabattu sur ses paramètres de connexion par
défaut, rendant un message de refus qui ne nommait ni la variable en cause ni la cible visée.
L'artefact SQL, lui, n'était pour rien dans cet échec : six contrôles de précondition, une
transaction unique, une relecture terminale hors transaction — rien de tout cela n'a été
sollicité, puisque la connexion elle-même n'a jamais eu de quoi aboutir.

**Ce n'est pas une négligence isolée, c'est la même famille de défaut que celle déjà consignée
plus haut dans ce fichier pour le `revoke` de régularisation réception du même jour : « un
script qui implémente une phrase de documentation n'a mesuré personne ».** Ici, la phrase de
documentation n'implémentait même pas un script — elle était la commande elle-même, recopiée
dans un terminal, sans qu'aucun outil n'ait jamais vérifié que la variable qu'elle nommait
existait.

### La règle

**Toute migration Production se joue désormais par un véhicule qui mesure avant d'écrire, et
qui refuse plutôt que de deviner — jamais par une invocation `psql` brute recopiée dans la
documentation.** Un véhicule conforme à cette règle :

1. ne fait AUCUNE écriture par défaut — l'écriture exige un opt-in explicite (`--appliquer`) ;
2. mesure, avant toute possibilité d'écriture, la cible (référence de projet), l'identité
   connectée, et sa capacité réelle à écrire (`transaction_read_only`, `pg_is_in_recovery()`,
   le privilège requis) — et refuse si l'une de ces mesures ne correspond pas à ce qui est
   attendu ;
3. décide son code de sortie sur le **texte** du verdict final que l'artefact écrit
   lui-même, jamais sur le code de sortie de `psql`, qui vaut 0 même sur un refus sans
   `-v ON_ERROR_STOP=1` (leçon déjà écrite plus haut dans ce fichier, à propos du login
   lui-même) ;
4. ne recrée ni ne réécrit l'artefact SQL canonique qu'il joue ;
5. est éprouvé par des épreuves déterministes hors Production — secret absent, cible erronée,
   rôle en lecture seule, artefact absent, refus/rollback malgré un client sorti en 0, nominal
   simulé — jouées contre des leurres et des connexions mortes, jamais contre une vraie base.

Premier véhicule conforme : `outils/appliquer-migration-login-production-a-executer-par-frederic.sh`,
éprouvé par `test_vehicule_migration_login_production_20261001.js`. Il réutilise le contrat déjà
établi par `outils/lecture-apres-migration-20260919103000.sh` pour la résolution du secret
(trousseau macOS, distinction URL / mot de passe, composition explicite de l'URL) plutôt que
d'en inventer un second.

### Ce qu'une mutation réelle a trouvé pendant l'écriture de ce véhicule

Une première version appelait `psql` pour jouer l'artefact sous `set -e` sans précaution : si
`psql` sortait en échec sans qu'aucune ligne `ETAT_FINAL` ne soit reconnue, l'affectation
`SORTIE=$(…)` faisait terminer le script immédiatement avec le code de sortie **brut** de la
tuyauterie `psql | sed` — qui pouvait, par coïncidence, recouvrir un code déjà attribué par
ailleurs dans ce même véhicule (ici, `2`, identique à `PSQL_INTROUVABLE`). Une épreuve qui
simule un tel échec (`psql` sorti en 2, aucune transcription) l'a trouvé en exigeant le code
`33` (« aucun `ETAT_FINAL` reconnu, jamais un succès ») et en obtenant `2`. Corrigé en isolant
cette seule commande entre `set +e` / `set -e`, pour que le véhicule reste maître de son propre
code de sortie même quand son client sort en échec. **Une garde qui n'a jamais été mise en
situation d'échec n'a pas prouvé qu'elle refuse pour la bonne raison** — même règle que celle
déjà tirée plus haut dans ce fichier à propos des mutations sur `garde-ordre-migration-code.js`
et `garde-revoke-fonction-roles-nommes.js`.
