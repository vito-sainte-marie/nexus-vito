# Preuve — harnais réalignés, exécutés réellement sur l'arbre candidate (`decision-8.md`)

Exécution du réveil « poursuite déterministe, `decision-8.md` en réponse à `request-9.md` »
(commit `1b8521b30f48e376204077904497dabe9f8d2ef9`). `decision-8.md` a été consommée via
`node outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-2-20260922` avant tout autre geste ;
les miroirs v1 ont été régénérés (`node outils/handoff.js miroirs`), registre revalidé conforme
après (32 lots, 15 avertissements, 11 dérogations, 0 nouvelle erreur).

## 0. HEAD de ce checkout

`HEAD` = `1b8521b30f48e376204077904497dabe9f8d2ef9` = `origin/handoff-continuite-20260920` = le
commit de `decision-8.md` cité par le réveil. Aucun obstacle de racine `main` cette fois.
`origin/rebuild/carburants-65-20260922` était déjà présent localement (`664af98`, plus récent que
les `290a217`/`fe36a8e` connus de `request-9.md`) : lu exclusivement via `git show <ref>:<chemin>`
et `git diff --name-only <ref1> <ref2>` (seules commandes de lecture distante autorisées dans ce
canal) — `git fetch`, `git ls-tree`, `git worktree add`, `git archive` refusent tous une approbation
qu'aucun humain ne peut donner ici, retesté explicitement dans cette session, comme documenté par
les réveils précédents.

## 1. `nexus-auth-corrige-65-20260923.js` — non transporté, conformément à decision-8 §1

Aucune action. Le fichier reste dans `docs/handoff/lots/…/nexus-auth-corrige-65-20260923.js`
(archive documentaire), jamais copié sur `nexus-auth.js`. Confirmé à nouveau : `nexus-auth.js`
local (rail) et `git show origin/rebuild/carburants-65-20260922:nexus-auth.js` sont identiques
octet pour octet (`diff` vide).

## 2. Le harnais réaligné sur les dépendances runtime — exactement le périmètre autorisé

Patch appliqué **uniquement** aux deux fichiers de test (diffs complets ci-dessous) :

- ajout de `window.NEXUS_CONFIG` (déjà autorisé par `decision-7.md` Point 1) — configuration Test
  minimale (`environnement`, `supabaseUrl`, `supabaseCle`), aucune vraie clé, `fetch` reste interdit
  dans le banc (`throw new Error('réseau interdit')`) donc aucun accès réseau n'en découle ;
- `ctx.NexusBuild = { versionner: (src) => src }` — stub d'infrastructure neutralisé. Vérifié
  **avant** d'écrire le patch : aucune des deux suites de test ne contient les mots `versionner`,
  `NexusBuild` ou `build` dans une assertion (`grep` sur les fichiers originaux, sortie vide dans
  les deux cas) — condition explicite de `decision-8.md` §2 pour autoriser ce stub ;
- chargement réel de `nexus-page.js` (`vm.runInContext(PAGE, ctx)`), puis
  `ctx.NexusPage = ctx.window.NexusPage;`. Nécessaire parce que `nexus-page.js` assigne son API à
  `global = (typeof window !== 'undefined' ? window : globalThis)` — dans le banc, `window` est un
  sous-objet distinct de l'objet global vm (`ctx`), donc l'assignation atterrit sur
  `ctx.window.NexusPage`, jamais sur le `NexusPage` bare que `nexus-auth.js` lit. C'est la seule
  ligne qui « adapte le harnais au contrat runtime » sans réimplémenter `nexus-page.js` (interdit
  par `decision-8.md`).

Aucune ligne de `nexus-auth.js` modifiée. Aucune assertion des deux fichiers modifiée. Aucun
artefact `nexus-build.js` généré ou commité.

### Diff exact — `test_regularisation_manager_20260916.js`

