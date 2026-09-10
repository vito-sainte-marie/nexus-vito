# Blocages ouverts — liste pour l'arbitrage `aucun_blocage_non_resolu`

**10/09/2026.** Dernier critère du lot qui ne se mesure pas : il se **déclare**.
Ce document liste ce qui est ouvert et donne mon avis sur la pertinence de
chaque point **pour cette release**. La déclaration reste celle de Frédéric.

Tout ce qui suit a été relevé aujourd'hui en exécutant les gardes, pas de
mémoire.

---

## Ce qui touche DIRECTEMENT la release

### 1 · Cinq branches en rade — **le seul point que je considère bloquant**

`outils/garde-branches-en-rade.js` : **5 branches sur 36** portent du travail
absent de `config-par-environnement` et ne sont classées nulle part.

| branche | commits | objet |
|---|---|---|
| `claude/issue-28-20260909-1054` | 1 | connexion directe échouant sur les runners |
| `claude/issue-28-20260909-1213` | 1 | trousseau exigé malgré une URL fournie |
| `claude/issue-28-20260909-1455` | 1 | même correctif, autre variante |
| `claude/issue-28-20260909-1735` | 3 | publication de `request-6` |
| `claude/issue-28-20260909-2038` | 2 | publication de `request-7` |

**Pourquoi c'est le seul que je qualifie de bloquant.** Le critère
`candidate_immuable_identifiee` désigne un SHA. Si l'une de ces branches porte
un correctif qui devrait être dans la release, **le candidat est incomplet et
personne ne le sait**. Les trois premières traitent du même défaut de trousseau
que j'ai corrigé de mon côté — il est probable qu'elles fassent doublon, mais
« probable » n'est pas « vérifié ».

**Ce qu'il faut :** rapatrier, ou inscrire leur sort dans
`docs/handoff/BRANCHES-CLASSEES.json`. Les deux ferment le point ; l'ignorer ne
le ferme pas.

### 2 · Horaires de Production non corrigés

Le quart 1 finit trente minutes trop tôt en base (12:45 / 13:45 au lieu de
13:15 / 14:15), et le quart 2 à 20:05 / 22:05 au lieu de 20:10 / 22:10. La
correction est écrite et prête
(`outils/correction-horaires-production-a-executer-par-frederic.sql`), **non
appliquée** : écrire dans `station_config` de Production est une opération
Production.

**Mon avis : à appliquer AVANT la release, pas pendant.** Ce n'est pas une
migration, c'est une donnée de configuration. Mélanger les deux dans la même
fenêtre rendrait un incident inattribuable.

---

## Ce qui est ouvert et que je ne considère PAS bloquant pour cette release

### 3 · ARCH-002 — `NexusStock`

Un finding connu du routeur Guardians, **déjà tracé et arbitré non bloquant**
(`CURRENT.md`, `request-7.md`). Rien de nouveau aujourd'hui. Hors du périmètre
des 26 migrations.

### 4 · Guardian Bible — 9 findings sur 625 replis examinés

Des `|| 0` qui fabriquent un zéro là où la valeur est inconnue, dans
`NEXUS-Capital`, `NEXUS-Centre-Intelligence`, `NEXUS-Debug-Createur`,
`NEXUS-Parametres-Station` et `nexus-carburant-demarrage-mois`.

**Aucun de ces fichiers n'est touché par la release.** Ce sont des écrans
manager ou de mise au point, pas le parcours employé. Préexistants, non
aggravés.

### 5 · QA-007 — neuf épreuves inertes

Motifs établis hier, quatre familles, **aucun défaut applicatif**. Deux
concernent le module Réception carburant, qui tourne donc sans épreuve vivante.

**Non bloquant pour cette release** — la Réception n'est pas dans le périmètre
des 26 migrations. Mais c'est une dette de couverture réelle, à traiter après.

### 6 · LANG-003 — 1 481 tirets cadratins

Le plafond tient, aucun ajout aujourd'hui, la garde est bloquante en CI. La
dette de réécriture reste entière, sans effet sur la release.

---

## Ce qui est ouvert et qui n'est pas un blocage, mais une décision en attente

Ces points sont nés de la conception du parcours employé. Aucun n'empêche la
release ; tous attendent un arbitrage.

- **Le placement temporel des 23 missions du pompiste** — 136 missions sur 138
  n'ont pas de `time_window`.
- **Le renfort comme troisième quart** — implémenté côté exécution, mais le
  vocabulaire `matin` / `soir` reste celui de trois tables Inventaire.
- **La transmission au quart suivant** — n'existe dans aucun modèle.
- **Les 17 services restés ouverts** en Production. La migration de reprise les
  clôturera en `clos_sans_pointage`. Ce n'est pas un blocage : c'est
  précisément ce que la release vient traiter, et son impact est chiffré dans
  le rapport de répétition.

---

## FERMÉ le 10/09/2026

**Les cinq branches sont classées au SHA exact**, sur arbitrage Orchestrator
relayé par Frédéric Bragance. `garde-branches-en-rade` rend désormais
« aucune », et son épreuve passe 21/21.

| branche | tête | sort |
|---|---|---|
| `…0909-1054` | `e9262da` | **A_REPRENDRE** → Backlog `ARCH-006` |
| `…0909-1213` | `ad2e4c8` | **INTEGREE** |
| `…0909-1455` | `28bf9d3` | **INTEGREE** |
| `…0909-1735` | `2453d98` | **SUPERSEDEE** |
| `…0909-2038` | `73a8c40` | **INTEGREE** |

Aucune fusion globale : rapatriement sélectif de la commande
`handoff.js rattraper-demande` et de quatre épreuves, toutes exécutées sur le
HEAD canonique. `outils/resoudre-connexion-test.sh` est écarté de cette
release et suivi en `ARCH-006`.

