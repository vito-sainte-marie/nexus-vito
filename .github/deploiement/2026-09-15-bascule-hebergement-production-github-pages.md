# Bascule de l'hébergement Production — branche → GitHub Actions

**Rédigé le 15/09/2026. Rien n'est engagé : ce document décrit une procédure,
il ne l'exécute pas.** Aucun réglage GitHub Pages n'a été modifié, aucun DNS
touché, `ea57d4b` n'est pas fusionné.

Ce lot est **autonome**. Il ne contient ni `ea57d4b`, ni les deux migrations
différées, ni le lot de projection, ni `2c1550f`, et n'en dépend pas.

---

## 0. Phase 1 de `Procedure_Production_NEXUS_v2` — état point par point

La procédure v2 est adoptée comme cible du rail Production. Ce document ne
traite que sa **Phase 1** (§13). Aucune évolution métier n'y est mêlée.

| # | Ce que demande la Phase 1 | État | Preuve |
|---|---|---|---|
| 1 | corriger le workflow `067a293…` | **fait** | commit `04738f1` |
| 2 | dossier public dédié, en mode construit | **fait** | `.github/deploiement/composer-artefact-public.js`, 861 → 540 |
| 3 | actions Pages en version officielle **courante**, épinglées par SHA | **fait** | §6 — v5.0.0 / v6.0.0 / v5.0.1 |
| 4 | construire l'artefact et l'éprouver **sans le servir** | **fait** | §5 (garde) et §7 (empreinte) |
| 5 | installer le workflow seul | **plan** — exige fusion, puis GO | étape 1 du §4 |
| 6 | basculer Pages vers Actions | **plan** — exige GO | étape 3 du §4 |
| 7 | vérifier le domaine, garder le retour à la branche | **mesuré** | §2bis |

La procédure v2 exige qu'un artefact promu porte six champs : SHA source
complet, SHA-256 de l'artefact, environnement ciblé, liste exacte des
migrations, identifiant de build, provenance. Le §7 dit où chacun est produit
et pourquoi il est écrit **hors** de l'arbre qu'il mesure.

**Les trois objectifs à 30 jours** — hotfix en moins de 4 h, release normale
en moins de 48 h, moins de 5 minutes d'arbitrage humain par déploiement — ne
sont pas des intentions : chacun se mesure sur les horodatages d'exécution
GitHub. Ce lot les sert par un point précis : l'arbitrage humain par
déploiement devient la lecture d'**une seule ligne** — l'empreinte promue
face à l'empreinte éprouvée — au lieu d'une inspection d'arbre.

---

## 1. Le point de départ, mesuré

`https://app.nexusconseil.net` est servi par **GitHub Pages en mode
« Deploy from a branch »**, sur `production`, racine, **sans build**.

| preuve | résultat |
|---|---|
| en-tête HTTP | `server: GitHub.com` |
| `CNAME` dans `origin/production` | `app.nexusconseil.net` |
| `sha256(nexus-auth.js servi)` vs le fichier de branche | **identiques** |
| workflows présents | `tests.yml` seul, un job `non-regression`, zéro déploiement |

Conséquence tenue pour acquise : la branche candidate exige un build, donc la
fusionner en l'état afficherait « Configuration absente » sur tous les écrans.
**Ce lot fournit le build qui manque, et rien d'autre.**

---

## 2. Pourquoi la bascule ne coupe rien

Deux raisons, et il faut les deux.

**a. L'artefact publié est identique à ce qui est servi.** Le workflow déduit
son mode de l'arbre : tant que `outils/build.sh` est absent de `production` —
c'est le cas aujourd'hui — il publie l'arbre **tel quel**.
`actions/upload-pages-artifact` v4+ exclut par défaut **tout chemin commençant
par un point**, `.git` et `.github` compris — exactement les ensembles que
Pages n'expose pas non plus en mode branche. L'ensemble publié est donc le
même, fichier pour fichier.

**Ce mode est temporaire et réservé à la première bascule.** Il n'existe que
pour cette étape-ci : changer le mécanisme (branche → Actions) sans changer
le contenu, afin qu'une éventuelle régression soit attribuable à une seule
cause. Il n'a pas besoin d'être retiré — il **s'éteint de lui-même** le jour
où `outils/build.sh` atteint `production` (étape 4), le test de présence
basculant alors en mode `construit`.

**En mode `construit`, l'arbre n'est plus publié : un artefact public dédié
est composé.** `.github/deploiement/composer-artefact-public.js` écrit `_site`, d'où sont
retirés `.git`, `.github`, `docs/`, `supabase/`, `outils/`, `simulations/`,
`node_modules/`, les dossiers `migrations*`, ainsi que — à toute profondeur —
les fichiers de test, `run-tests.js`, les `*.md`, `*.sql`, `*.ts`, `*.py`,
`*.sh`, les métadonnées npm et tout chemin caché. C'est `_site`, et lui seul,
qui est emballé. Mesuré sur le candidat construit : **861 fichiers → 540**,
dont **65 écrans sur 65 conservés, aucun perdu**.

La liste est une liste d'**exclusion**, pas d'inclusion, et le choix est
délibéré : une liste d'inclusion oubliée casse un écran en Production sans
prévenir ; une liste d'exclusion oubliée publie un fichier de trop, ce qui se
corrige. Ce n'est donc pas la liste qui fait preuve — c'est la règle R (§5).

**b. Pages ne remplace le site qu'une fois le nouvel artefact prêt.** Le
basculement est un échange de version, pas une reconstruction sur place :
l'ancienne version reste servie jusqu'à ce que la nouvelle soit complète. Il
n'existe pas de fenêtre où le site est vide.

Le domaine personnalisé ne bouge pas. Relevé le 15/09/2026 sur
`GET /repos/vito-sainte-marie/nexus-vito/pages` :

```
build_type  : legacy
source      : { branch: production, path: / }
cname       : app.nexusconseil.net
https       : certificat approuvé, expire le 13/12/2026, https_enforced
custom_404  : false
```

**Le domaine vit dans le réglage du dépôt, pas dans le fichier `CNAME`.**
C'est ce qui rend la bascule sûre : changer `build_type` ne touche ni `cname`,
ni le certificat, ni le DNS. **Aucun changement DNS n'est nécessaire, et aucun
n'est prévu.**

### L'écart de contenu, mesuré puis refermé

Le mode branche passe l'arbre par Jekyll ; le mode Actions ne le fait pas.
L'effet a d'abord été mesuré comme portant sur **deux entrées** — `.gitignore`
et `supabase/.gitkeep`, que Jekyll masque et qu'Actions exposerait.

**Cet écart n'existe plus.** Il tenait à `upload-pages-artifact` **v3**, qui
n'excluait que `.git` et `.github`. Depuis la **v4.0.0**, l'action écarte
d'office tout chemin commençant par un point : `.gitignore` et
`supabase/.gitkeep` en font partie. Le lot épingle la **v5.0.0**, qui conserve
ce comportement. L'ensemble servi après bascule est donc identique à celui
d'aujourd'hui **sans écart résiduel** — ni `.nojekyll`, ni exclusion à
ajouter. Vérification faite par la garde : elle annonce désormais les entrées
hors artefact plutôt que de les passer sous silence.

---

## 2bis. La réversibilité, mesurée sur la totalité du site