```diff
--- origin/rebuild/carburants-65-20260922:test_regularisation_manager_20260916.js
+++ test_regularisation_manager_20260916-harnais-realigne-1.js
@@ -32,6 +32,12 @@
 const SOURCE  = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
 const REGLES  = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');
 const COCKPIT = fs.readFileSync(path.join(__dirname, 'NEXUS-Cockpit-v2.html'), 'utf8');
+// decision-8 (23/09/2026) : nexus-auth.js exige désormais nexus-build.js et
+// nexus-page.js au chargement (portage 290a217). Le vrai nexus-page.js est
+// chargé tel quel dans le banc — son identité de page influence réellement
+// le résultat (chargement conditionnel de scripts) ; NexusBuild reçoit un
+// stub, voir banc() ci-dessous.
+const PAGE = fs.readFileSync(path.join(__dirname, 'nexus-page.js'), 'utf8');
 
 // File d'attente, puis `await` : une assertion posée après une écriture
 // asynchrone non attendue passe au vert avant que l'écriture n'ait lieu.
@@ -71,7 +77,13 @@
   };
   const ctx = {
     supabase: { createClient: () => client },
-    window: { location: { pathname: '/NEXUS-Cockpit-v2.html', search: '', href: '' } },
+    window: {
+      location: { pathname: '/NEXUS-Cockpit-v2.html', search: '', href: '' },
+      // decision-8 (23/09/2026) : nexus-auth.js refuse de démarrer sans
+      // nexus-config.js. Configuration Test minimale, jamais de vraie clé —
+      // `fetch` reste interdit plus bas, aucun réseau n'en découle.
+      NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.invalid', supabaseCle: 'stub' },
+    },
     document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
                 addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
     console: {
@@ -83,6 +95,21 @@
   };
   ctx.globalThis = ctx;
   vm.createContext(ctx);
+  // decision-8 §2 : NexusBuild.versionner n'est asserté par aucun test de ce
+  // fichier (ni génération de build-id, ni versionnement d'URL) — un stub
+  // d'identité neutre est donc autorisé plutôt que de committer un artefact
+  // de build. NexusPage, lui, influence réellement le comportement
+  // (chargement conditionnel de scripts selon la page) : le vrai fichier est
+  // exécuté, jamais réimplémenté.
+  ctx.NexusBuild = { versionner: (src) => src }; // stub d'infrastructure neutralisé, non métier
+  vm.runInContext(PAGE, ctx);
+  // nexus-page.js assigne son API à `window` (ou globalThis si window est
+  // absent) : ici `window` est un sous-objet distinct de l'objet global vm,
+  // donc l'assignation atterrit sur `ctx.window.NexusPage`. nexus-auth.js lit
+  // l'identifiant bare `NexusPage`, comme dans un vrai navigateur où
+  // `window === globalThis` — on relie donc les deux plutôt que de dupliquer
+  // la logique de nexus-page.js dans ce banc.
+  ctx.NexusPage = ctx.window.NexusPage;
   if (avecRegles) vm.runInContext(REGLES, ctx);
   vm.runInContext(SOURCE, ctx);
   return { ctx, journal };
```

### Diff exact — `test_cloture_services_obsoletes_20260916.js`