**`aucun_blocage_non_resolu` peut être déclaré OK.** Les points 3 à 6 ci-dessus
restent ouverts, connus, hors périmètre, et n'empêchent rien.

### Ce que ce classement a révélé au passage

La branche `2038` portait une **cinquième épreuve** que ma première comparaison
avait manquée : `test_security_jamais_invoque_si_url_20260909.js`. Elle vérifie
que `security` n'est jamais **invoqué** quand l'URL est fournie — propriété plus
forte que « le script ne plante pas », car un trousseau verrouillé peut demander
une confirmation interactive et bloquer un script qui n'en avait pas besoin.

Ma comparaison du 10/09 ne regardait que les trois branches « trousseau » et
n'avait pas ouvert les deux branches « handoff ». **Une comparaison bornée à ce
qu'on croit chercher manque ce qu'on ne cherchait pas.**

Les points 3 à 6 sont ouverts, connus, hors périmètre, et n'empêchent rien.

**Deux limites à cette liste.** Elle est datée du 10/09/2026 et reflète les
gardes exécutées ce jour. Et elle ne couvre que ce que les gardes savent voir :
un blocage que rien n'instrumente n'y figure pas — c'est une raison de plus pour
que la déclaration finale soit humaine.

---

## ROUVERT le 10/09/2026, en préparant la gate

`aucun_blocage_non_resolu` était déclarable OK ce matin. **Il ne l'est plus.**
Deux défauts sont apparus en mesurant au lieu de déclarer — c'est-à-dire en
faisant exactement ce que la re-mesure finale demandait.

### 7 · La CI n'est pas verte sur le candidat — **cause non isolée**

Le SHA `ea561f6` porte **deux exécutions de la même suite** :

| run | événement | verdict |
|---|---|---|
| 34485844362 | `pull_request` | **success** |
| 34485839396 | `push` | **failure** |

Une seule épreuve sépare les deux : `test_security_jamais_invoque_si_url_20260910.js`,
au premier contrôle — « `reconstruire-base-test.sh` : URL fournie ⇒ security
JAMAIS invoqué ». Le marqueur d'invocation existait, donc `security` a bien été
atteint alors qu'une URL était fournie.

**Observation brute** conservée. **Reproduction : impossible ici.** L'épreuve
passe 7/7 sur macOS, et elle passe sur le run `pull_request` du *même SHA*.
Une occurrence, pas deux.

**Hypothèses examinées.**

- *Le correctif aurait disparu du script* — **écartée** : `security` n'apparaît
  qu'une fois dans `reconstruire-base-test.sh` (ligne 62), sous le garde
  `if [ -n "${NEXUS_TEST_DB_URL:-}" ]`, et la mutation négative de l'épreuve
  démontre qu'un appel inconditionnel serait détecté.
- *Interférence par le fichier partagé `PREPROD-CYCLE.json`* (défaut 8
  ci-dessous) — **écartée par lecture** : le script ne lit jamais ce fichier,
  et rien ne s'exécute entre la ligne 27 et la ligne 59 qui puisse appeler
  `security`.
- *`psql` absent en local, présent sur le runner* — **écartée** : `psql` est
  présent sur les deux, et le seul appel à `security` précède toute connexion.
- *Collision de chemin sur le marqueur* — non écartée, mais le chemin porte
  déjà `Date.now()` et `Math.random()`.

**Cause non isolée.** Je n'écris pas de correctif sur une hypothèse : corriger
sans cause, c'est déplacer le défaut. L'épreuve a été **instrumentée** — son
message d'échec porte désormais le contenu du marqueur, le code de sortie,
`stdout` et `stderr`. Le contrôle lui-même est inchangé : l'instrumentation
n'est pas la correction. La prochaine occurrence dira ce que celle-ci a tu.

**Conséquence pour la gate, et c'est le point qui compte.** Un run `push` rouge
sur le SHA candidat suffit à retirer le vert, même si le run `pull_request` du
même SHA est vert. `ci_et_guardians_conformes` est donc **BLOQUE**, et le
verdict global `NON_PRET`. Ce n'était pas visible tant que le verdict était
raconté plutôt que calculé.

### 8 · La suite corrompt un fichier suivi du dépôt — **démontré, deux fois**

`docs/handoff/PREPROD-CYCLE.json` ressort **modifié** après `node run-tests.js` :
`cycles` est vidé et l'entrée réelle est perdue.

**Reproduit deux fois de suite**, et l'artefact était déjà présent dans l'arbre
de travail avant que je le cherche.

**Cause démontrée.** Six épreuves sauvegardent ce même fichier, le remplacent
par une version vide, lancent un script, puis le restaurent — et le lanceur
exécute les fichiers **en parallèle** (4 en CI, 8 en local). Deux épreuves qui
se chevauchent : la seconde sauvegarde la version *déjà vidée* par la première,
et sa restauration écrase la restauration correcte. La dernière restauration
gagne, et ce n'est pas nécessairement l'originale.

**Non corrigé, volontairement.** Réparer demande de sortir ce fichier de
l'arbre de travail pour les six épreuves — donc de toucher six fichiers et le
chemin qu'un outil partagé lit. Ce n'est pas un geste à poser dans l'heure qui
précède une gate de Production. Le défaut est réel, tracé, et sans effet
démontré sur le défaut 7. **L'arbitrage revient à Frédéric** : corriger avant
la release, ou après.

**Ce que ce défaut coûte aujourd'hui :** un `git status` sale après chaque
exécution de la suite, et le risque de committer un journal PREPROD vidé sans
s'en apercevoir.

### 9 · `zzzzrefdetestinexistante` — **cause démontrée**, après plusieurs jours

Le cycle fantôme `zzzzrefdetestinexistante` faisait échouer le semis CI par
intermittence depuis le 09/09. Il était classé **cause non isolée**. Il ne
l'est plus.

Le run `push` **34488844379** (SHA `b3ebb6e`) le dit mot pour mot :