« Réversible » ne se raisonne pas, se mesure. La question posée est la
suivante : **le retour à « Deploy from a branch » restitue-t-il exactement ce
qui est servi aujourd'hui ?** Il ne le fait que si ce qui est servi aujourd'hui
*est* la branche, octet pour octet — sinon le retour arrière restaurerait un
site que personne n'a jamais vu.

La réponse n'a pas été échantillonnée : **les 998 fichiers non cachés de
`origin/production` ont été téléchargés depuis `https://app.nexusconseil.net`
et confrontés un à un** au contenu de la branche
(`d5a8b77d80513283c5621c04fae33f397b3956c0`), le 15/09/2026.

| verdict | fichiers |
|---|---|
| sha256 servi == sha256 de la branche | **997** |
| écart | **1** — `CNAME`, servi en 404 |

`CNAME` n'est pas une exception gênante : Pages le **consomme** comme
configuration et ne l'a jamais servi. C'est la seule différence sur 998
fichiers, et elle est documentée chez l'éditeur.

**Ce que cela établit, et rien de plus :**

1. Le site servi aujourd'hui **est** la branche. Aucune transformation Jekyll
   n'altère quoi que ce soit : ni les `.md` (servis bruts, donc sans
   en-tête YAML nulle part), ni les `.sql`, ni les `test_*.js`.
2. Aucun chemin commençant par un point n'est servi — vérifié directement :
   `/.gitignore` → 404, `/.github/workflows/tests.yml` → 404. Le périmètre
   qu'écarte `upload-pages-artifact` v4+ est **déjà** celui que Pages n'expose
   pas. L'égalité annoncée au §2 est donc mesurée, pas déduite.
3. Le retour arrière ne dépend d'aucun commit : **l'artefact Actions n'écrit
   jamais dans la branche.** `production` reste à `d5a8b77d…` quoi qu'il
   arrive, et repasser `build_type` en `legacy` restitue ces 997 fichiers
   identiques sans reconstruction ni fusion.

### Le geste de retour arrière, en entier

> **Corrigé le 15/09/2026, après la bascule.** Ce paragraphe annonçait « un
> seul geste ». **C'est faux**, et la bascule l'a démontré : le relecteur
> requis de l'environnement `github-pages` garde **aussi** le rail *legacy*
> `pages build and deployment`, et pas seulement le rail Actions. Constaté en
> conditions réelles : après la fusion de la PR #44, deux déploiements se sont
> présentés **tous deux en attente d'approbation humaine**, l'un émis par
> l'application `github-pages` (legacy), l'autre par `github-actions`. Un
> changement de source *ne republie donc pas tout seul* : il ouvre une
> demande d'approbation de plus.

Le retour arrière est en **trois** gestes, dans cet ordre :

1. **Remettre la source** — Settings → Pages → Build and deployment →
   Source : `Deploy from a branch` → branche `production`, dossier
   `/ (root)`.
2. **Approuver la reconstruction *legacy*** que ce changement déclenche. Elle
   s'arrête devant l'environnement `github-pages` exactement comme le rail
   Actions. **Tant qu'elle n'est pas approuvée, le site continue de servir
   l'artefact Actions** : le retour arrière n'est pas acquis à l'étape 1.
3. **Vérifier le retour au contenu précédent** — le site répond 200, et la
   confrontation du §2bis retrouve ses 997 fichiers identiques à la branche,
   `CNAME` étant repassé de 200 à 404.

Ce qui reste vrai : ni DNS, ni certificat, ni `git revert`, ni réglage à
défaire ailleurs — la bascule du 15/09 a mesuré qu'elle ne change **que**
`build_type` (le domaine `app.nexusconseil.net`, `https_enforced` et le
certificat sont sortis inchangés). Et s'il faut empêcher toute republication
par le rail Actions, il n'y a rien à désarmer : il suffit de **ne pas
approuver** le déploiement suivant — la gate est une approbation, pas un
interrupteur laissé en position (§3bis).

**Conséquence sur le chronométrage.** La cible « hotfix en moins de quatre
heures » suppose un retour arrière disponible ; celui-ci exige désormais **une
présence humaine pour approuver**, pas seulement pour cliquer un réglage. Le
délai de retour est donc borné par le temps de réponse d'un relecteur, et non
par la propagation de Pages. À énoncer dans toute astreinte.

### La seule différence attendue après bascule

En mode Actions, `CNAME` n'est plus consommé : il fait partie de l'arbre
emballé et **deviendra probablement servable** (404 → 200). Son contenu est le
nom de domaine affiché dans la barre d'adresse : il n'expose rien. C'est le
seul écart connu entre « avant » et « après », il est énoncé ici pour qu'il ne
soit pas découvert comme une régression au contrôle de l'étape 3.

### Un écart de plate-forme, à connaître avant de comparer des empreintes

`origin/production` contient **deux chemins qui ne diffèrent que par la
casse** — `assets/icons/icon-nexus-tempo.PNG` et `…/icon-nexus-tempo.png` —
pointant sur le **même blob** (`eb33c8f6…`). Les deux sont servis, avec le même
contenu.

Sur macOS, insensible à la casse, un seul des deux existe sur disque : une
mesure locale voit **998** fichiers. Sur le runner Linux, les deux existent :
l'artefact en portera **999**, et son empreinte sera donc **différente de la
mesure locale**. Ce n'est pas une dérive de l'outil, c'est une propriété de
l'arbre. **L'empreinte faisant foi est celle relevée dans l'exécution**, jamais
une mesure de poste. Résorber le doublon est une modification du contenu de
`production` : hors du périmètre de ce lot, et signalé plutôt que fait.

---

## 3. Ce que seul Frédéric peut faire, dans GitHub

Aucune de ces trois actions n'est exécutable depuis un workflow ni depuis un
dépôt : elles vivent dans les réglages, pas dans le code. **Aucune n'a été
appliquée** — elles sont énoncées ici pour être faites à la main, au moment
que dit le §4.

1. **Settings → Secrets and variables → Actions → Secrets**, créer :
   - `NEXUS_SUPABASE_URL` = `https://uzhjpqpctpvxytxpxoqz.supabase.co`
   - `NEXUS_SUPABASE_ANON_KEY` = la clé **publiable** de Production
     (`anon` / `sb_publishable_…`). **Jamais la clé de service.**
2. **Settings → Environments → `github-pages`**, trois réglages ensemble :
   - **Required reviewers** → **Frédéric**. C'est la gate.
   - **Prevent self-review** → **laissé décoché**. Frédéric est seul
     mainteneur : exiger un second approbateur rendrait tout déploiement
     impossible, donc ferait démonter la gate à la première urgence.
   - **Deployment branches** → *Selected branches* → **`production`** seule.
     Un second verrou, indépendant de la condition écrite dans le workflow.
3. **Settings → Pages → Build and deployment → Source : `GitHub Actions`** —
   **à l'étape 3 de la procédure ci-dessous, pas avant.**

**Il n'y a aucune variable d'Actions à créer.** Le dépôt n'en contient aucune
aujourd'hui, et le workflow n'en lit aucune : voir le §3bis, qui explique
pourquoi l'ancien cran de sûreté `NEXUS_DEPLOIEMENT_ARME` a été retiré du
projet plutôt que posé.

---

## 3bis. La gate est une approbation, pas une variable

