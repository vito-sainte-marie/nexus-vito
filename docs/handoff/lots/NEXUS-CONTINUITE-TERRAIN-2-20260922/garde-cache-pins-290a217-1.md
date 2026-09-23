# Garde « Cohérence des épingles de cache » rouge sur `290a217f` — cause exacte, correctif mécanique, patch fourni

Réponse au réveil du 23/09/2026 (issue #28), point 1-2. Cible : `rebuild/carburants-65-20260922`
(tip `290a217f0f07d4f408469bc9cb8239814544f092`, portage des 7 fichiers déjà acquis).

## 1. Cause exacte, vérifiée

CI de cette branche (son `.github/workflows/tests.yml`, propre à cette lignée, distinct du canon) exécute :

```
- name: Cohérence des épingles de cache
  run: node outils/poser-build-id.js --verifier
```

directement sur le checkout brut, sans étape de build préalable. Sur cette lignée, `nexus-build.js`
est un fichier **versionné** (contrairement au canon actuel, où l'outil ne le committe plus jamais) —
c'est exactement le défaut historique que la refonte du 05/09/2026 documente dans son propre
en-tête. Il déclare encore, au tip `290a217f` :

```js
global.NEXUS_BUILD = { id: '20260904-0104', commit: 'b2190e5' };
```

figé depuis longtemps, pendant que le contenu réel des actifs a changé (dont, très récemment, le
portage des 7 fichiers). `--verifier` recalcule l'empreinte réelle du contenu référencé et la
compare à cette valeur committée : divergence certaine, aucune ambiguïté. Aucune logique métier
en cause — uniquement une identité de build jamais rafraîchie.

`outils/poser-build-id.js` lui-même est déjà le fichier canonique post-refonte sur ce candidat
(un des 7 fichiers portés) : vérifié **byte-identique** à `outils/poser-build-id.js` du rail
`handoff-continuite-20260920` (`diff` local, zéro sortie). Aucun changement d'outillage requis,
seulement une ré-exécution.

## 2. Recalcul — reconstruction fidèle, aucune écriture git

Ce canal ne peut ni `git checkout`, ni `git worktree add`, ni pousser vers `rebuild/carburants-65-20260922`
(confirmé de nouveau dans cette session : `git checkout -b ... <ref>` et `git push --dry-run origin
HEAD:rebuild/carburants-65-20260922` refusés — même obstacle déjà documenté dans `request-3.md`).
Seule la lecture (`git show <ref>:<chemin>`, `git diff --name-only <ref1> <ref2>`) fonctionne.

Les 174 fichiers `.html`/`.js` de racine (hors `test_*`) que balaie `outils/poser-build-id.js` ont
été reconstruits un par un par cette seule voie de lecture, dans un répertoire de travail hors dépôt
(`.scratch65/`, jamais indexé ni committé — `git status` reste propre). Exécution réelle, pas une
trace manuelle :

```
CF_PAGES_COMMIT_SHA=290a217f0f07d4f408469bc9cb8239814544f092 node outils/poser-build-id.js
→ Génération 59d2bdec4dd3 — commit 290a217 — environnement « inconnu ».
  760 référence(s) épinglée(s).

node outils/poser-build-id.js --verifier
→ Génération 59d2bdec4dd3 — 760 référence(s) épinglée(s), toutes cohérentes.
```

`environnement` a été laissé à sa valeur par défaut (« inconnu », `NEXUS_ENV` non positionné) : ce
`nexus-build.js` committé n'est vérifié que pour sa cohérence de contenu par la garde CI — il ne
sert aucun déploiement réel — et déclarer un environnement non observé serait fabriquer une
affirmation non prouvée. Le vrai build Cloudflare (`bash outils/build.sh`, qui enchaîne
`generer-config.js` puis `poser-build-id.js` sur les VRAIES variables d'environnement) réécrira ce
fichier de toute façon au prochain déploiement réussi ; l'échec actuel de ce build (`exit 127`,
`preuve-cloudflare-humaine-65-portage-1.md`) est un problème distinct, non traité ici.

**91 fichiers changent**, tous par la seule substitution de l'épingle `?v=20260904-0104` →
`?v=59d2bdec4dd3` (portée par des commentaires ou des attributs `src=`/`href=`), plus la réécriture
complète de `nexus-build.js` dans le nouveau format (identique à celui déjà généré ailleurs sur le
canon). **Aucune ligne de logique métier, de policy, de RLS ou de contenu fonctionnel modifiée.**
Vérifié par lecture des diffs eux-mêmes (`cache-pins-290a217.patch` joint), pas supposé.

## 3. Patch fourni, éprouvé par aller-retour réel

`cache-pins-290a217.patch` (joint à ce lot, format `diff -u --label a/<f> --label b/<f>`,
appliquable par `patch -p1` ou `git apply` depuis la racine du dépôt sur `rebuild/carburants-65-20260922`).

Validation réelle, pas déclarée : le patch a été appliqué (`patch -p1`, exécution réelle, pas
`--dry-run` seul) à une copie fraîche de l'arbre `290a217f` non modifié, puis comparé octet pour
octet au résultat attendu — **0 différence sur 91 fichiers** — puis `node outils/poser-build-id.js
--verifier` a été rejoué sur cet arbre patché et a confirmé la cohérence. Le patch n'est donc pas
seulement généré, il est prouvé fonctionnel de bout en bout.

## 4. Commandes exactes pour matérialiser le commit sur la cible

Depuis une session avec écriture réelle sur `rebuild/carburants-65-20260922` :

```
git fetch origin rebuild/carburants-65-20260922
git checkout -B rebuild/carburants-65-20260922 origin/rebuild/carburants-65-20260922
git apply docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/cache-pins-290a217.patch
node outils/poser-build-id.js --verifier   # doit afficher "toutes cohérentes"
node run-tests.js                          # ne doit ajouter aucun échec (aucun test_*.js touché)
git add -u
git commit -m "build: recalculer l'identite de generation apres le portage des 7 fichiers (290a217)"
git push origin rebuild/carburants-65-20260922
```

Équivalent sans le fichier `.patch` (rejoue l'outillage directement sur la cible, produit le même
résultat par construction déterministe — même contenu, même commit, même empreinte) :

```
git fetch origin rebuild/carburants-65-20260922
git checkout -B rebuild/carburants-65-20260922 origin/rebuild/carburants-65-20260922
CF_PAGES_COMMIT_SHA=$(git rev-parse HEAD) node outils/poser-build-id.js
node outils/poser-build-id.js --verifier
git add -u
git commit -m "build: recalculer l'identite de generation apres le portage des 7 fichiers"
git push origin rebuild/carburants-65-20260922
```

(Cette seconde forme retrouve `commit: 290a217f...` automatiquement si aucun autre commit n'a été
ajouté entretemps — `git rev-parse HEAD` vaudra alors `290a217f0f07d4f408469bc9cb8239814544f092`.
Si la branche a bougé depuis, l'identité déclarera honnêtement le nouveau tip, ce qui est le
comportement voulu.)

## 5. Ce qui reste hors de portée de ce canal, inchangé

Observer la nouvelle CI réelle sur le SHA obtenu (point 3 du réveil), lire les variables
d'environnement Cloudflare réelles et prouver que `nexus-config.js` servi pointe exclusivement
Supabase Test (point 4), toute recette navigateur (point 5), le dossier de gate Production (point 6) —
tous nécessitent soit l'écriture réelle sur la cible, soit un accès Cloudflare/réseau que ce canal
n'a pas. Aucun n'a été fabriqué ni supposé.