> La base est en TEST_NORMAL, mais 1 cycle(s) restent ouverts : `zzzzrefdetestinexistante`.
> cycle ouvert : `{"projet_ref":"zzzzrefdetestinexistante","release":"2026.09.0","cree_le":"2026-09-10T14:24:46.914Z","detruit_le":null}`

**Ce n'est pas une référence de projet inconnue. C'est `REF_BIDON`**, la
référence bidon que les épreuves `security` et `credential` passent en
argument aux scripts de répétition pour vérifier qu'ils refusent la Production.

**La chaîne, entièrement démontrée :**

1. l'épreuve lance `repetition-release-complete.sh zzzzrefdetestinexistante` ;
2. le script fait ce qu'il doit faire — il **inscrit un cycle PREPROD** dans
   `docs/handoff/PREPROD-CYCLE.json`, un fichier **suivi par git** ;
3. l'épreuve restaure le fichier dans son `finally`, mais elle n'est pas seule :
   c'est le défaut 8 ci-dessus, six épreuves en parallèle, dernière
   restauration gagnante ;
4. le cycle bidon survit dans le fichier ;
5. **plus tard dans le même job**, l'étape « Semer le scénario Carburants »
   lit ce fichier, trouve un cycle ouvert sur un projet qui n'existe pas, et
   refuse — correctement.

L'horodatage le confirme : cycle créé à **14 h 24 min 46,914 s**, registre
modifié à **14 h 24 min 47,117 s** — pendant l'étape de la suite, deux cents
millisecondes plus tard, bien avant l'étape de semis qui échoue.

**La garde n'est pas en cause : elle a fait exactement son travail.** Elle a
refusé de semer pendant ce qu'elle croyait être une répétition en cours. Le
défaut est que les épreuves écrivent un état de répétition mensonger dans un
fichier du dépôt, et n'arrivent pas toujours à l'effacer.

**Cela explique aussi l'intermittence.** Le cycle ne survit que lorsque deux
épreuves se chevauchent au bon moment — d'où des runs verts entre deux runs
rouges, sans qu'aucun code n'ait changé.

**Cela n'explique PAS le défaut 7** (l'épreuve `security` en échec sur
`ea561f6`) : `reconstruire-base-test.sh` ne lit jamais ce fichier. Deux
symptômes, une même origine probable, une seule cause démontrée. Le défaut 7
reste **cause non isolée**, et son instrumentation reste en place.

### Ce qu'il faut décider — et c'est une décision, pas une correction évidente

Trois voies, aucune neutre :

1. **Un chemin de registre surchargeable par l'environnement**
   (`NEXUS_PREPROD_CYCLE`), pour que les épreuves travaillent sur une copie.
   Simple et propre — mais cela donne à une variable d'environnement le
   pouvoir de rendre aveugles `garde-preprod-ephemere` et
   `garde-mode-environnement`. **C'est un élargissement de surface de
   sécurité, et il vous revient.**
2. **Exécuter en série les épreuves qui touchent ce fichier.** Ne change aucune
   garde, ne surcharge rien. Mais la protection dépend d'une liste qu'une
   épreuve future oubliera.
3. **Que les scripts n'inscrivent aucun cycle pour une référence manifestement
   bidon.** Refuser d'écrire plutôt que d'écrire puis nettoyer. La plus propre,
   la plus intrusive : elle touche un script de release à la veille d'une gate.

**Je n'en ai appliqué aucune.** La première touche une garde de sécurité, la
troisième un script de release — les deux demandent votre arbitrage. La
deuxième est réversible et sans effet sur les gardes ; c'est celle que je
recommande si l'objectif est de débloquer la CI sans rien élargir.

**En attendant, la CI reste rouge sur le candidat, et le verdict NON_PRET.**

### FERMÉ le 10/09/2026 — défauts 8 et 9

**Voie 2 appliquée**, sur arbitrage Orchestrator relayé par Frédéric Bragance
(`request-8`). Les six épreuves qui touchent `PREPROD-CYCLE.json` sont drainées
par une voie unique du lanceur ; le reste de la suite garde son parallélisme.

Aucune garde modifiée, aucun script de release touché, aucune variable
d'environnement introduite — la voie 1 est rejetée pour cette release, la voie
3 différée après la gate.

Preuves : `preuve-serialisation-registre-preprod-1.md`. **9/9** sur l'épreuve
dédiée, dont la restitution octet pour octet du registre y compris après échec
forcé à l'intérieur du `try`, et **8 exécutions consécutives** de la suite
parallèle complète sans un seul échec hors liste, sans registre modifié et sans
cycle bidon résiduel.

**Le défaut 7 reste ouvert, et son libellé est inchangé : cause non isolée.**
Il n'est pas réglé par cette décision.

### 10 · Une seconde intermittence, **cause démontrée**, hors du périmètre arbitré

`test_build_tracabilite_20260905.js` échoue par intermittence en
`ENOENT ... copyfile` — 2 fois sur 4, puis 0 fois sur 8, selon l'ordonnancement.
Ce n'est **pas** le registre PREPROD, et la sérialisation ne l'a jamais touché.

**Cause démontrée**, par échantillonnage de l'arbre de travail toutes les 40 ms
pendant la suite. Deux fichiers apparaissent puis disparaissent à la racine du
dépôt :

> `__fixture_identite_a__.js` · `__fixture_identite_b__.js`

Ils sont écrits par `test_guardians_router_20260907.js`
(lignes 88-89, `path.join(__dirname, …)`), puis supprimés. Or
`test_build_tracabilite` liste les `.js` de la racine qui ne commencent pas par
`test_`, **puis** les copie. Un fichier listé et supprimé entre les deux donne
exactement cet `ENOENT`.