La version précédente de ce plan posait une variable de dépôt,
`NEXUS_DEPLOIEMENT_ARME`, et subordonnait le job `deployer` à `== 'oui'`. Le
défaut n'est pas qu'elle protégeait mal le jour de la bascule : ce jour-là elle
protégeait très bien. Le défaut est qu'elle **ne protège qu'une fois**.

Passée à `oui` pour le déploiement du 15/09, elle y reste. Le lendemain, et
tous les jours suivants, chaque push sur `production` part en Production sans
que personne n'ait plus rien décidé. Le geste humain a eu lieu une fois et
autorise indéfiniment. **Une gate qu'on arme s'oublie armée ; une gate qu'on
approuve se redemande à chaque fois.**

Elle est donc retirée de la condition du job. La seule gate est désormais
l'**approbation de l'environnement `github-pages`**, redemandée à chaque
exécution et jamais persistante. Le workflow ne lit `vars.*` nulle part — ni
dans une condition, ni dans une étape, ni dans une expression — et la variable
n'a jamais été créée dans ce dépôt : il n'y a rien à retirer côté GitHub, et
aucun chemin ne subsiste par lequel la seule présence d'une valeur persistante
autoriserait un déploiement futur.

Tant que l'approbation n'est pas donnée, le workflow construit, éprouve, mesure
et emballe l'artefact **comme pièce à conviction — et ne déploie rien.** C'est
exactement ce que faisait le cran de sûreté, sans l'inconvénient de rester
armé.

### Ce qui n'est pas demandé, et pourquoi

- **Aucune approbation obligatoire de pull request.** Frédéric est seul
  mainteneur : une PR exigeant l'approbation d'un tiers ne serait jamais
  fusionnable. Une règle impossible à respecter finit désactivée, et emporte
  avec elle celles qui marchaient.
- **`require_last_push_approval` reste désactivé**, pour la même raison : il
  interdit à l'auteur du dernier push d'approuver, c'est-à-dire à la seule
  personne présente.

### Ce qui est proposé, à appliquer plus tard

| réglage | où | valeur proposée | pourquoi |
|---|---|---|---|
| résolution obligatoire des conversations | ruleset « Production — gate humaine NEXUS » (id `22486272`) | **activée** | une remarque en revue ne peut plus être fusionnée sans avoir été close ; c'est la seule exigence de revue qu'un mainteneur unique puisse honorer |
| `github-pages` → Required reviewers | environnement | **Frédéric** | la gate de déploiement |
| `github-pages` → Prevent self-review | environnement | **désactivé** | sans quoi la gate est un blocage, pas une gate |
| `github-pages` → Deployment branches | environnement | **`production`** seule | second verrou hors du code |
| approbation de PR obligatoire | ruleset | **non demandée** | impossible à un seul mainteneur |
| `require_last_push_approval` | ruleset | **non activé** | idem |

**Aucun de ces réglages n'a été appliqué.** Ce tableau est une proposition ;
son exécution demande une décision distincte.

---

## 4. La procédure, dans l'ordre

Chaque étape est réversible, et le dit.

### Étape 0 — poser les secrets et l'environnement
Actions 1 et 2 du §3. Aucune variable à créer.
*Effet sur le site : aucun.* *Retour arrière : supprimer les entrées.*

### Étape 1 — fusionner ce lot dans `production`
Par pull request : `production` est protégée, `non-regression` est requis.
Le lot ajoute **sept fichiers, tous sous `.github/`** — le workflow, et sous
`.github/deploiement/` la garde et son épreuve, le composeur, l'empreinte et
son épreuve, le présent plan — et ne modifie que `.github/workflows/tests.yml`
et `.gitignore`.

**Aucun fichier du périmètre publiable n'est ajouté, retiré ni modifié.** Ce
n'est pas une intention, c'est une mesure : l'inventaire `(mode, blob, chemin)`
des **999** fichiers non cachés de `origin/production` et celui de l'état
fusionné sont **identiques**, même sha256
(`6270e7ddd53a1a5502bbb07fbc65c9fe64c1e5c13c67ee4e5273fc3377336028`). Des neuf
chemins touchés, **zéro** a un segment ne commençant pas par un point.

C'est la raison d'être de `.github/deploiement/`, et elle est plus solide que
la seule règle du point : `upload-pages-artifact` passe `--exclude=.git
--exclude=.github` à `tar`, **inconditionnellement**, y compris si
`include-hidden-files` était un jour activé. Un dossier caché ordinaire ne
tiendrait que par la première règle ; celui-ci tient par les deux.

Et la suite métier retrouve sa base : les deux épreuves d'infrastructure ne
sont plus à la racine, donc plus ramassées par `run-tests.js`, qui n'inspecte
que la racine. L'ensemble des `test_*.js` de la racine est **identique, fichier
pour fichier, à celui de `origin/production`** — **175**, comme avant le lot.

Le workflow **se déclenche avant la fusion**, sur la PR elle-même
(`pull_request` vers `production`), et de nouveau sur le push après fusion.
Dans les deux cas il construit (mode `a-l-identique`, puisque `build.sh` est
absent), éprouve l'artefact, le mesure et l'emballe. **Il n'ira pas plus
loin.**

Mesurer avant plutôt qu'après n'est pas un confort : sans le déclencheur de
PR, la première mesure réelle de l'artefact Linux n'existe qu'une fois la
fusion faite — c'est-à-dire après le seul moment où l'on peut encore décider de
ne pas la faire. Ce déclencheur ne peut rien publier, et ce n'est pas une
lecture de bonne foi du YAML : sur un événement `pull_request`, `github.ref`
vaut `refs/pull/<n>/merge` et `inputs.*` vaut `null`, donc **deux** des trois
clauses de `deployer` tombent, indépendamment l'une de l'autre.
`.github/deploiement/test_garde_deployer_20260915.js` extrait la condition du
YAML réel, l'évalue sur tous les contextes de PR plausibles, et exige qu'aucun
ne l'ouvre — plus une campagne de mutation qui vérifie que l'épreuve mord.
Sur le push d'après fusion, la branche redevient `refs/heads/production` : la
première clause s'ouvre, et ce qui retient alors est l'approbation
d'environnement, qui n'est pas donnée.

*Ce que le déclencheur de PR mesure* est l'arbre du **commit de fusion**
(`github.sha` sur un événement `pull_request`), c'est-à-dire l'arbre que
`production` servira une fois la PR fusionnée — pas celui de la branche seule.
C'est l'objet qu'il fallait mesurer.

*Effet sur le site : aucun — Pages est toujours en mode branche.*
*Retour arrière : révoquer la PR.*

### Étape 2 — lire l'artefact avant qu'il ne serve
Dans l'exécution du workflow : ouvrir le job `construire`, vérifier
que la garde a écrit « Artefact accepté », et **télécharger l'artefact**
(`github-pages`) pour le comparer à l'arbre de `production`. Il doit être
identique **aux chemins cachés près** — `.git`, `.github`, `.gitignore`,
`supabase/.gitkeep` — que `upload-pages-artifact` v4+ n'emballe pas et que le
mode branche n'exposait pas davantage. Le journal de la garde énumère ces
entrées, il n'y a donc rien à deviner.

**Et relever l'empreinte** (§7), écrite dans le résumé du job : c'est elle
qu'il faudra retrouver, inchangée, à l'étape 3. Attendu pour
`d5a8b77d…` : `998` fichiers hors chemins cachés — **999 sur le runner**, la
casse d'`icon-nexus-tempo` faisant apparaître deux entrées là où macOS n'en
voit qu'une (§2bis). Noter la valeur annoncée par l'exécution ; c'est elle qui
fait foi.

