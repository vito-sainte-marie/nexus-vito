---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: patch-request6-materialise
    classe: VERIFIED
    valeur: etape-cache-execute-bash-outils-build-sh-identique-au-patch-propose
  - id: hypotheses-legacy-list-refutees
    classe: VERIFIED
    valeur: chaine-temporelle-et-parcours-depot-passent-100pct-sur-code-candidat-isole
  - id: cause-reelle-reproduite
    classe: VERIFIED
    valeur: test_gravite_ecart_source_unique_20260916-31sur31-avant-30sur31-apres-meme-build-sh
  - id: second-cas-confirme
    classe: VERIFIED
    valeur: test_regularisation_manager_20260916-l330-versions-size-1-devient-0-apres-build
  - id: mecanisme-diagnostique
    classe: VERIFIED
    valeur: poser-build-id-js-remplace-toute-epingle-existante-par-hash-hex-frais-sur-larbre-reel
  - id: recherche-non-exhaustive
    classe: DECLARED
    valeur: git-grep-cible-8-correspondances-sur-209-fichiers-test-candidate-pas-une-execution-complete
  - id: patch-correctif-propose
    classe: VERIFIED
    valeur: isoler-build-sh-dans-copie-jetable-comme-test_build_tracabilite_20260905-49sur49-non-applique
  - id: transport-patch-canal
    classe: NOT_APPLICABLE
    valeur: ecriture-workflows-et-branche-candidate-hors-portee-de-ce-canal
  - id: isolation-supabase-test-reelle
    classe: NOT_APPLICABLE
    valeur: non-mesuree-ci-toujours-rouge-aucune-navigation-tentee
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-conformes
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Diagnostic — la candidate régresse par le patch lui-même (`664af985`), pas par le portage ni par une dérive de liste

