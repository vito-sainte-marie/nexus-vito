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
| 2 | dossier public dédié, en mode construit | **fait** | `outils/composer-artefact-public.js`, 861 → 540 |
| 3 | actions Pages en version officielle **courante**, épinglées par SHA | **fait** | §6 — v5.0.0 / v6.0.0 / v5.0.1 |
| 4 | construire l'artefact et l'éprouver **sans le servir** | **fait** | §5 (garde) et §7 (empreinte) |
| 5 | installer le workflow seul | **plan** — exige fusion, puis GO | étape 1 du §4 |
| 6 | basculer Pages vers Actions | **plan** — exige GO | étape 4 du §4 |
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
où `outils/build.sh` atteint `production` (étape 5), le test de présence
basculant alors en mode `construit`.

**En mode `construit`, l'arbre n'est plus publié : un artefact public dédié
est composé.** `outils/composer-artefact-public.js` écrit `_site`, d'où sont
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

**Settings → Pages → Build and deployment → Source : `Deploy from a branch` →
branche `production`, dossier `/ (root)`.** Rien d'autre. Ni DNS, ni
certificat, ni `git revert`, ni remise en cause de `NEXUS_DEPLOIEMENT_ARME`
(le laisser à `oui` est sans effet dès lors que Pages n'écoute plus les
Actions — mais le repasser à `non` coupe la source à sa racine, et c'est le
geste à préférer si l'on veut aussi empêcher une republication).

### La seule différence attendue après bascule

En mode Actions, `CNAME` n'est plus consommé : il fait partie de l'arbre
emballé et **deviendra probablement servable** (404 → 200). Son contenu est le
nom de domaine affiché dans la barre d'adresse : il n'expose rien. C'est le
seul écart connu entre « avant » et « après », il est énoncé ici pour qu'il ne
soit pas découvert comme une régression au contrôle de l'étape 4.

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

Aucune de ces quatre actions n'est exécutable depuis un workflow ni depuis un
dépôt : elles vivent dans les réglages, pas dans le code.

1. **Settings → Secrets and variables → Actions → Secrets**, créer :
   - `NEXUS_SUPABASE_URL` = `https://uzhjpqpctpvxytxpxoqz.supabase.co`
   - `NEXUS_SUPABASE_ANON_KEY` = la clé **publiable** de Production
     (`anon` / `sb_publishable_…`). **Jamais la clé de service.**
2. **Settings → Secrets and variables → Actions → Variables**, créer :
   - `NEXUS_DEPLOIEMENT_ARME` = `non` — **c'est le cran de sûreté.** Tant
     qu'il ne vaut pas `oui`, le workflow construit, éprouve et publie
     l'artefact comme pièce à conviction, et **ne déploie rien**.
3. **Settings → Environments → `github-pages`** : limiter les branches de
   déploiement à **`production`** (« Selected branches » → `production`). Un
   second verrou, indépendant de la condition écrite dans le workflow.
4. **Settings → Pages → Build and deployment → Source : `GitHub Actions`** —
   **à l'étape 4 de la procédure ci-dessous, pas avant.**

---

## 4. La procédure, dans l'ordre

Chaque étape est réversible, et le dit.

### Étape 0 — poser les secrets, la variable et l'environnement
Actions 1, 2 et 3 du §3. `NEXUS_DEPLOIEMENT_ARME` reste à `non`.
*Effet sur le site : aucun.* *Retour arrière : supprimer les entrées.*

### Étape 1 — fusionner ce lot dans `production`
Par pull request : `production` est protégée, `non-regression` est requis.
Le lot ajoute **sept fichiers** — le workflow, la garde et son épreuve, le
composeur, l'empreinte et son épreuve, le présent plan — et ne modifie que
`.gitignore`, de cinq lignes dont `_site/`.
**Aucun écran, aucun script applicatif n'est touché.** Les deux épreuves
ajoutées portent la suite du dépôt de **175 à 177** fichiers de test.

Dès la fusion, le workflow **se déclenche** sur le push. Il construira (mode
`a-l-identique`, puisque `build.sh` est absent), éprouvera l'artefact et
l'emballera. **Il n'ira pas plus loin** : `NEXUS_DEPLOIEMENT_ARME` vaut `non`.

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
qu'il faudra retrouver, inchangée, à l'étape 4. Attendu pour
`d5a8b77d…` : `998` fichiers hors chemins cachés — **999 sur le runner**, la
casse d'`icon-nexus-tempo` faisant apparaître deux entrées là où macOS n'en
voit qu'une (§2bis). Noter la valeur annoncée par l'exécution ; c'est elle qui
fait foi.

*Effet sur le site : aucun.* *C'est l'étape qui rend la suivante sûre.*

### Étape 3 — armer
Passer `NEXUS_DEPLOIEMENT_ARME` à `oui`.
*Effet sur le site : toujours aucun — Pages n'écoute pas encore les Actions.*
*Retour arrière : repasser à `non`.*

### Étape 4 — basculer la source de Pages
**Settings → Pages → Source : `GitHub Actions`.**
Puis relancer le workflow : Actions → « Déploiement Production (GitHub
Pages) » → *Run workflow* sur `production`, `deployer` = `oui`.

Le déploiement s'exécute, `configure-pages` réussit maintenant que la source
est la bonne, et Pages échange la version servie.

**Contrôle immédiat**, dans cet ordre :
1. `https://app.nexusconseil.net` s'ouvre et l'écran de connexion fonctionne ;
2. l'en-tête HTTP annonce toujours `server: GitHub.com` ;
3. l'empreinte inscrite sous « Artefact promu en Production » est **la même**
   que celle relevée à l'étape 2 — c'est la preuve qu'aucune reconstruction
   n'a eu lieu entre l'épreuve et la promotion ;
4. rejouer la confrontation du §2bis sur un échantillon : chaque fichier servi
   doit rester identique à `git show origin/production:<chemin>`. Le **seul**
   écart attendu est `CNAME`, qui peut passer de 404 à 200 (§2bis).

*Retour arrière, en quelques minutes :* **Settings → Pages → Source : `Deploy
from a branch` → `production` / `/ (root)`.** L'état d'origine est restauré
sans qu'aucun commit ne soit nécessaire — mesuré au §2bis : ce que ce retour
restitue est, à `CNAME` près, **exactement** les 997 fichiers servis
aujourd'hui, parce que la branche n'a jamais été touchée par le déploiement.

### Étape 5 — seulement ensuite, le lot applicatif
La fusion de `ea57d4b` devient possible **parce que** `outils/build.sh`
arrivera avec lui : le workflow basculera de lui-même en mode `construit`,
exécutera `bash outils/build.sh` avec `NEXUS_ENV=production`, et la garde
exigera que `nexus-config.js` soit présent et vise bien le projet de
Production.

**Cette étape n'est pas autorisée par le présent document et demande une
décision distincte.**

---

## 5. Ce que la garde contrôle, et ce qu'elle ne contrôle pas

`outils/verifier-artefact-pages.js` s'exécute avant l'emballage. Lecture
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
avertissement, sans bloquer. Conséquence à connaître le jour où l'étape 5 est
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

## 6. Permissions

| où | quoi | pourquoi |
|---|---|---|
| workflow, niveau haut | `permissions: {}` | rien par défaut |
| job `construire` | `contents: read` | lire l'arbre, rien de plus |
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

Quatre conditions cumulatives gardent le job `deployer` : branche
`production`, `NEXUS_DEPLOIEMENT_ARME == 'oui'`, déclenchement par push ou
`deployer == 'oui'`, et **le commit construit doit être celui du
déclenchement**. C'est cette dernière qui rend l'entrée `ref_applicatif`
inoffensive : elle permet de répéter le build sur n'importe quelle référence,
et ne peut jamais atteindre le déploiement.

---

## 7. L'empreinte de l'artefact

La procédure v2 tient sur une phrase : **construire une fois, éprouver
l'artefact construit, puis promouvoir exactement le même artefact.** « Le
même » n'est vérifiable que s'il porte un nom qui change dès qu'un octet
change. C'est ce que produit `outils/empreinte-artefact.js`.

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
`environnement`, `migrations_nombre` + `migrations_empreinte`,
`identifiant_build`, et la provenance (`procede`, `atelier`, `run`).

### Ce que l'épreuve contrôle

`test_empreinte_artefact_20260915.js` — **23 contrôles, 23 verts.** Ils ne
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

### Le build n'est pas reproductible — d'exactement une seconde

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
build « pour être sûr ». Le remède serait de dériver `construitLe` de la date
du commit, ou de le retirer. **Il n'est pas appliqué ici :** `poser-build-id.js`
vit sur `ea57d4b`, et ce lot ne mêle aucune évolution d'un autre lot.

### La mesure ne touche pas ce qu'elle mesure

L'outil ouvre en lecture seule, n'écrit que là où on le lui dit
(`--journal`, `--sortie`, `--resume`), et un contrôle dédié vérifie que
l'arbre mesuré est inchangé après la mesure. Aucun privilège, aucune session,
aucun secret : il ne lit que des octets de fichiers.