*Effet sur le site : aucun.* *C'est l'étape qui rend la suivante sûre.*

### Étape 3 — basculer la source de Pages, puis approuver
**Settings → Pages → Source : `GitHub Actions`.**
Puis relancer le workflow : Actions → « Déploiement Production (GitHub
Pages) » → *Run workflow* sur `production`, `deployer` = `oui`.

Le job `construire` se déroule. Le job `deployer` s'arrête alors en attente :
**« Review deployments » → `github-pages` → Approve and deploy.** C'est le
geste humain, et il est redemandé à chaque exécution.

Ce qui se passe entre l'approbation et la promotion tient en une étape : la
**garde anti-obsolescence** redemande à l'API le HEAD actuel de `production` et
le compare au SHA construit. Si la branche a avancé pendant l'attente — et
cette attente peut durer des heures — **le déploiement échoue fermé** plutôt
que de remettre le site dans un état plus ancien que la branche. Elle échoue
fermé aussi si l'API ne répond pas : un doute ne publie pas.

Une fois la garde franchie, `configure-pages` ayant réussi puisque la source
est la bonne, `deploy-pages` promeut **l'artefact emballé par `construire`,
dans cette même exécution**. Rien n'est reconstruit, rien n'est réemballé.
Pages échange la version servie.

**Contrôle immédiat**, dans cet ordre :
1. `https://app.nexusconseil.net` s'ouvre et l'écran de connexion fonctionne ;
2. l'en-tête HTTP annonce toujours `server: GitHub.com` ;
3. l'empreinte inscrite sous « Artefact promu en Production » est **la même**
   que celle relevée à l'étape 2 — c'est la preuve qu'aucune reconstruction
   n'a eu lieu entre l'épreuve et la promotion ;
4. rejouer la confrontation du §2bis sur un échantillon : chaque fichier servi
   doit rester identique à `git show origin/production:<chemin>`. Le **seul**
   écart attendu est `CNAME`, qui peut passer de 404 à 200 (§2bis).

*Retour arrière — **trois** gestes, pas un (corrigé le 15/09, voir §2bis) :*
**(1)** Settings → Pages → Source : `Deploy from a branch` → `production` /
`/ (root)` ; **(2) approuver la reconstruction *legacy*** que ce changement
déclenche, car la gate `github-pages` la retient elle aussi — sans cette
approbation le site sert encore l'artefact Actions ; **(3)** vérifier le
retour au contenu précédent. Aucun commit n'est nécessaire — mesuré au
§2bis : ce que ce retour restitue est, à `CNAME` près, **exactement** les 997
fichiers servis aujourd'hui, parce que la branche n'a jamais été touchée par
le déploiement. Le délai n'est donc pas « quelques minutes » mais « quelques
minutes **plus** le temps de réponse d'un relecteur ».

### Étape 4 — seulement ensuite, le lot applicatif
La fusion de `ea57d4b` devient possible **parce que** `outils/build.sh`
arrivera avec lui : le workflow basculera de lui-même en mode `construit`,
exécutera `bash outils/build.sh` avec `NEXUS_ENV=production`, et la garde
exigera que `nexus-config.js` soit présent et vise bien le projet de
Production.

**Cette étape n'est pas autorisée par le présent document et demande une
décision distincte.**

---

## 5. Ce que la garde contrôle, et ce qu'elle ne contrôle pas

`.github/deploiement/verifier-artefact-pages.js` s'exécute avant l'emballage. Lecture
seule, échec fermé, et **elle ne recopie jamais ce qu'elle refuse** : le
journal d'une exécution Actions est lisible par tout le dépôt — une garde qui
imprime le secret qu'elle a trouvé le publie.

Elle refuse sur : mode incohérent avec l'arbre (A1) ; fichier attendu absent
ou fichier interdit présent (B1–B3) ; configuration visant un autre
environnement ou un autre projet Supabase (C1–C4) ; les **formes** de
secrets S1 à S6 (clé `sb_secret_`, JWT de rôle non publiable, chaîne de
connexion PostgreSQL avec mot de passe, clé privée PEM avec corps base64,
valeur affectée à une variable de clé de service) ; et les deux familles
ajoutées avec la composition de l'artefact :

- **P — périmètre public.** En mode `construit` uniquement, refuse un artefact
  qui contient encore des tests, du SQL, `docs/`, `supabase/`, `outils/` ou
  des documents internes. C'est le **second témoin** du composeur : si
  quelqu'un remet un jour `path: .`, la garde refuse au lieu de republier le
  dépôt en silence. Contre-épreuve faite sur le candidat construit : publié
  brut, il est refusé pour **851 fichiers hors périmètre** (271 tests, 305
  SQL, 211 documents internes, 62 fichiers de `docs/`, `run-tests.js`,
  `CLAUDE.md`). Aucun n'est un secret — et c'est tout le point : **les règles
  S les auraient tous acceptés.**
- **R — clôture des références.** Toute référence locale d'un écran, d'un
  script ou d'une feuille de style doit se résoudre **dans l'artefact**, casse
  comprise : Pages sert depuis Linux, le poste de développement est insensible
  à la casse — `fs.existsSync` accepterait ce que le site rendrait en 404, la
  garde résout donc contre un inventaire.

C'est R qui répond à la question que la liste d'exclusion ne peut pas se poser
à elle-même : **a-t-on retiré quelque chose de nécessaire ?** Mesures :