Réponse au réveil du 23/09/2026 (issue #28) : traiter `request-6.md` comme techniquement dépassé
par le transport déjà matérialisé (confirmé ci-dessous), diagnostiquer précisément pourquoi
« Comparer aux échecs connus » échoue sur `664af9853481cb6676a900dd37f89257898c4a20`, et distinguer
test nouvellement rouge / test historiquement réparé / dérive de la liste legacy.

## 1. Méthode

Lecture seule (`git show <ref>:<chemin>`, `git cat-file -e`, `git diff --name-only <arbre-vide>
<ref>` pour lister un arbre entier sans `git ls-tree` — refusé par le harnais comme `git
fetch`/`checkout`/`worktree`/`archive` —, `git grep <motif> <ref> -- <glob>` pour chercher DANS le
contenu d'une ref sans la extraire fichier par fichier) **plus, nouveau dans ce diagnostic, une
reproduction empirique isolée** : les outils de build (`outils/generer-config.js`,
`outils/poser-build-id.js`, identiques rail/candidate depuis `request-5.md`) et des fichiers
extraits un à un via `git show` sont exécutés dans un répertoire de travail jetable, hors du dépôt
Git (aucun `checkout`/`worktree`, uniquement `node <fichier>.js` et le tool `Write` — les deux déjà
prouvés utilisables dans ce canal). Chaque affirmation ci-dessous a été **exécutée**, pas déduite.

## 2. Confirmation — le transport de `request-6.md` est bien matérialisé, ne le redemande pas

`git show 664af9853481cb6676a900dd37f89257898c4a20:.github/workflows/tests.yml` : l'étape
« Cohérence des épingles de cache » exécute désormais exactement le patch proposé par
`request-6.md` (`bash outils/build.sh` avec `NEXUS_ENV=test`, l'URL réelle du projet Test
`udljdqxerrbbbajxubfn` et la clé anonyme fictive `sb_publishable_essai0000000000`, déjà utilisée
49 fois ailleurs dans le dépôt). Confirmé caractère pour caractère. **Ne pas redéposer ce
transport.**

## 3. Deux hypothèses testées, et réfutées — pour ne pas les retraiter

Le réveil demandait explicitement de distinguer trois causes possibles. La première explorée —
« les deux échecs connus du rail (`test_chaine_temporelle_carburant_20260821.js`,
`test_inventaire_parcours_depot_boutique_reste.js`), absents de la liste figée à 7 entrées de la
candidate (datée du 04/09), sont une simple dérive de liste » — a été **directement testée et
réfutée** :

- `chargerControleJour` sur la candidate (`nexus-carburant-donnees.js`) prend encore 3 arguments et
  ne lève PAS l'erreur « timezone obligatoire » qui cause l'échec sur le rail — repli explicite
  `'America/Martinique'`, comportement PRÉ-durcissement (09/09/2026). **Exécuté avec les
  dépendances réelles de la candidate : 16/16, tout passe.**
- `test_inventaire_parcours_depot_boutique_reste.js` sur la candidate charge déjà explicitement
  `nexus-station.js`/`nexus-inventaire-moteur.js` avant le script de l'écran — contrairement à ce
  que documente le motif du rail (« le bac à sable n'ouvre jamais nexus-station.js »). **Exécuté
  avec les dépendances réelles de la candidate : 8/8, tout passe.**

Ces deux tests ne contribuent donc PAS à l'échec de « Comparer aux échecs connus » : ils ne
figureraient même pas dans la sortie de `run-tests.js` (qui n'imprime un nom de fichier que s'il
échoue). La dérive de liste existe bien entre le rail et la candidate, mais elle n'est pas ce qui
casse la CI ici.

## 4. La cause réelle — le patch mute l'arbre réel avant la suite de tests, et ce n'est démontré nulle part comme sûr

`outils/build.sh` (identique rail/candidate) ne construit PAS dans une copie : `cd "$RACINE"` puis
mutation en place. Deux effets, sur le vrai checkout que « Suite de non-régression » va ensuite
lire :

1. `outils/generer-config.js` insère `<script src="nexus-config.js">`,
   `<script src="nexus-page.js">`, `<script src="nexus-bandeau-environnement.js">` avant
   `nexus-auth.js` dans chaque écran, et réécrit `robots.txt`.
2. `outils/poser-build-id.js` **retire toute épingle `?v=` existante puis en pose une neuve**, sur
   TOUS les actifs référencés, HTML et JS confondus (`BALISE`/`INJECTION`, `outils/poser-build-id.js:87-91`).
   L'épingle neuve est une empreinte de contenu **hexadécimale** (`crypto.createHash('sha256')...slice(0,12)`)
   — donc potentiellement porteuse de lettres `a`-`f`.

Le rail lui-même **n'exerce jamais cette combinaison** : `test_build_tracabilite_20260905.js`
lance `bash outils/build.sh` explicitement « dans une copie jetable » (`fs.rmSync` puis build dans
un répertoire séparé), précisément pour ne jamais laisser cette mutation atteindre l'arbre que
`run-tests.js` va lire ensuite. Le patch de `request-6.md`, une fois câblé tel quel dans la CI
candidate, fait l'inverse : il construit **sur place**, dans le même job, avant l'étape suivante.
Personne n'avait encore éprouvé cette combinaison précise.

## 5. Deux cas concrets, reproduits avec avant/après sur le contenu réel de la candidate

**Cas 1 — `test_gravite_ecart_source_unique_20260916.js`** (présent sur la candidate, absent du
rail). Ligne 68 : `/<script src="nexus-verify-moteur\.js\?v=[0-9-]+"><\/script>/.test(SOURCE)` —
n'accepte que des chiffres et un tiret. `NEXUS-Mon-Evolution-v1.html` sur la candidate porte,
**committé**, `<script src="nexus-verify-moteur.js?v=20260904-0104"></script>` — un horodatage,
format hérité d'avant la refonte du 05/09/2026 de `poser-build-id.js`.

| État de l'arbre | Résultat mesuré |
|---|---|
| Committé, non construit (celui que « Comparer aux échecs connus » testait AVANT le patch de request-6) | **31/31, exit 0** |
| Après `bash outils/build.sh` (ce que fait désormais l'étape précédente) | **30/31, exit 1** — `✗ nexus-verify-moteur.js est inclus par la page` |

Épingle observée après build : `nexus-verify-moteur.js?v=c01368ba766d` — contient des lettres,
`[0-9-]+` ne matche plus.

**Cas 2 — `test_regularisation_manager_20260916.js:330`** (présent sur la candidate, absent du
rail), même mécanisme sur un autre écran (`NEXUS-Cockpit-v2.html`) :
```js
const versions = new Set((COCKPIT.match(/\?v=[0-9-]+/g) || []));
assert.strictEqual(versions.size, 1, ...);
```
Avant build : au moins une épingle chiffres-tiret committée → `versions.size === 1`, passe. Après
build : toutes les épingles deviennent hexadécimales, aucune ne matche `[0-9-]+` →
`versions.size === 0` → `assert.strictEqual(0, 1)` échoue.

**Recherche non exhaustive** : ces deux cas ont été trouvés par `git grep 'script src=' <candidate>
-- 'test_*.js'` (8 correspondances au total), pas par l'exécution complète des 209 fichiers
`test_*.js` de la candidate (hors de portée : recomposer chaque test nécessiterait d'extraire
individuellement, via `git show`, l'intégralité de ses dépendances — aucun moyen de lister ou
d'archiver l'arbre entier dans ce canal). **D'autres occurrences de la même classe de défaut
peuvent exister sur la candidate, non recensées ici.**

## 6. Classification demandée par le réveil

- **Test nouvellement rouge** : non — ni `nexus-carburant-donnees.js`, ni les écrans concernés,
  ni les tests eux-mêmes n'ont été touchés par le portage des 7 fichiers (identiques rail/candidate,
  `request-5.md`). Aucun changement de contenu applicatif n'explique ces deux échecs.
- **Test historiquement réparé** : non — ces deux tests n'existent pas sur le rail ; ils n'ont donc
  ni motif dans `docs/qa/ECHECS-CONNUS.json`, ni statut « réparé ».
- **Dérive de la liste legacy** : partielle et non causale — la liste à 7 entrées de la candidate
  est bien datée (04/09), mais ce n'est pas elle qui casse la CI ici (§3).
- **Ce que c'est réellement** : une **régression mécanique introduite par le patch de
  `request-6.md` lui-même**, une fois câblé tel quel dans la CI candidate — un défaut de conception
  de l'étape (construire sur l'arbre réel plutôt que dans une copie), pas un défaut du contenu
  applicatif de PR #65.

## 7. Ce qui n'est pas corrigé ici, et pourquoi

Le correctif propre est mécanique et déjà éprouvé ailleurs sur ce dépôt (49/49,
`test_build_tracabilite_20260905.js`) : isoler `bash outils/build.sh` dans une copie jetable pour
CETTE étape CI, exactement comme le rail le fait déjà pour sa propre épreuve de traçabilité,
au lieu de construire sur le checkout que la suite va relire. Patch minimal proposé, **non
appliqué** :

```yaml
      - name: Cohérence des épingles de cache
        env:
          NEXUS_ENV: test
          NEXUS_SUPABASE_URL: https://udljdqxerrbbbajxubfn.supabase.co
          NEXUS_SUPABASE_ANON_KEY: sb_publishable_essai0000000000
        run: |
          set -euo pipefail
          copie="$(mktemp -d)"
          cp -a . "$copie"/
          rm -rf "$copie"/.git
          (cd "$copie" && bash outils/build.sh)
```

Non appliqué pour deux raisons distinctes, aucune contournée : (a) `.github/workflows/*.yml` n'est
pas modifiable par cet agent, sur aucune branche ; (b) l'écriture Git vers
`rebuild/carburants-65-20260922` reste refusée par le harnais dans ce canal (non retentée,
conforme aux constats déjà consignés dans `preuve-cloudflare-humaine-65-portage-1.md` et
`request-6.md`). Ce patch ne touche que l'étape CI de la candidate ; il ne modifie ni PR #65, ni
`main`, ni `production`.

Une seconde option existe et n'est PAS recommandée sans arbitrage : figer/committer une épingle
`?v=` hexadécimale dans les fixtures des deux tests concernés — cela corrigerait le symptôme sans
traiter la cause (la prochaine fixture au format hérité casserait de la même façon), et modifier le
contenu de PR #65 dépasserait le périmètre « transport mécanique » de ce lot.

## 8. Ce que ceci ne prouve toujours pas

Une fois ce patch appliqué et « Comparer aux échecs connus » rejoué, cela ne prouverait toujours
PAS le ciblage Supabase Test réel (fait n°2 de `etude-isolation-test-candidats-web-1.md` §4) ni ce
qu'un déploiement Cloudflare réel de cette candidate sert — inchangé depuis `request-4.md`/
`request-6.md`. **La candidate n'est PAS déclarée prête.** Aucune navigation n'a été tentée,
conformément à l'instruction explicite de ce réveil.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé (seules les valeurs déjà publiques/fictives citées dans `request-6.md`
apparaissent), aucune nouvelle règle métier/UX/RLS/rôle, PR #65 non modifiée, aucun fichier
applicatif touché (diff limité à `docs/handoff/`), aucune tentative d'écriture Git superflue
(fetch/checkout/worktree/archive/ls-tree refusés, non retentés), aucune sollicitation de Frédéric
pour ce diagnostic technique intermédiaire.