**Même famille que le défaut 9, ressource différente** : une épreuve qui écrit
dans l'arbre de travail fait tomber une autre épreuve. Ici la ressource
partagée n'est pas un fichier précis, c'est **le répertoire racine**.

**Non corrigé — hors du périmètre que vous avez arbitré.** La correction est
contenue (écrire les deux fixtures dans un répertoire temporaire, en passant la
racine explicitement, comme je l'ai fait pour ma propre copie mutée), mais elle
touche une épreuve du routeur Guardians et sort des six épreuves du registre.

**Conséquence à connaître avant la gate :** tant qu'elle n'est pas traitée, la
CI restera **rouge par intermittence**, pour une raison désormais entièrement
comprise et sans rapport avec la release.

### 11 · La recette navigateur ne se connecte plus — **cause non isolée**, et elle touche un secret

Depuis le run **34495731476** (`workflow_dispatch`, `d9225e5`), la recette
échoue au **premier écran** :

> Connexion refusée : toujours sur l'écran de login 30 s après validation.
> Écran : « Prénom ou code PIN incorrect. »

Tout le reste du workflow est passé — suite, Guardians, semis Supabase Test.
Seule la dernière étape tombe.

**Ce qui est établi** (lectures seules sur Supabase **Test**, jamais Production,
et aucune valeur de secret lue) :

| fait | mesure |
|---|---|
| les quatre comptes de recette | présents, `actif = true`, `compte_test = true` |
| bannis, supprimés, non confirmés | **non**, aucun des trois |
| erreur renvoyée par l'API | `400 invalid_credentials` — **pas** une limite de débit |
| dernière connexion réussie de `manager-test` | **10/09 14 h 45 min 44 s** |
| `auth.users.updated_at` après cette connexion | +11 ms — écriture de connexion, **pas** de changement de mot de passe |
| événement d'audit `user_updated_password` | **aucun** dans la fenêtre |
| fichier applicatif d'authentification modifié depuis la recette verte | **aucun** (`nexus-auth.js` et l'app HTML identiques à `8f346c4`) |

**Hypothèses examinées.**

- *Limite de débit après mes nombreux déclenchements* — **écartée** : l'API
  répond `invalid_credentials`, pas `over_request_rate_limit`.
- *Compte désactivé ou supprimé* — **écartée** par mesure.
- *Régression applicative de ma part* — **écartée** : aucun fichier
  d'authentification n'a changé entre la recette verte et maintenant.
- *Changement du mot de passe entre 14 h 45 min 17 s et 14 h 45 min 44 s* —
  **non écartée, et c'est la piste la plus forte.** Deux connexions réussies de
  `manager-test` se suivent à 27 s d'intervalle ; un changement de code entre
  les deux serait ensuite masqué par l'`updated_at` de la seconde connexion.

**Un fait à connaître, et il n'est pas de moi.** Ces deux connexions de
14 h 45 ne viennent ni de la CI ni d'un navigateur ordinaire : leur agent est
`Claude/1.44121.2` sur macOS — **une session Claude pilotant un navigateur sur
cette machine**. Toutes les connexions CI portent `HeadlessChrome` sur Linux.
Une autre session a donc ouvert NEXUS Test en tant que `manager-test` pendant
que ce lot tournait, et c'est la seule activité anormale de la fenêtre.

**Cause non isolée.** Je m'arrête là, et volontairement : la suite touche un
**secret de recette**, et lire, poser ou faire tourner un secret est une gate
humaine. Je n'ai lu aucune valeur — seulement des horodatages, des états de
compte et une empreinte.

**Ce que cela demande, et de vous seul :** vérifier si le code PIN de
`Manager Test` sur Supabase **Test** a été changé vers 14 h 45, et si oui
remettre `NEXUS_TEST_MANAGER_PIN` en accord avec lui. Aucune autre étape du
workflow n'est en cause.

---

## FERMÉ le 10/09/2026 — défaut 10

**Cause déjà démontrée, corrigée et éprouvée.** `guardianSecurity`,
`guardianArchitectureCollisions` et `guardianArchitectureDependances`
(`outils/guardians-router.js`) acceptent désormais un paramètre `racine`
optionnel — défaut inchangé (`RACINE` du dépôt), aucun changement de
comportement en CI. Les quatre fixtures de
`test_guardians_router_20260907.js` vivent maintenant dans des répertoires
`os.tmpdir()`, jamais sous `__dirname` : le fichier qui les créait à la
racine réelle et les supprimait aussitôt — la ressource que
`test_build_tracabilite_20260905.js` liste puis copie — ne la touche plus.

**Preuves** (`test_fixtures_hors_depot_20260910.js`, nouveau) :
- **mutation** : un second PROCESSUS (pas un thread unique — un seul thread
  ne peut jamais entrelacer write/scan/unlink dans cet ordre) qui écrit et
  supprime un `.js` à la racine réelle pendant qu'un balayage
  lister-puis-copier la traite reproduit l'`ENOENT` du défaut, de façon
  indépendante des deux fichiers réels ; la contre-épreuve confirme que sans
  cette écriture, le même balayage ne peut jamais échouer ainsi ;
- **comportemental** : 20 exécutions parallèles complètes (5 rounds × 2
  exemplaires des deux vrais fichiers) — 0 échec, 0 `ENOENT`, 0 fixture
  orpheline, arbre Git rendu exactement dans le même état qu'avant.

Suite complète : aucune régression (les 9 échecs historiques inchangés).

## Défaut 7 — nouvel élément, la cause reste NON ISOLÉE

**Le statut ne change pas : `cause non isolée`.** Trois tentatives de
reproduction du symptôme EXACT (le marqueur `security` existant alors que
`NEXUS_TEST_DB_URL` est fournie) — en standalone répété, en course délibérée
contre les cinq autres épreuves qui touchent `PREPROD-CYCLE.json`, et via
`run-tests.js` lui-même sur plusieurs exécutions complètes — n'ont **jamais**
reproduit ce symptôme précis sur ce runner.