```diff
--- origin/rebuild/carburants-65-20260922:test_cloture_services_obsoletes_20260916.js
+++ test_cloture_services_obsoletes_20260916-harnais-realigne-1.js
@@ -28,6 +28,10 @@
 
 const SOURCE = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
 const REGLES = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');
+// decision-8 (23/09/2026) : nexus-auth.js exige désormais nexus-build.js et
+// nexus-page.js au chargement (portage 290a217). Le vrai nexus-page.js est
+// chargé tel quel dans le banc ; NexusBuild reçoit un stub, voir banc().
+const PAGE = fs.readFileSync(path.join(__dirname, 'nexus-page.js'), 'utf8');
 
 // Les vérifications sont MISES EN FILE, puis exécutées l'une après l'autre
 // avec `await`. Première rédaction de ce fichier : `verifier` appelait fn()
@@ -87,7 +91,12 @@
 
   const ctx = {
     supabase: { createClient: () => client },
-    window: { location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' } },
+    window: {
+      location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' },
+      // decision-8 (23/09/2026) : nexus-auth.js refuse de démarrer sans
+      // nexus-config.js. Configuration Test minimale, jamais de vraie clé.
+      NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.invalid', supabaseCle: 'stub' },
+    },
     document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
                 addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
     console: {
@@ -99,6 +108,13 @@
   };
   ctx.globalThis = ctx;
   vm.createContext(ctx);
+  // decision-8 §2 : aucune assertion de ce fichier ne porte sur la
+  // génération du build-id ni le versionnement d'URL — stub neutre autorisé
+  // pour NexusBuild. NexusPage est en revanche le vrai fichier committé.
+  ctx.NexusBuild = { versionner: (src) => src }; // stub d'infrastructure neutralisé, non métier
+  vm.runInContext(PAGE, ctx);
+  // Voir le même bridge, expliqué dans test_regularisation_manager_20260916.js.
+  ctx.NexusPage = ctx.window.NexusPage;
   if (avecRegles) vm.runInContext(REGLES, ctx);
   vm.runInContext(SOURCE, ctx);
   return { ctx, journal };
```

## 3. Exécution réelle — zone de travail locale, jamais commitée sur `handoff-continuite-20260920`

Les deux harnais patchés ont été exécutés (`node test_*.js`) dans une zone de travail temporaire
(`.scratch-continuite-2/`, supprimée avant la fin de cette session — `git status` propre vérifié),
peuplée fichier par fichier par `git show origin/rebuild/carburants-65-20260922:<chemin>` : les deux
`nexus-auth.js`/`nexus-page.js` locaux ont été réutilisés (confirmés octets identiques au candidate),
`nexus-pointage-regles.js`, `NEXUS-Cockpit-v2.html`, `NEXUS-Pointage-v1.html`,
`NEXUS-App-v1.html`, `NEXUS-Brief-v1.html`, `NEXUS-Inventaire-v1.html`, `NEXUS-Missions-v1.html` ont
été extraits du candidate (ces 6 derniers sont les seuls écrans qui, localement, appellent
`nexusServiceCourant(` — utilisés pour l'épreuve « six consommateurs » de la section 5 du second
harnais). Un fichier vide a été posé sous
`supabase/migrations/20260916195000_cloture_source_cycle_pilote.sql` (la seule assertion qui le
consulte teste `fs.existsSync`, pas le contenu).

**Limite honnête sur cette reconstruction** : `git ls-tree`, `git worktree add` et `git archive`
refusent tous une approbation dans ce canal — seule une liste **connue à l'avance** de fichiers a pu
être extraite (via `git show`), pas une liste exhaustive du répertoire candidate. Si candidate porte
un septième écran qui appelle `nexusServiceCourant(` sans que je le sache, il n'a pas été inclus ;
cela ne peut invalider un résultat **rouge** (déjà constaté ci-dessous), seulement laisser un doute
sur un résultat vert hypothétique — qui ne s'est pas produit.

### 3.1 Preuve négative — sans le patch, sur ce HEAD candidate réel

```
$ node test_regularisation_manager_20260916.js   (fichier original, non patché)

── 1 · La source de clôture est un catalogue, pas une chaîne recopiée ──

✗ NEXUS ne peut pas démarrer : nexus-config.js n'a pas été chargé. […]

$ node test_cloture_services_obsoletes_20260916.js   (fichier original, non patché)

── 1 · Le service de la veille est refermé, sans heure de fin ──

✗ NEXUS ne peut pas démarrer : nexus-config.js n'a pas été chargé. […]
```

Confirme, indépendamment, le constat déjà établi par `request-9.md` sur ce même commit candidate.

### 3.2 Preuve positive — avec le patch, le chargement passe

```
$ node test_regularisation_manager_20260916.js   (patché, decision-8)

── 1 · La source de clôture est un catalogue, pas une chaîne recopiée ──
OK — les deux sources vivent dans le module de règles
OK — nexus-auth.js ne recopie aucune de ces deux valeurs

── 2 · La lecture d'équipe : bornée au site, sans garde de rôle ──

✗ ctx.nexusServicesOuvertsDuSite is not a function
```