| arbre | fichiers | références locales résolues | manquantes |
|---|---|---|---|
| `production` entier (mode « à l'identique ») | 1002 | **962** | **0** |
| le même, après composition | 525 | **962** | **0** |
| candidat construit, après composition | 540 | **1159** | **0** |

Les deux premières lignes sont le cœur de la preuve : l'artefact composé est
un **sous-ensemble strict** de ce que la première passe a scruté. Si l'un des
482 fichiers retirés avait porté une référence, le total de la ligne 1 serait
strictement supérieur. Il est égal. Et sur le candidat : **65 écrans sur 65
conservés, aucun perdu.**

`test_verifier_artefact_pages_20260915.js` mute dans le contrat de chacune de
ces règles — **37 contrôles**, chacun fabriquant l'arbre qui viole exactement
une règle, plus les cas légitimes qui doivent passer. **C'est ce test qui a
révélé que la règle S4 ne mordait pas** : examinée ligne par ligne, elle ne
pouvait jamais voir un corps PEM, qui vit toujours sur la ligne suivante de
son en-tête. Verte et inutile. Corrigée.

Les nouveaux cas ont été éprouvés de la même façon, en débranchant chaque
règle : P1 muette → 5 contrôles tombent, R1 muette → 3, A1 muette → 3. Une
règle dont l'absence ne fait rien tomber n'est pas contrôlée.

**Une garde qui refuse à tort se fait débrancher aussi sûrement qu'une garde
muette.** La première exécution réelle de R l'a rappelé : elle a refusé
l'arbre de `production` sur **douze références, douze faux positifs, zéro
vrai**. Le motif `url(…)` — notation CSS — était appliqué aux écrans entiers
et mordait sur du JavaScript : `URL.revokeObjectURL(a.href)`,
`createObjectURL(blob)`, `ouvrirDepuisParametresUrl(date, quart)`. La lecture
est désormais bornée aux `<style>` et aux attributs `style=`, et un cas de
non-régression fige ce comportement.

### Deux écarts assumés, énoncés plutôt que masqués

**a. `_headers` n'existe pas pour GitHub Pages.** Le fichier est une
convention Cloudflare. La règle `Cache-Control: no-store` sur
`/nexus-config.js` — que `generer-config.js` exige et vérifie au build — **ne
sera pas appliquée** une fois servie par Pages. La garde le signale en
avertissement, sans bloquer. Conséquence à connaître le jour où l'étape 4 est
autorisée : un `nexus-config.js` pourra être mis en cache par les
navigateurs. Traiter ce point relève du lot applicatif, pas de celui-ci.

**b. `service_role` : l'esprit plutôt que la lettre.** La consigne demande de
refuser l'artefact si `service_role` y apparaît. Appliquée à la lettre, elle
refuserait l'artefact **d'aujourd'hui** : la chaîne est présente dans 17
fichiers de `production` — 12 migrations SQL qui accordent des droits, 2
notes, un commentaire d'Edge Function qui dit précisément « pas de
service_role ici, volontairement », un script d'outillage et un commentaire
d'écran. Aucune n'est une clé. Une garde qui refuse toujours n'est pas une
garde : elle est débranchée le jour où elle gêne, et ne protège alors plus
rien.

La garde vise donc les **formes d'identifiants**, qu'une prose ne produit pas
par accident, et compte le mot nu séparément (règle S5, affichée en
avertissement). **`--refuser-mot-service-role` applique la lettre de la
consigne** pour qui la veut ; le workflow ne l'active pas, parce qu'elle
rendrait la bascule impossible.

---

## 5bis. Le retour arrière en Phase 1 — ce qu'il couvre, ce qu'il ne couvre pas

Une version antérieure de ce document et du workflow affirmait qu'un état plus
ancien pouvait être republié par `workflow_dispatch` avec `ref_applicatif`.
**C'est faux, et il vaut mieux le dire que le corriger discrètement :** le job
`deployer` exige `needs.construire.outputs.sha_construit == github.sha`, et ce
workflow ne repointe jamais `production`. Construire sur une autre référence
produit donc un artefact que `deployer` refusera. Une phrase fausse sur un
retour arrière est plus dangereuse qu'un retour arrière absent : elle se lit
le jour de l'incident, quand personne ne relit le YAML.

**Trois choses distinctes, qu'il ne faut pas confondre.**

| | ce que c'est | disponible en Phase 1 |
|---|---|---|
| **Rollback d'hébergement** | ramener Pages à « Deploy from a branch » → `production` / `/ (root)`, **puis approuver la reconstruction *legacy***, **puis** vérifier le contenu | **oui** — **trois** gestes humains, hors workflow, mesurés au §2bis |
| **Rollback applicatif** | republier un état de **code** antérieur | **non** — circuit distinct, non fourni dans cette phase |
| **`ref_applicatif`** | construire et éprouver une référence | **oui**, et **rien d'autre** : jamais un chemin de déploiement |

**Ce que couvre le rollback d'hébergement.** Il restitue exactement ce que
`production` contient — à `CNAME` près, les 997 fichiers confrontés un à un au
§2bis. Comme l'artefact Actions n'écrit jamais dans la branche, `production` ne
bouge pas pendant la bascule : il n'y a ni commit à annuler, ni fusion à
défaire. Ce retour est donc **complet pour le risque que la bascule
introduit** — le risque d'hébergement — et pour lui seul.

**Ce qu'il exige, et que ce document a d'abord annoncé à tort.** Il n'est pas
atomique. Le relecteur requis de l'environnement `github-pages` garde les
**deux** rails : remettre la source sur la branche déclenche une exécution
`pages build and deployment` qui **attend elle aussi une approbation
humaine**. Entre le geste 1 et le geste 2, le site sert encore l'artefact
Actions. Le jour de l'incident, cela veut dire : *changer le réglage ne suffit
pas — il faut aller approuver, sinon rien ne revient.* Constaté en conditions
réelles le 15/09/2026 lors de la bascule elle-même, où les deux déploiements
concurrents attendaient tous deux l'humain.

**Ce qu'il ne couvre pas.** Si le code de `production` est lui-même en cause,
revenir à « Deploy from a branch » republie ce même code : l'hébergement change,
le contenu non. Le remède est alors un geste de dépôt — `git revert` sur
`production`, par la PR que le ruleset impose — qui est du ressort de la
procédure applicative, pas de ce rail. La Phase 1 ne le fournit pas, et ne
prétend pas le fournir.

**Aucun chemin ne permet à ce workflow de promouvoir un artefact que le HEAD
courant de `production` ne revendique plus.** C'est une propriété, pas une
limitation regrettable : c'est elle qui rend l'artefact promu lisible d'une
seule ligne.

---

## 6. Permissions

| où | quoi | pourquoi |
|---|---|---|
| workflow, niveau haut | `permissions: {}` | rien par défaut |
| job `construire` | `contents: read` | lire l'arbre, rien de plus |
| job `deployer` | `contents: read` | **uniquement pour la garde anti-obsolescence**, qui demande à l'API le HEAD courant de `production`. Ce job ne fait aucun `checkout` — et c'est voulu : il ne doit rien pouvoir reconstruire |
| job `deployer` | `pages: write`, `id-token: write` | exigé par `deploy-pages` ; **ce droit n'existe que dans le job qui déploie** |
| checkout | `persist-credentials: false` | le jeton ne reste pas dans l'arbre construit |

Les cinq actions utilisées sont **épinglées par SHA**, pas par étiquette :
une étiquette se déplace, un SHA non. `checkout` et `setup-node` reprennent
les empreintes déjà en service dans `tests.yml`.

| action | version | SHA épinglé |
|---|---|---|
| `actions/upload-pages-artifact` | **v5.0.0** | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/configure-pages` | **v6.0.0** | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| `actions/deploy-pages` | **v5.0.1** | `368f82528645a54fb793d4d04e342629a3f51346` |

**Sur la version de `upload-pages-artifact`.** La consigne demandait « la
version v4 épinglée par SHA si elle est compatible ». Vérification faite chez
l'éditeur : **v4 n'est plus la version officielle courante — c'est v5.0.0**,
publiée le 10/04/2026. Les deux sont compatibles avec ce lot :

- **v4.0.0** (14/08/2025) introduit l'exclusion des chemins cachés et épingle
  `upload-artifact` par SHA. C'est **cette version qui referme l'écart Jekyll**
  décrit au §2 ; tout ce qui est dit ici en dépend, pas de v5.
- **v5.0.0** ajoute `upload-artifact` v7 et l'entrée `include-hidden-files`,
  sans rien retirer.

Le lot retient donc **v5.0.0** : à comportement équivalent sur ce que nous en
attendons, la version courante est celle qui continuera de recevoir les
correctifs. Si la consigne « v4 » doit être appliquée à la lettre, le
remplacement tient en une ligne — SHA de **v4.0.0** :
`7b1f4a764d45c48632c6b24a0339c27f5614fb0b`. **C'est une décision de Frédéric,
pas un point technique.**

### Ce qui garde le job `deployer` — trois conditions, une gate, une garde

**Trois conditions cumulatives** dans le `if:` du job :

1. branche `production` ;
2. déclenchement par push, ou `deployer == 'oui'` sur un lancement manuel ;
3. **le commit construit doit être celui du déclenchement**
   (`needs.construire.outputs.sha_construit == github.sha`).

C'est la troisième qui rend l'entrée `ref_applicatif` inoffensive : construire
sur une autre référence produit un artefact que le job `deployer` **refusera**,
puisque `sha_construit` ne sera pas égal à `github.sha`. `ref_applicatif` sert
donc à éprouver un build, **jamais à déployer** — voir §5bis.

**Il n'y a plus de quatrième condition sur une variable de dépôt.**
`NEXUS_DEPLOIEMENT_ARME` a disparu du `if:`. `vars.*` n'est lu nulle part dans
ce fichier — ni dans le `if:`, ni dans une étape, ni dans une expression — et
le dépôt ne possède aucune variable d'Actions. Aucun chemin ne subsiste par
lequel la seule présence d'une valeur persistante autoriserait un déploiement
futur. Ce qui autorise est une approbation, redemandée à chaque exécution
(§3bis).

**La gate humaine n'est pas dans le `if:`** : elle est dans `environment:
github-pages`, dont les *Required reviewers* suspendent le job jusqu'à
approbation (§3, geste 2).

**Puis une garde, après l'approbation et juste avant la promotion.** L'étape
« Garde anti-obsolescence » interroge l'API — `repos/…/git/ref/heads/production`
— et compare le HEAD courant au SHA construit. Si un commit plus récent
existe, **le déploiement échoue fermé** : on ne publie pas un artefact devenu
obsolète pendant que l'approbation attendait. Elle échoue également fermé
quand l'API est injoignable, quand le HEAD est illisible, et quand le SHA
construit est vide — l'absence de réponse n'est jamais lue comme une
autorisation. Elle ne porte pas `if: always()`, et ce serait une faute : une
garde qui s'exécute après un échec amont n'a plus rien à garder.

**Déployer délibérément un SHA plus ancien n'est possible par aucun chemin de
ce rail.** Ni en contournant la garde, ni par `workflow_dispatch` : voir §5bis,
qui énonce ce que le retour arrière de Phase 1 couvre et ce qu'il ne couvre
pas.

**La sémantique de `compare`, parce qu'elle avait été lue à l'envers.**
`GET /repos/{dépôt}/compare/{BASE}...{TÊTE}` renvoie un `status` qui décrit
**TÊTE par rapport à BASE**. La garde appelle `compare/${SHA_CONSTRUIT}...${TETE}` :
BASE est donc le SHA construit, TÊTE le HEAD courant de `production`.

| `status` | ce que cela veut dire ici |
|---|---|
| `ahead` | **`production` a avancé** depuis la construction — c'est le cas d'obsolescence pour lequel la garde existe |
| `behind` | c'est le SHA construit qui descend du HEAD courant |
| `identical` | incohérent à ce point du script, qui n'est atteint qu'avec deux SHA différents |
| `diverged` | aucun des deux ne contient l'autre (réécriture d'historique) |

Vérifié le 15/09/2026 **sur le dépôt lui-même, en lecture seule** :
`compare/da6525f0…...d5a8b77d…` (parent → enfant) répond `ahead`, `ahead_by: 1`,
`behind_by: 0` ; le sens inverse répond `behind` ; deux fois le même SHA répond
`identical`. La version précédente de ce document, comme celle du `case`,
appelait `behind` le cas d'un HEAD qui avait avancé. Les deux refusaient, donc
l'épreuve passait — c'est le diagnostic qui aurait désigné la mauvaise
situation.

**Format des SHA.** `TETE` et `SHA_CONSTRUIT` sont validés contre
`^[0-9a-f]{40}$`, pas contre une simple longueur de 40 : quarante caractères
quelconques — un fragment de JSON, un message d'erreur, une chaîne tronquée à
la bonne taille — ne sont pas un SHA. La forme est écrite en `sh` portable :
un `case` qui rejette la chaîne vide et tout caractère hors `[0-9a-f]`, suivi
du test de longueur.

**Épreuve de la garde.** Le script est extrait tel quel du YAML (104 lignes,
zéro expression `${{ }}`) et rejoué contre un `gh` simulé. Ce `gh` ne reçoit
plus le `status` par variable d'environnement : il le **calcule** à partir d'un
graphe d'ancêtres déclaré, selon la règle réelle de l'API — sans quoi l'épreuve
ne vérifierait que sa propre convention. Chaque cas exige **le code de sortie
et un fragment du diagnostic** ; c'est cette seconde exigence qui rend une
inversion `ahead`/`behind` détectable. **17 contrôles, 17 conformes :**

| cas | attendu | obtenu |
|---|---|---|
| HEAD identique au SHA construit | publie (code 0) | ✅ |
| `production` a avancé d'un commit (`ahead`) | refus (code 1), diagnostic « a avancé depuis la construction » | ✅ |
| `production` a avancé de deux commits (`ahead`) | refus, même diagnostic | ✅ |
| SHA construit en avance sur le HEAD (`behind`) | refus, diagnostic « en avance sur » | ✅ |
| historique divergent (`diverged`, force-push) | refus, diagnostic « divergé » | ✅ |
| HEAD de 40 caractères non hexadécimaux (`zzz…`) | refus | ✅ |
| SHA construit de 40 caractères non hexadécimaux | refus | ✅ |
| HEAD tronqué (`abc123`) | refus | ✅ |
| HEAD vide | refus | ✅ |
| `sha_construit` vide | refus | ✅ |
| API de référence injoignable | refus, fermé | ✅ |
| `compare` injoignable, HEAD différent | refus (relation « inconnue ») | ✅ |
| le résumé de refus énonce la formulation de rollback de Phase 1 | 3 fragments présents | ✅ |
| le résumé ne contient plus l'ancienne formulation fausse | 2 fragments absents | ✅ |

**Mutation.** Une épreuve verte ne prouve rien tant qu'elle n'a pas été vue
mordre. Deux mutations ont été injectées dans le script extrait : réinverser
`ahead`/`behind` → **14 réussis, 3 échoués** ; revenir à la validation par la
seule longueur → **15 réussis, 2 échoués** ; script restauré → **17/17**.

---

## 7. L'empreinte de l'artefact

La procédure v2 tient sur une phrase : **construire une fois, éprouver
l'artefact construit, puis promouvoir exactement le même artefact.** « Le
même » n'est vérifiable que s'il porte un nom qui change dès qu'un octet
change. C'est ce que produit `.github/deploiement/empreinte-artefact.js`.

### Comment elle est calculée

1. Parcours de l'arbre, **tout chemin dont un segment commence par un point
   est écarté** — exactement le périmètre de `upload-pages-artifact` v4+. Sans
   cette égalité, l'empreinte bougerait sans que le site bouge, et ne pourrait
   jamais être confrontée à ce que l'URL sert réellement.
2. Tri des chemins **en ordre d'octets** (`Buffer.compare`), jamais par
   collation de machine : `localeCompare` donne un ordre qui dépend du système
   et de sa locale, donc une empreinte qui n'est pas la même partout.
3. Manifeste `<sha256>  <chemin>` ligne à ligne ; **l'empreinte est le sha256
   de ce manifeste.** Elle change donc si un octet change, si un fichier est
   ajouté, retiré, renommé ou déplacé.
4. Échec fermé : arbre vide, lien symbolique, nom contenant un saut de ligne,
   racine illisible — aucun de ces cas ne produit d'empreinte.

Reproductible à la main, sans l'outil :

```bash
cd <racine> && find . -type f -not -path '*/.*' | sed 's|^\./||' \
  | LC_ALL=C sort | while read -r f; do printf '%s  %s\n' \
      "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$f"; done | shasum -a 256
```

### Où elle est écrite — et pourquoi pas dans le dépôt

**Un fichier ne peut pas nommer sa propre empreinte** : l'y écrire la
déplacerait, et il faudrait une seconde empreinte pour dire laquelle est vraie.
Elle est donc émise **dehors** : sortie d'étape (`$GITHUB_OUTPUT`), résumé de
job (`$GITHUB_STEP_SUMMARY`), manifeste détaillé dans `$RUNNER_TEMP` — donc
éphémère, et aucune action supplémentaire n'a été introduite pour le conserver.

L'étape est placée **après la garde et avant l'emballage** : c'est le dernier
moment où l'arbre qui part est encore sur le disque. Le job `deployer`
réinscrit ensuite la même valeur sous « Artefact promu en Production », à côté
de l'URL déployée. Les deux lignes se lisent en quelques secondes — c'est là
que se joue le « moins de 5 minutes d'arbitrage humain par déploiement ».

Les six champs exigés par la procédure v2 : `sha_source`, `empreinte_artefact`,
`environnement`, `migrations_source_nombre` + `migrations_source_empreinte`
(+ `migrations_source_liste`), `identifiant_build`, et la provenance
(`procede`, `atelier`, `run`).

### La provenance des migrations : un périmètre, un seul

Les champs portent désormais le mot **`source`**, et ce n'est pas cosmétique.
Le périmètre mesuré est **exclusivement `supabase/migrations/*.sql`** : un seul
dossier, sans récursion, sans fichier caché, extension `.sql` uniquement, tri
en ordre d'octets. Sur la base actuelle : **240 fichiers**.

| champ | ce qu'il porte |
|---|---|
| `migrations_source_nombre` | le compte de `supabase/migrations/*.sql` — **240** |
| `migrations_source_empreinte` | sha256 du manifeste `<sha256>  <nom>` de ces seuls fichiers |
| `migrations_source_liste` | leurs noms, dans l'ordre mesuré |

Le nom précédent — `migrations_nombre` — laissait croire à un inventaire de
*toutes* les migrations du dépôt. Un parcours large en ramasse **256** : 240
sources, plus 11 SQL épars, 2 exports, 3 réparations, moins 2 doublons de
chemin. Le pire faux compte venait de `migrations_appliquees.sql`, qui est un
**export d'état appliqué**, pas une migration. **Aucun SQL épars, export,
réparation ou retour arrière n'est qualifié de migration canonique.**

Ce champ dit donc une chose précise et vérifiable : *quelles migrations
source l'arbre promu contient*. Il ne prétend pas dire ce qui est appliqué en
Production. **Le rapprochement Git ↔ Production ↔ Test est un lot séparé, en
lecture seule, et ne fait pas partie de cette PR.**

Relevé le 15/09/2026, et recalculé indépendamment en shell pour contrôle :

```
migrations_source_nombre    : 240
migrations_source_empreinte : 87da937b22e7e9f6cca75d7b179c9879766b763436afbe9aa6e82caaa7666430
```

### Ce que l'épreuve contrôle

`test_empreinte_artefact_20260915.js` — **32 contrôles, 32 verts.** Ils ne
vérifient pas que l'outil « marche » : chacun fabrique l'arbre qui produirait
un défaut précis, et exige le verdict.

| famille | ce qui est exigé |
|---|---|
| **Bouge** (7) | un octet, un ajout, un retrait, un renommage, un déplacement, un fichier vidé, deux fichiers qui échangent leur contenu |
| **Stable** (6) | deux mesures du même arbre, ordre de création inversé, date de modification changée, chemins cachés à trois profondeurs |
| **Ordre** (1) | le manifeste est trié en octets — le cas vérifie aussi que `localeCompare` donnerait un ordre **différent** sur ce jeu de noms, sans quoi il ne mordrait pas |
| **Fermé** (3) | arbre vide, lien symbolique, nom avec saut de ligne |
| **Indépendant** (1) | le parcours est réimplémenté dans le test, sans appeler l'outil |
| **CLI** (4) | `--attendu` conforme accepté, différent refusé, racine absente, **mesurer ne modifie pas l'arbre mesuré** |
| **Réel** (1) | l'arbre de cette branche, pas seulement des bacs à sable |
| **Provenance** (9) | les 240 migrations source : périmètre `supabase/migrations/*.sql`, `.sql` caché ignoré, et six façons d'échouer fermé — dossier absent, `ENOTDIR`, dossier vide, aucun `.sql`, sous-dossier, lien symbolique ; plus la provenance de l'arbre réel |

**Campagne de mutation.** Huit défauts remis dans l'outil, l'épreuve rejouée à
chaque fois, l'outil restauré inconditionnellement. Six mutations tuées.

**Deux ont survécu, et c'est une information, pas un trou.** Retirer la
*seule* règle des liens symboliques, ou la *seule* vérification d'existence de
la racine, ne change rien au verdict — une seconde garde reprend derrière
(l'entrée de type inattendu ; l'arbre vide). Deux visées supplémentaires l'ont
établi : retirer **les deux** fait tomber `Fermé · un lien symbolique arrête la
mesure`. La mutation visait hors du contrat de la garde ; ce n'est pas
l'épreuve qui passait à côté.

### Les empreintes relevées

| arbre | fichiers | octets | empreinte |
|---|---|---|---|
| `origin/production` `d5a8b77d…` (ce qui sera publié à la bascule) | 998 | 53 454 287 | `d5c073a85b3bc7252e79848833f0f2cb3244b49f32dc057e94e13d0eb8ef4df7` |
| branche du présent lot `04738f18…` | 1003 | 53 553 503 | `a39fa4ae4b0c3c52d6a804a75f3c5b94269cb582981bc6ce1f97090300edce99` |
| candidat `ea57d4b…`, **non construit** (refusé par la garde) | 538 | 48 642 427 | `63210dcf091a53f26f5b098c08a6fd22366f2924a0c8e73866eb26f699b69fe8` |

Mesures de poste, donc soumises à l'écart de casse décrit au §2bis : sur le
runner Linux, la première ligne portera 999 fichiers et une autre empreinte.
**L'empreinte faisant foi est celle de l'exécution.**

### Le build n'est pas reproductible — d'exactement une seconde (dette de Phase 2)

Question posée sur le candidat `ea57d4b` : **deux constructions de la même
source donnent-elles le même artefact ?** Deux clones indépendants, construits
l'un après l'autre, `NEXUS_ENV=test` :

| | build 1 | build 2 |
|---|---|---|
| fichiers / octets | 540 / 48 656 221 | 540 / 48 656 221 |
| `identifiant_build` | `100a1d6f1bfa` | `100a1d6f1bfa` |
| empreinte | `4fb2dc06ad09…` | `b30cf6952e67…` |

Le manifeste diffère sur **exactement une ligne** : `nexus-build.js`. Le
fichier diffère sur **exactement un champ** : `construitLe: '…T17:17:06Z'`
contre `'…T17:17:07Z'`. L'identifiant de build, lui, est stable — la
non-reproductibilité ne vient pas de là, contrairement à ce qui était supposé.

**Ce que cela impose.** « Zéro artefact reconstruit après validation » n'est
pas une discipline que l'on peut rattraper : **une reconstruction ne pourra
jamais retrouver l'empreinte validée.** C'est une raison de plus de promouvoir
l'artefact déjà emballé — ce que fait `deploy-pages` — et jamais de rejouer le
build « pour être sûr ».

**Ce que cela n'impose pas — arbitrage du 15/09/2026.** Ce défaut avait été
présenté comme bloquant ; il ne l'est pas, et il faut dire pourquoi
exactement. Le rail ne reconstruit jamais entre l'épreuve et la promotion :
`construire` emballe **un seul** artefact, `deployer` promeut **celui-là**, et
les deux jobs appartiennent à la **même exécution**. Aucune reconstruction
inter-exécutions n'est nécessaire, donc la seconde qui varie n'est jamais
comparée à elle-même. **Le déterminisme de `construitLe` est reclassé en dette
de Phase 2** : souhaitable pour l'auditabilité et pour une reconstruction de
secours — le jour où il faudrait refabriquer un artefact perdu et prouver
qu'il est le même — mais **non bloquant pour ce lot**.

Le remède, quand il viendra : dériver `construitLe` de la date du commit, ou le
retirer. **Il n'est pas appliqué ici :** `poser-build-id.js` vit sur `ea57d4b`,
et ce lot ne mêle aucune évolution d'un autre lot.

### La mesure ne touche pas ce qu'elle mesure

L'outil ouvre en lecture seule, n'écrit que là où on le lui dit
(`--journal`, `--sortie`, `--resume`), et un contrôle dédié vérifie que
l'arbre mesuré est inchangé après la mesure. Aucun privilège, aucune session,
aucun secret : il ne lit que des octets de fichiers.

---

## 8. Ce que la CI exécute, et ce qu'elle rapporte

### Deux résultats, pas un seul

Les trois épreuves du rail vivent sous `.github/deploiement/` et **ne sont pas
ramassées par `run-tests.js`** : sa découverte est plate et limitée à la racine
(`readdirSync(__dirname)` filtré sur `test_*.js`). Les déplacer les en a donc
sorties **sans toucher une ligne de `run-tests.js`** — ce qui était la
contrainte.

Elles sont lancées dans `tests.yml` comme **trois étapes dédiées et bloquantes**,
après la suite métier. Deux raisons de ne pas les fondre dedans :

- un échec d'infrastructure ne doit pas se lire comme une régression métier, ni
  se cacher derrière la liste des 9 échecs tolérés ;
- la suite métier tourne en `continue-on-error: true` — un échec
  d'infrastructure noyé dedans **ne ferait rien échouer du tout**. En étape
  séparée, sans tolérance, il arrête la CI.

Les neuf étapes du job `non-regression`, dans l'ordre :

| # | étape | tolérance |
|---|---|---|
| 1 | `actions/checkout` | — |
| 2 | `actions/setup-node` (Node 24) | — |
| 3 | Cohérence des épingles de cache | bloquante |
| 4 | Suite de non-régression (`run-tests.js`) | `continue-on-error: true` |
| 5 | Comparer aux échecs connus (liste de 9) | **bloquante** |
| 6 | Simulations métier | bloquante |
| 7 | **Infrastructure — empreinte de l'artefact** | **bloquante, aucune tolérance** |
| 8 | **Infrastructure — garde de l'artefact Pages** | **bloquante, aucune tolérance** |
| 9 | **Infrastructure — un `pull_request` ne peut pas déployer** | **bloquante, aucune tolérance** |

### Les quatre résultats, relevés le 15/09/2026

| suite | résultat | échecs |
|---|---|---|
| métier — `node run-tests.js` | **166/175** | les **9** échecs connus, ni plus ni moins |
| `test_empreinte_artefact_20260915.js` | **32/32** | aucun |
| `test_verifier_artefact_pages_20260915.js` | **37/37** | aucun |
| `test_garde_deployer_20260915.js` | **20/20** | aucun |

**Sur la base historique.** La cible annoncée était « 167/176 avec les mêmes 9
échecs connus ». Le compte réel est **166/175**, et c'est bien la base
historique : `origin/production` porte **175** fichiers `test_*.js` à la racine,
dont 166 passent et 9 échouent. Après le déplacement, l'ensemble des `test_*.js`
de la racine est **identique, fichier pour fichier, à celui de
`origin/production`** — le lot n'en ajoute ni n'en retire aucun. Avant le
déplacement la racine en portait 177 (les deux épreuves d'infrastructure), d'où
un compte qui n'était pas comparable. Le chiffre « 167/176 » ne correspond à
aucun état mesuré ; **la base retrouvée est 166/175**, avec exactement les 9
échecs listés dans `tests.yml`.

Les 9 échecs connus, inchangés : inventaire ×5, réception ×2, carburant ×1,
pilotage ×1.

### `retention-days: 7` — pourquoi c'est écrit explicitement

Le défaut de `upload-pages-artifact` est **`1`** — un seul jour. Ce n'est pas un
réglage de confort : c'est la durée pendant laquelle l'artefact promu reste
téléchargeable, donc **la fenêtre dans laquelle on peut encore rejouer
`empreinte-artefact.js` dessus** et confronter l'empreinte à ce que l'URL sert
réellement. Un jour ne couvre pas un week-end ; sept jours couvrent le délai de
48 h annoncé pour une release normale, plus la marge d'un incident découvert
tard.

**Un seul téléversement, ici et nulle part ailleurs.** `construire` emballe une
fois ; `deployer` promeut cet artefact-là et n'en fabrique pas un second.

---

## 9. Dette externe — Cloudflare Pages (constat seul)

**Aucun correctif Cloudflare n'est apporté par ce lot, et c'est délibéré.** Le
sujet est documenté ici pour qu'il ne soit pas confondu avec un signal de cette
PR.

| constat | mesure |
|---|---|
| échec du contrôle Cloudflare Pages | identique sur `d5a8b77d`, `04738f1` et `067a293` |
| 30 derniers commits de `origin/production` | **0 succès, 3 échecs, 27 sans contrôle** |
| projet visé | `nexus-test` — `a581d7a4-2244-4d69-a3a1-bad0f6606aa6` |
| cause racine | **non établie** — les journaux vivent dans le tableau de bord Cloudflare, hors du dépôt |

**Ce que cela établit :** l'échec **préexiste au lot** et ne dépend pas de son
contenu — il tombe de la même façon sur un commit antérieur de `production` que
sur la branche du lot. Ce n'est donc pas une régression introduite ici, et ce
n'est pas un indicateur de santé exploitable en l'état.

**Ce que cela n'établit pas :** pourquoi il échoue. Tant que les journaux du
tableau de bord n'ont pas été lus, toute cause avancée serait une hypothèse.

**Traitement prévu :** lot séparé. Deux issues possibles — réparer l'intégration
(si `nexus-test` doit continuer d'être construit par Cloudflare) ou la retirer
(si le rail GitHub Actions la rend redondante). **Le choix appartient à
Frédéric**, et il n'a pas à être fait pour fusionner ce lot.