**Ce qui a été trouvé à la place, et qui reste utile.** En cherchant à courir
cette épreuve contre ses cinq soeurs du registre PREPROD, une corruption
accidentelle de `docs/handoff/PREPROD-CYCLE.json` (fichier vidé, 0 octet) a
fait échouer `test_security_jamais_invoque_si_url_20260910.js` de façon
**parfaitement déterministe** — mais avec un `e.message` différent
(`Unexpected end of JSON input`, une `SyntaxError` de `JSON.parse` dans le
harnais du test lui-même, pas le refus métier attendu).

**Le vrai défaut trouvé, mécanique et corrigé** : `run-tests.js` ne
rapportait, pour tout échec, qu'UNE ligne tronquée à 110 caractères — le
premier `✗ …` de la sortie, QUEL QU'EN SOIT LE MOTIF. Un `AssertionError`
métier (« security a été invoqué ») et une `SyntaxError` sans rapport
produisent tous deux une sortie qui commence par la même ligne `✗ nom du
test` : le lecteur ne pouvait pas les distinguer depuis le log CI seul.
L'instrumentation posée le 10/09/2026 sur ce test précis (marqueur, code de
sortie, stdout, stderr) n'atteignait donc **jamais** le log CI — seule cette
ligne tronquée y arrivait. C'est très probablement ce qui a empêché
d'isoler la cause exacte du run `34485839396` : l'information existait dans
le process enfant, mais `run-tests.js` ne la faisait jamais remonter.

**Corrigé, sans toucher à un seul garde ni script de release :**
`run-tests.js` affiche désormais la sortie complète (bornée à 4000
caractères) de chaque échec, en plus de la ligne courte. Les deux fichiers
`test_security_jamais_invoque_si_url_2026090{9,10}.js` impriment désormais
`e.name` avant `e.message`, pour que `SyntaxError`/`TypeError`/… restent
visibles même sans race — vérifié : rejouer la même corruption affiche
maintenant `SyntaxError: Unexpected end of JSON input` dans la ligne courte
ELLE-MÊME (le motif `[A-Za-z]*Error` de `run-tests.js` la capture
directement), plus le détail complet en dessous.

**Ce que cela ne prouve PAS** : que le défaut 7 original avait cette même
cause. Le symptôme reproduit ici (`SyntaxError`) diffère du symptôme
rapporté (`security` réellement invoqué). Les deux restent possibles :
soit le rapport `34485839396` était lui-même cette même ambiguïté mal lue,
soit un défaut distinct, toujours réel, reste à isoler.

**Prochain discriminant mesurable, si le défaut revient** : le prochain échec
de cette famille en CI portera désormais, dans le log lui-même, soit
`AssertionError: security a été invoqué alors que…` (le vrai défaut, à
corriger alors avec la preuve enfin en main), soit `SyntaxError: Unexpected
end of JSON input` ou toute autre exception nommée (un défaut d'une autre
famille, déjà connue). Le statut `cause non isolée` reste donc EXACTEMENT
ce qu'il était — seul l'outil pour la voir la prochaine fois a changé.

## Défaut 11 — inchangé

Statut **`BLOCKED_HUMAN_SECRET`** confirmé, inchangé. Aucune lecture,
rotation ni exécution de secret n'a eu lieu dans cette session. L'action
minimale demandée à Frédéric reste exactement celle du 10/09/2026
ci-dessus : vérifier si le PIN de `Manager Test` a changé vers 14 h 45 et,
si oui, réaligner `NEXUS_TEST_MANAGER_PIN`.

---

## FERMÉ le 10/09/2026 — défaut 11

**Preuve directe, lue via `gh run view` (jamais un secret, jamais un PIN).**
Le run `34498775844` porte deux tentatives sur le commit `4f26a372` :

| tentative | événement | verdict | étape en cause |
|---|---|---|---|
| 1 | `push` | `failure` | `Recette navigateur NEXUS Test` |
| 2 | `push` | **`success`** | — toutes les étapes, y compris la recette |

La tentative 2 est verte de bout en bout : semis Supabase Test, publication
NEXUS Live, Playwright, et **la recette navigateur elle-même**, qui inclut la
connexion `Manager Test` mise en cause par le défaut 11. Entre la tentative 1
et la 2, aucun code n'a changé — seule la relance diffère, cohérent avec
l'hypothèse retenue le 10/09 (PIN réaligné entre-temps par Frédéric).

**Le diff entre ce commit et le candidat courant ne touche rien à
l'authentification.** `git diff --stat 4f26a37 ddb007f` ne montre que deux
fichiers Handoff (`request-8.md`, `decision-8.md`) — zéro fichier applicatif,
zéro configuration Test. Le run vert de `4f26a37` est donc une preuve directe
et transposable au candidat : rien dans ce que le candidat ajoute ne peut
avoir réintroduit le défaut.

**Défaut 11 fermé.** Aucun secret n'a été lu pour arriver à cette conclusion —
seuls des verdicts de run et un diff de fichiers l'ont établie.

---

## OUVERT le 10/09/2026 — défaut 12, sur le candidat lui-même

**La CI du candidat `ddb007f` (l'actuel HEAD canonique) échoue, sur les deux
événements.** Lu via `gh run view` :

| run | événement | verdict | étape en cause |
|---|---|---|---|
| `34501548868` | `pull_request` | `failure` | `Suite de non-régression et verdict` |
| `34501543499` | `push` | `failure` | `Suite de non-régression et verdict` |

Le journal de l'étape (récupéré par `gh run view --log-failed`, jamais par
navigateur) montre `test_handoff_v2_20260905.js` classé **régression** :

```
AssertionError [ERR_ASSERTION]: le refus doit nommer sa raison : AVERTISSEMENT — lots/CARBURANTS-PERFORM…
```