```
$ node test_cloture_services_obsoletes_20260916.js   (patché, decision-8)

── 1 · Le service de la veille est refermé, sans heure de fin ──

✗ exactement une écriture

0 !== 1
```

**Le patch fonctionne exactement comme prévu par `decision-8.md`** : le module `nexus-auth.js` se
charge désormais dans les deux bancs (`NEXUS_CONFIG`/`NexusBuild`/`NexusPage` tous satisfaits), et
les deux premières assertions du premier harnais — qui portent réellement sur le contenu métier
(`NexusPointageRegles.SOURCE_CLOTURE_PILOTE`, absence de littéral `'cycle_pilote'` dans
`nexus-auth.js`) — passent au vert. Le second harnais dépasse lui aussi le garde-fou de chargement.

## 4. Ce que cette exécution révèle : un fait matériel nouveau, plus profond que le garde-fou de chargement

`decision-8.md` anticipait que, une fois les dépendances runtime fournies, les harnais
« doivent atteindre leurs assertions métier ». Exécutés réellement, **ils l'atteignent — et
échouent dessus**, pour une raison qui n'est ni le harnais ni `NexusBuild`/`NexusPage` :

**Harnais 1 (`test_regularisation_manager_20260916.js`)** — les fonctions que le test appelle
(`nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`, `nexusAppliquerCloturePilote`,
`nexusEstManager`, `nexusCloturerServicesObsoletes`) **n'existent nulle part dans `nexus-auth.js`** :

```
$ grep -n "ServicesOuverts\|Regulariser\|CloturePilote\|EstManager\|CloturerServicesObsoletes" nexus-auth.js
(aucune sortie)
```

Vérifié à la fois sur le `nexus-auth.js` du rail (`handoff-continuite-20260920`) et sur celui
extrait de `origin/rebuild/carburants-65-20260922` — identiques, et **aucun des deux ne contient ces
cinq fonctions**. Vérifié aussi sur `origin/main` (`5b047e008c07746b1c91846e50247ee594e07314`) :
même résultat, aucune des cinq. Seule fonction pointage présente dans les trois : `nexusServiceCourant`
(ligne 214 du fichier local, 305 lignes au total).

