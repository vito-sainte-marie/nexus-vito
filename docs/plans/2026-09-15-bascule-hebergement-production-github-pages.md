# Bascule de l'hébergement Production — branche → GitHub Actions

**Rédigé le 15/09/2026. Rien n'est engagé : ce document décrit une procédure,
il ne l'exécute pas.** Aucun réglage GitHub Pages n'a été modifié, aucun DNS
touché, `ea57d4b` n'est pas fusionné.

Ce lot est **autonome**. Il ne contient ni `ea57d4b`, ni les deux migrations
différées, ni le lot de projection, ni `2c1550f`, et n'en dépend pas.

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
`actions/upload-pages-artifact` exclut `.git` et `.github`, exactement les
deux ensembles que Pages n'expose pas non plus en mode branche. L'ensemble
publié est donc le même, fichier pour fichier.

**b. Pages ne remplace le site qu'une fois le nouvel artefact prêt.** Le
basculement est un échange de version, pas une reconstruction sur place :
l'ancienne version reste servie jusqu'à ce que la nouvelle soit complète. Il
n'existe pas de fenêtre où le site est vide.

Le domaine personnalisé ne bouge pas : il est enregistré dans les réglages du
dépôt **et** présent dans `CNAME`, lui-même inclus dans l'artefact. **Aucun
changement DNS n'est nécessaire, et aucun n'est prévu.**

### Le seul écart de contenu, mesuré

Le mode branche passe l'arbre par Jekyll ; le mode Actions ne le fait pas.
L'effet réel a été mesuré : il porte sur **deux entrées seulement** —
`.gitignore` et `supabase/.gitkeep`, que Jekyll masque et qu'Actions
exposerait. Aucun écran, aucun script, aucune image n'est concerné. Si cette
exposition n'est pas souhaitée, elle se règle par un `.nojekyll` ou une
exclusion, **hors de ce lot**.

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
Le lot ajoute trois fichiers et n'en modifie aucun — aucun écran n'est touché.

Dès la fusion, le workflow **se déclenche** sur le push. Il construira (mode
`a-l-identique`, puisque `build.sh` est absent), éprouvera l'artefact et
l'emballera. **Il n'ira pas plus loin** : `NEXUS_DEPLOIEMENT_ARME` vaut `non`.

*Effet sur le site : aucun — Pages est toujours en mode branche.*
*Retour arrière : révoquer la PR.*

### Étape 2 — lire l'artefact avant qu'il ne serve
Dans l'exécution du workflow : ouvrir le job `construire`, vérifier
que la garde a écrit « Artefact accepté », et **télécharger l'artefact**
(`github-pages`) pour le comparer à l'arbre de `production`. Il doit être
identique, aux exclusions `.git` / `.github` près.

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
3. `sha256` d'un fichier servi — `nexus-auth.js` — toujours identique à celui
   de la branche.

*Retour arrière, en quelques minutes :* **Settings → Pages → Source : `Deploy
from a branch` → `production` / `/ (root)`.** L'état d'origine est restauré
sans qu'aucun commit ne soit nécessaire.

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
environnement ou un autre projet Supabase (C1–C4) ; et les **formes** de
secrets S1 à S6 (clé `sb_secret_`, JWT de rôle non publiable, chaîne de
connexion PostgreSQL avec mot de passe, clé privée PEM avec corps base64,
valeur affectée à une variable de clé de service).

`test_verifier_artefact_pages_20260915.js` mute dans le contrat de chacune de
ces règles — 25 contrôles, chacun fabriquant l'arbre qui viole exactement une
règle, plus les cas légitimes qui doivent passer. **C'est ce test qui a
révélé que la règle S4 ne mordait pas** : examinée ligne par ligne, elle ne
pouvait jamais voir un corps PEM, qui vit toujours sur la ligne suivante de
son en-tête. Verte et inutile. Corrigée.

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

Quatre conditions cumulatives gardent le job `deployer` : branche
`production`, `NEXUS_DEPLOIEMENT_ARME == 'oui'`, déclenchement par push ou
`deployer == 'oui'`, et **le commit construit doit être celui du
déclenchement**. C'est cette dernière qui rend l'entrée `ref_applicatif`
inoffensive : elle permet de répéter le build sur n'importe quelle référence,
et ne peut jamais atteindre le déploiement.