C'est l'épreuve « une décision déjà consommée ne se rejoue pas » : elle
mute pour de vrai `docs/handoff/STATE.json`, relance
`node outils/handoff.js consommer <lot déjà consommé>` en sous-processus, et
attend le message `déjà marquée consommée`. Le sous-processus a bien échoué
(le premier `assert` passe), mais avec un AUTRE message — la sortie récupérée
commence par les avertissements normaux de `verifier()`, donc le
sous-processus a bien démarré et progressé, mais s'est arrêté ailleurs que
prévu.

**Non reproduit localement.** Rejoué `node test_handoff_v2_20260905.js` seul
(vert), puis `node run-tests.js` complet **neuf fois de suite** dans cette
session — huit fois vert, une fois un échec de `test_fixtures_hors_depot_20260910.js`
(une régression *différente*, propre à sa propre course interne — voir
ci-dessous), jamais celui-ci. Le journal ancien ne peut pas être approfondi :
la version de `run-tests.js` qui a produit ce run ne portait pas encore
l'instrumentation « sortie complète » fermée au défaut 10 ci-dessus — seule
la ligne tronquée à 110 caractères a été conservée par GitHub, et elle est
déjà entièrement au dossier.

**Hypothèses écartées ou non retenues, par lecture, pas par exécution :**
- *Un autre test réécrit `docs/handoff/STATE.json` en parallèle* — aucun
  autre fichier `test_*.js` de la suite n'écrit ce fichier réel hors d'un
  répertoire temporaire `NEXUS_HANDOFF_DIR` (vérifié par recherche exhaustive
  sur les cinq fichiers qui nomment `handoff.js`).
- *Une variable d'environnement `NEXUS_HANDOFF_DIR` fuirait vers ce
  sous-processus* — le sous-processus hérite de `process.env`, mais aucun
  step de `.github/workflows/tests.yml` ne positionne cette variable.
- *Le lot choisi par le test diffère entre le candidat et ce qui a été
  rejoué ici* — vérifié faux : `git show ddb007f:docs/handoff/STATE.json`
  désigne le même lot (`HANDOFF-V2-EVENEMENTIEL-20260905`, commit `e76713f`)
  que celui obtenu localement.

**Cause non isolée.** Comme pour le défaut 7, je n'écris pas de correctif sur
une hypothèse. L'instrumentation `run-tests.js` livrée pour le défaut 7
(sortie complète bornée à 4000 caractères sur tout échec) couvre aussi
celui-ci sans modification supplémentaire : le PROCHAIN échec de ce test en
CI portera son message réel dans le log, pas seulement cette ligne tronquée.

**Conséquence pour la gate, inchangée dans son sens :** `ci_et_guardians_conformes`
reste **BLOQUE** — pas à cause du défaut 7 (toujours non reproduit), mais
maintenant aussi à cause de ce défaut 12, constaté deux fois sur le candidat
lui-même. Le verdict global reste **NON_PRET**.

## Note — défaut 10, une seconde course trouvée DANS sa propre épreuve, corrigée

Sur les neuf premières exécutions complètes de `node run-tests.js` de cette
session, **une** a rapporté `test_fixtures_hors_depot_20260910.js` lui-même
en échec — pas `test_guardians_router` ni `test_build_tracabilite`, l'épreuve
qui les couvre. Avec l'instrumentation « sortie complète » du défaut 7
(livrée le 10/09, intégrée dans ce même lot), le message exact est apparu :

```
ÉCHEC — zéro fichier fixture orphelin à la racine après coup (__fixture_race_repro_20260910__.js)
```

**Cause démontrée, propre à l'épreuve, sans rapport avec le mécanisme
qu'elle prouve.** Le bloc (1) de mutation lance un second PROCESSUS qui
écrit/efface `__fixture_race_repro_20260910__.js` en boucle, puis appelle
`ecrivain.kill()` et nettoie **immédiatement** — `kill()` envoie un signal,
il ne garantit pas un arrêt instantané. Une dernière itération du processus
écrivain pouvait encore écrire le fichier **après** le nettoyage du parent,
le laissant orphelin pour le reste du fichier de test (bloc 2, `executionsParalleles`),
qui le détecte alors comme régression — sur son propre artefact, jamais sur
ceux des deux vrais fichiers qu'il surveille.

**Corrigé** : `mutationRepro` attend désormais l'événement `exit` du
processus écrivain avant de nettoyer (`await finEcrivain`), au lieu de
nettoyer sur la foi d'un `kill()` qui vient d'être envoyé. Cinq exécutions
de la suite complète après ce correctif : cinq fois vert, y compris
`test_fixtures_hors_depot_20260910.js`.

---

## FERMÉ le 10/09/2026 — défaut 12

**Preuve directe, lue via `gh run list`/`gh run view` sur le candidat exact
`e6c7948`, jamais un secret.** Le SHA porte deux exécutions :

| run | événement | verdict |
|---|---|---|
| `34508020759` | `pull_request` | `success` |
| `34508015447` | `push` | `failure` (voir défaut 13 ci-dessous — un autre point) |