**Harnais 2 (`test_cloture_services_obsoletes_20260916.js`)** — `nexusServiceCourant` existe bel et
bien, mais c'est la version **antérieure** au 16/09/2026 : elle lit les services `en_cours` de
l'employé, filtre sur la date locale de l'**appareil** (`nexusDateLocaleISO(new Date())`, jamais
`sites.timezone`), et si le service trouvé n'est pas celui du jour, elle se contente d'un
`console.error` (« … ignoré(s) — le service de la veille n'est jamais réutilisé ») **sans jamais
écrire d'UPDATE pour le refermer**. Exactement ce que la première assertion du harnais mesure et
que l'exécution ci-dessus confirme (`0 !== 1`, zéro UPDATE émis).

**Cause plausible, non tranchée ici** : `290a217` (« porter la chaîne de build/config du rail — 7
fichiers, mécanique ») a explicitement porté `nexus-auth.js` depuis le rail pour y greffer les
gardes `NEXUS_CONFIG`/`NexusBuild`/`NexusPage`. Ce portage, décrit comme « mécanique », semble avoir
apporté la version du rail **antérieure** au 16/09/2026 — au moment même où les autres pièces de la
même fonctionnalité (règles dans `nexus-pointage-regles.js`, UI dans `NEXUS-Cockpit-v2.html`,
migration `20260916195000_cloture_source_cycle_pilote.sql`) étaient, elles, déjà présentes ou
apportées séparément sur `rebuild/carburants-65-20260922`. Je ne corrige pas cette hypothèse ici :
la trancher demanderait de retracer l'historique complet de trois branches (rail, candidate, main)
au-delà de ce que ce canal peut faire sans `git log -p`/`git blame` sur des refs distantes non
fetchées (également refusés — retesté, voir §0).

## 5. Pourquoi ce retour s'arrête ici, conformément à `decision-8.md`

Le patch de harnais est **prouvé, correct, et exactement dans le périmètre autorisé** — mais il ne
suffit plus à faire passer les assertions métier, pour une cause qui n'est ni un défaut de harnais
ni un défaut de `NexusBuild`/`NexusPage`. C'est exactement la clause d'arrêt de `decision-8.md` §STOP
(« les harnais échouent encore après fourniture correcte des dépendances runtime » → retour par
`request-N.md`), et le mandat qui déclenche ce réveil l'interdit explicitement par ailleurs
(« aucune règle métier/UX/RLS/rôle »). Écrire les cinq fonctions manquantes ou réécrire
`nexusServiceCourant` pour fermer les services obsolètes serait précisément cela — une décision
métier/UX (quel motif, quelle source de clôture, qui peut agir), pas un ajustement d'infrastructure
de test. Je ne l'ai donc pas fait.

**Conséquence directe** : « exécuter ensuite seulement la suite candidate complète » (`decision-8.md`
§3) ne s'applique pas — cette étape est explicitement conditionnée à des harnais qui « atteignent
leurs assertions métier », ce qui n'est pas le cas. Je n'ai donc pas exécuté `run-tests.js` sur une
reconstruction partielle de l'arbre candidate : cela produirait un total dont la signification serait
trompeuse (des centaines de fichiers candidate non reconstruits, faute de `git ls-tree`/`worktree`/
`archive` — voir §0 et §3), sans même répondre à la question posée par `decision-8.md`.

## 6. Transport — écriture candidate toujours inaccessible, diff persisté conformément à `decision-8.md` §5

`git push` vers `rebuild/carburants-65-20260922` (et vers toute branche distante autre que celle de
cette session) refuse une approbation qu'aucun humain ne peut donner dans ce run automatisé — retesté
implicitement par l'échec de `git fetch`/`git ls-tree`/`git archive`/`git worktree add` ci-dessus,
tous soumis à la même contrainte. Conformément à `decision-8.md` §5, aucune gate Créateur n'est
demandée pour ce seul obstacle de transport Git non-Production : le diff exact est persisté ici et
dans les deux fichiers `*-harnais-realigne-1.js` du présent lot, sur la branche de travail de cette
session (`handoff-continuite-20260920`, la branche canonique elle-même — ce commit y est déposé
directement, comme les fois précédentes de ce fil).

## Guardians

- **Architecture & Cohérence** : le patch touche exclusivement les deux fichiers de test ; aucune
  ligne de `nexus-auth.js`/`nexus-page.js`/`nexus-pointage-regles.js` modifiée ; aucune duplication
  de la logique de `nexus-page.js` (chargée réellement, jamais réimplémentée).
- **Security & Isolation** : aucun secret, aucune opération réseau/Supabase (`fetch` lève une
  exception dans les deux bancs), zone de travail locale supprimée avant la fin de la session.
- **Business Rules** : **aucune règle métier ajoutée ni modifiée** — c'est précisément le constat de
  ce retour : cinq fonctions métier attendues par le harnais candidate sont absentes de
  `nexus-auth.js`, sur rail, candidate et `main`. Ce fait est rapporté, pas corrigé.
- **QA/Regression** : preuve négative (sans patch, échec au chargement) et preuve positive (avec
  patch, chargement réussi, échec métier réel et mesuré) toutes deux réexécutées dans cette session,
  pas supposées.
- **Bible/Philosophie** : préférence donnée à rapporter un fait matériel nouveau et non prévu par
  `decision-8.md`, plutôt que d'élargir silencieusement le périmètre en écrivant la logique métier
  manquante pour obtenir un vert.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase Production/NEXUS Production, aucun
secret/PIN/service_role, aucune règle métier/UX/RLS/rôle ajoutée, aucun fichier applicatif touché
(diff limité aux deux fichiers de test persistés dans ce lot et à ce document). Zone de travail
locale supprimée avant la fin de la session, `git status` propre vérifié.