Le défaut 12 nommait précisément `test_handoff_v2_20260905.js`, dans l'étape
« Suite de non-régression et verdict ». Cette étape est **au vert dans les
deux runs**, `pull_request` et `push` — y compris l'étape « Protocole Handoff
v2 » (dédiée, distincte). Le défaut spécifique décrit par §12 (le refus
d'une décision déjà consommée qui ne nomme pas sa raison) **ne s'est
reproduit dans aucun des deux événements** sur le candidat lui-même.

**Défaut 12 fermé sur cette base : cause toujours non isolée, mais non
reproduite sur le candidat, sur les deux événements CI qui l'exercent.**
Aucun secret lu pour arriver à cette conclusion — uniquement des verdicts de
run et la liste de leurs étapes.

**Ce que cette fermeture NE dit PAS.** Le run `push` du même SHA a échoué —
pas sur `test_handoff_v2_20260905.js`, sur une étape entièrement différente.
Fermer §12 ne rend donc PAS la CI verte sur le candidat : voir défaut 13,
ouvert dans la foulée de cette même vérification.

## Défaut 7 — un nouveau point de non-reproduction, statut inchangé

Même méthode, même prudence : les deux runs du candidat `e6c7948` exercent
aussi `test_security_jamais_invoque_si_url_20260910.js` (dans la même étape
« Suite de non-régression et verdict »), et il est vert dans les deux. C'est
un point de non-reproduction de plus, pas une preuve d'absence — le défaut a
déjà une histoire de reproduction majoritairement verte (voir plus haut :
7/7 puis instrumentation, puis 8/9 exécutions locales). Je ne ferme pas §7
sur cette seule base : la cause n'est toujours pas isolée, et ce mandat
demande explicitement de ne pas corriger par analogie. **§7 reste ouvert,
statut inchangé : `cause non isolée`.**

## OUVERT le 10/09/2026 — défaut 13, la CI n'est PAS verte sur le candidat

**Constat qui corrige une lecture incomplète du run cité dans le réveil.**
Le run `pull_request` (`34508020759`) sur `e6c7948` est bien vert de bout en
bout, mais **son étape « Recette navigateur NEXUS Test » est `skipped`**,
comme pour tout `pull_request` de ce workflow (aucun accès Test/secret n'y
est exposé, par conception). Il ne dit donc rien de l'état réel de la
connexion navigateur.

Le run `push` du **même SHA** (`34508015447`, seul run `push` connecté
existant sur ce candidat) a lui réellement exécuté la chaîne connectée
complète, jusqu'à son terme :

| étape | verdict |
|---|---|
| … (46 étapes précédentes, dont « Suite de non-régression et verdict », « Protocole Handoff v2 », les sept Guardians, la garde PREPROD, la répétition Carburants) | `success` |
| Préparer la connexion PostgreSQL Test en écriture | `success` |
| Semer le scénario Carburants sur Supabase Test | `success` |
| Publier le journal NEXUS Live | `success` |
| Installer Playwright | `success` |
| **Recette navigateur NEXUS Test** | **`failure`** |

Log lu par `gh run view --log --job` (aucun secret, `PGPASSWORD`/PINs
masqués par GitHub Actions comme toujours) :

```
Version servie confirmée : e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9
ÉCHEC de la recette navigateur : Connexion refusée : toujours sur l'écran de
login 30 s après validation. Identifiant inconnu, secret de recette périmé,
ou compte désactivé.
  Écran : […] Prénom ou code PIN incorrect. […]
```

**Symptôme identique au défaut 11, sur le même point d'entrée** :
`outils/recette-navigateur-test.js` tente `NEXUS_TEST_MANAGER_NOM` en
premier — c'est ce compte qui échoue en premier, comme le 10/09 au matin.
Le défaut 11 avait été fermé sur la preuve d'un run `push` vert de bout en
bout (`34498775844`, commit `4f26a37`, 15 h 55) ; ce run `push`
(`34508015447`, commit `e6c7948`, 17 h 24) rouvre exactement le même
symptôme, **une heure et demie plus tard**, sur le candidat lui-même.

**Aucun run `push` plus récent sur `config-par-environnement` n'existe pour
contredire ce constat** (revérifié dans cette session : `gh run list
--branch config-par-environnement --limit 10` ne montre aucune exécution
postérieure à `34508015447`/`34508020759`). Un run plus récent
(`34509760412`, 17 h 41) est vert, mais sur une branche
`claude/issue-28-20260910-1727` distincte, **avec la chaîne connectée
entière `skipped`** (elle ne s'exécute que sur `config-par-environnement`) —
il ne prouve rien sur la recette.

**Isolation demandée du 10/09 19 h 15 — quatre causes candidates, trois
écartées par des faits, pas par supposition :**

1. **Disponibilité du secret dans le runner — ÉCARTÉE.**
   `outils/recette-navigateur-test.js` (`secretsManquants`, appelée en tête
   d'`executer()`) court-circuite *avant* toute tentative de connexion si
   `NEXUS_TEST_MANAGER_PIN` (ou tout autre secret de `SECRETS_REQUIS`) est
   absent ou vide côté runner, avec un message distinct et non bloquant :
   « Recette navigateur Test non exécutée — absents du runner : … »
   (dégradation ENV-003). Le log du run `34508015447` ne montre PAS ce
   message : il montre un login Playwright réellement tenté, un écran
   observé après 30 s, puis le refus applicatif. La valeur était donc
   **présente et non vide** dans ce runner — sans qu'aucune valeur n'ait été
   lue pour l'établir, seul le chemin de code emprunté le prouve.

2. **Défaut de la fixture/recette (script) — ÉCARTÉE.**
   `git diff 4f26a3723b77…e6c7948769c8…` (dernier run `push` connecté vert,
   15 h 55, contre le candidat, 17 h 24) sur `outils/recette-navigateur-test.js`,
   `nexus-auth.js`, `NEXUS-App-v1.html` et tout `supabase/` : **zéro
   différence**. Le script qui a réussi à 15 h 55 est exactement, au
   caractère près, celui qui échoue à 17 h 24. Un script inchangé qui réussit
   puis échoue sur le même chemin de code n'est pas un défaut du script — un
   état externe (côté Supabase Test) a changé entre les deux.

3. **Défaut applicatif (écran de connexion, `nexus-auth.js`) — ÉCARTÉE par
   le même diff.** Le même argument s'applique : aucun fichier applicatif
   touchant l'authentification n'a changé entre le dernier succès et cet
   échec. Une régression de code ne peut pas expliquer un écart de
   comportement sans changement de code.

4. **Compte Manager Test / PIN sur Supabase Test — SEULE CAUSE RESTANTE,
   NON CONFIRMÉE SANS LECTURE DE SECRET.** Par élimination des trois autres,
   et par similarité exacte avec le défaut 11 (même symptôme, même point
   d'entrée, même mécanisme de résolution déjà observé : une relance sans
   aucun changement de code a suffi après réalignement humain du PIN), la
   cause la plus probable reste un désaccord entre `NEXUS_TEST_MANAGER_PIN`
   (secret GitHub) et le code PIN réellement actif pour `Manager Test` sur
   Supabase Auth **Test**. Confirmer ce point demanderait de lire ou de faire
   rejouer une valeur de secret — gate humaine, non franchie ici.

**Cause non isolée au sens strict (aucune preuve positive du mécanisme
exact), mais réduite par élimination factuelle à une seule cause candidate
plausible.** Je ne corrige rien par analogie : aucun changement de code n'est
proposé, parce qu'aucun défaut de code n'a été trouvé — au contraire, le
code est démontré inchangé et innocent.

**Conséquence directe et mesurée pour la gate — recalculée, pas racontée** :

```
node outils/evaluer-pret-pour-production.js --sha e6c7948769c8e1aa6a2690d1c6e5b782f56f7ea9
  CI       : pull_request:success · push:failure
  ✗ BLOQUE   ci_et_guardians_conformes
  VERDICT               : NON_PRET
  autorisation           : NON_AUTORISEE
  run(s) en échec sur le candidat : push 34508015447
```

`ci_et_guardians_conformes` reste **BLOQUE** sur le candidat courant — pas
pour la raison énoncée dans le réveil précédent (§7/§12, désormais non
reproduits sur ce SHA), mais pour ce défaut 13, constaté par une lecture
directe de la seconde exécution du même SHA. **Le verdict global reste
`NON_PRET`.**

**Ce que cela demande, et de Frédéric seul** : la même action que pour le
défaut 11 — vérifier si le code PIN de `Manager Test` sur Supabase Test a de
nouveau changé vers 17 h 24, et si oui réaligner `NEXUS_TEST_MANAGER_PIN`
avec lui. Rien d'autre dans la chaîne connectée n'est en cause : les 46
étapes qui précèdent (y compris le semis et la publication du journal Live)
sont vertes. Ce n'est pas une décision de fondateur : c'est une opération de
recette Test déjà pré-autorisée (§1 des pré-autorisations, `CLAUDE.md`) —
transmise ici comme blocage externe précis, pas comme arbitrage métier.

---

## FERMÉ le 10/09/2026, pour de bon — défaut 11

**Preuve directe, cette fois complète.** Run `34523206197`
(`workflow_dispatch`, candidat `b7cbe95`), **toutes les étapes vertes** :

```
success  Suite de non-régression et verdict
success  Guardian QA
success  Semer le scénario Carburants sur Supabase Test
success  Publier le journal NEXUS Live
success  Installer Playwright
success  Recette navigateur NEXUS Test
```

La recette est allée jusqu'au bout, connexion `Manager Test` comprise :

> · UI Carburants (CARB-004) : satisfaite
> · Accès Live REFUSÉ au manager · ACCORDÉ au Créateur : satisfaites
> · Prise de poste employé : satisfaite
> · Invitation à l'inventaire sur l'accueil : satisfaite
> · Prise de poste avec un quart DÉJÀ OUVERT : satisfaite
> · Pointage d'arrivée : sans objet — arrivée déjà pointée aujourd'hui

**Cause confirmée a posteriori** : le code de `Manager Test` et le secret
`NEXUS_TEST_MANAGER_PIN` avaient divergé. Frédéric Bragance les a réalignés le
10/09 à 19 h 53 UTC — l'empreinte du secret stocké est passée de `cc676729…` à
`a8ef4c27…`, écriture vérifiée sans jamais lire la valeur. La connexion, qui
échouait depuis 15 h 28, repasse au premier essai suivant.

**La fermeture du 15 h 55 était prématurée** : elle reposait sur une seule
relance verte, et le défaut est revenu à 17 h 24. Celle-ci repose sur un run
complet APRÈS le geste qui explique la cause. Ce n'est pas la même chose.

## ROUVERT le 10/09/2026 — défaut 10, par l'épreuve qui devait le fermer

`test_build_tracabilite_20260905.js` échoue de nouveau en `ENOENT ... copyfile`,
et le nom du fichier manquant dit tout :

```
copyfile '/home/runner/work/nexus-vito/nexus-vito/__fixture_race_repro_20260910__.js'
```

**Cause démontrée.** `test_fixtures_hors_depot_20260910.js` — l'épreuve écrite
pour prouver le défaut 10 — lance un second processus qui écrit et efface
`__fixture_race_repro_20260910__.js` **dans la racine du dépôt**, en boucle
serrée, pendant toute la durée de la reproduction. Or `test_build_tracabilite`
liste les `.js` de cette même racine puis les copie. Les deux tournent en
parallèle : le fichier est listé, puis effacé avant d'être copié.

**L'épreuve qui devait fermer le défaut le REPRODUIT contre les autres.** Elle
prouve la course en la déclenchant pour de vrai, sur la ressource partagée
réelle, au lieu de la déclencher dans un bac à sable.

**Correction proposée, non appliquée** — le fichier appartient à un autre
canal : faire écrire le processus écrivain dans un répertoire temporaire, et
faire balayer `listerPuisCopier` ce même répertoire. Le mécanisme prouvé reste
identique — `readdir` puis `copyFile` contre `write` puis `unlink` — mais plus
aucune autre épreuve n'est atteinte.

**C'est le seul point qui garde la CI rouge sur le candidat.** Le run `push`
`34522377670` échoue là-dessus ; le `workflow_dispatch` relancé passe. La
différence entre les deux n'est pas le code, c'est l'ordonnancement.
