# Preuve — harnais réalignés (`decision-8.md` §2), exécution réelle, régression trouvée

Exécution du réveil « poursuite déterministe du lot actif », consommation de `decision-8.md`
(`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-9.md`). Ce document porte
la preuve exigée par `decision-8.md` §3 : « exécuter réellement les deux harnais sur l'arbre
candidate actuel ».

Toutes les commandes ci-dessous ont été exécutées dans une zone de travail locale temporaire,
jamais commitée (`.scratch-harnais-65/`, supprimée avant la fin de cette session — `git status`
propre, vérifié). Les fichiers extraits l'ont été en lecture seule depuis
`origin/rebuild/carburants-65-20260922` (`git show <ref>:<chemin>`), sans écriture sur cette
branche.

## 1. Refs protégées, inchangées

```
main       = 5b047e008c07746b1c91846e50247ee594e07314
production = 2bc7b39dd73a35d8031f850e202095370a1db85a
candidate  = 664af9853481cb6676a900dd37f89257898c4a20 (rebuild/carburants-65-20260922)
```

Identiques à celles citées par `request-9.md` (`main`, `production`) ; `candidate` a avancé d'un
commit CI-only (`664af98`, workflow uniquement, voir §5).

## 2. Réalignement des deux harnais — appliqué et exécuté, exactement le périmètre autorisé

Conformément à `decision-8.md` §2 : `window.NEXUS_CONFIG` conservé ; le vrai `nexus-page.js`
committé de la candidate est chargé/exécuté dans le même contexte `vm` (jamais réinventé dans un
stub) ; `NexusBuild` reçoit un stub minimal d'identité (`{ versionner: s => s }`), documenté comme
dépendance d'infrastructure neutralisée — vérifié au préalable qu'aucune assertion des deux fichiers
ne dépend de la génération réelle du build-id ou du versionnement d'URL (le seul contrôle `?v=` du
fichier 1, section 6, lit directement le HTML committé `NEXUS-Cockpit-v2.html`, jamais la sortie de
cette primitive). Aucune modification de `nexus-auth.js`. Aucune assertion métier changée. Aucun
artefact `nexus-build.js` généré ni commité.

Le bridge `ctx.NexusPage = ctx.window.NexusPage` après exécution de `nexus-page.js` reprend
**exactement** le raccourci déjà établi et documenté sur le rail par
`test_pointage_interrupteur_global.js:66-71` (« dans un navigateur, `window` EST l'objet global »)
— aucune nouvelle convention inventée pour ce lot.

### Diff exact — `test_regularisation_manager_20260916.js`

```diff
--- candidate-avant/test_regularisation_manager_20260916.js
+++ candidate-apres/test_regularisation_manager_20260916.js
@@ -32,6 +32,7 @@
 const SOURCE  = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
 const REGLES  = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');
 const COCKPIT = fs.readFileSync(path.join(__dirname, 'NEXUS-Cockpit-v2.html'), 'utf8');
+const PAGE    = fs.readFileSync(path.join(__dirname, 'nexus-page.js'), 'utf8');
 
 // File d'attente, puis `await` : une assertion posée après une écriture
 // asynchrone non attendue passe au vert avant que l'écriture n'ait lieu.
@@ -71,7 +72,8 @@
   };
   const ctx = {
     supabase: { createClient: () => client },
-    window: { location: { pathname: '/NEXUS-Cockpit-v2.html', search: '', href: '' } },
+    window: { location: { pathname: '/NEXUS-Cockpit-v2.html', search: '', href: '' },
+              NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.supabase.co', supabaseCle: 'anon-test' } },
     document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
                 addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
     console: {
@@ -83,6 +85,20 @@
   };
   ctx.globalThis = ctx;
   vm.createContext(ctx);
+  // Le build pose nexus-page.js avant nexus-auth.js sur chaque écran ; ce banc
+  // compose la page de la même façon plutôt que réinventer l'identité de page
+  // dans un stub (decision-8.md §2 ; même raccourci déjà établi par
+  // test_pointage_interrupteur_global.js : dans un navigateur, `window` EST
+  // l'objet global).
+  vm.runInContext(PAGE, ctx);
+  ctx.NexusPage = ctx.window.NexusPage;
+  // NexusBuild : dépendance d'infrastructure neutralisée, locale à ce banc.
+  // Aucune assertion de ce fichier ne porte sur la génération du build-id ni
+  // sur le versionnement d'URL réel — le seul contrôle `?v=` (§6) lit le HTML
+  // committé directement, jamais la sortie de cette primitive. decision-8.md
+  // §2 autorise donc ce stub d'identité minimal plutôt que de régénérer
+  // nexus-build.js.
+  ctx.NexusBuild = { versionner: (src) => src };
   if (avecRegles) vm.runInContext(REGLES, ctx);
   vm.runInContext(SOURCE, ctx);
   return { ctx, journal };
```

### Diff exact — `test_cloture_services_obsoletes_20260916.js`

```diff
--- candidate-avant/test_cloture_services_obsoletes_20260916.js
+++ candidate-apres/test_cloture_services_obsoletes_20260916.js
@@ -28,6 +28,7 @@
 
 const SOURCE = fs.readFileSync(path.join(__dirname, 'nexus-auth.js'), 'utf8');
 const REGLES = fs.readFileSync(path.join(__dirname, 'nexus-pointage-regles.js'), 'utf8');
+const PAGE   = fs.readFileSync(path.join(__dirname, 'nexus-page.js'), 'utf8');
 
 // Les vérifications sont MISES EN FILE, puis exécutées l'une après l'autre
 // avec `await`. Première rédaction de ce fichier : `verifier` appelait fn()
@@ -87,7 +88,8 @@
 
   const ctx = {
     supabase: { createClient: () => client },
-    window: { location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' } },
+    window: { location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' },
+              NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.supabase.co', supabaseCle: 'anon-test' } },
     document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
                 addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] },
     console: {
@@ -99,6 +101,18 @@
   };
   ctx.globalThis = ctx;
   vm.createContext(ctx);
+  // Le build pose nexus-page.js avant nexus-auth.js sur chaque écran ; ce banc
+  // compose la page de la même façon plutôt que réinventer l'identité de page
+  // dans un stub (decision-8.md §2 ; même raccourci déjà établi par
+  // test_pointage_interrupteur_global.js : dans un navigateur, `window` EST
+  // l'objet global).
+  vm.runInContext(PAGE, ctx);
+  ctx.NexusPage = ctx.window.NexusPage;
+  // NexusBuild : dépendance d'infrastructure neutralisée, locale à ce banc.
+  // Aucune assertion de ce fichier ne porte sur la génération du build-id ni
+  // sur le versionnement d'URL réel. decision-8.md §2 autorise donc ce stub
+  // d'identité minimal plutôt que de régénérer nexus-build.js.
+  ctx.NexusBuild = { versionner: (src) => src };
   if (avecRegles) vm.runInContext(REGLES, ctx);
   vm.runInContext(SOURCE, ctx);
   return { ctx, journal };
```

## 3. Résultat réel — les harnais chargent désormais, mais **n'atteignent pas** leurs assertions métier

Les deux fichiers ont été exécutés réellement (`node test_....js`) contre le vrai `nexus-auth.js`,
`nexus-pointage-regles.js`, `nexus-page.js` et `NEXUS-Cockpit-v2.html` de la candidate, patchés
comme ci-dessus.

**`test_regularisation_manager_20260916.js`** — les deux premières assertions passent (le module
charge, `NexusPointageRegles.SOURCE_CLOTURE_PILOTE` existe, la migration
`20260916195000_cloture_source_cycle_pilote.sql` existe) puis :

```
── 2 · La lecture d'équipe : bornée au site, sans garde de rôle ──

✗ ctx.nexusServicesOuvertsDuSite is not a function
```

**`test_cloture_services_obsoletes_20260916.js`** — le module charge, puis échoue dès sa première
assertion réelle :

```
── 1 · Le service de la veille est refermé, sans heure de fin ──

✗ exactement une écriture

0 !== 1
```

Aucun des deux harnais n'atteint ses assertions métier. Conformément à `decision-8.md` §3 (« ensuite
seulement, exécuter la suite candidate complète ») et STOP (« les harnais échouent encore après
fourniture correcte des dépendances runtime […] retour par `request-N.md` »), **la suite candidate
complète n'a pas été lancée** — l'exécuter maintenant produirait un total sans valeur : les fonctions
que ces deux fichiers exercent n'existent plus.

## 4. Cause exacte — une régression matérielle réelle, pas un défaut de harnais

`ctx.nexusServicesOuvertsDuSite is not a function` et l'absence de toute écriture de clôture ne sont
pas des symptômes d'un harnais mal câblé : ces fonctions sont **absentes de `nexus-auth.js` sur la
candidate**, vérifié par `grep`/`git log`, pas supposé :

```
git show origin/rebuild/carburants-65-20260922:nexus-auth.js | grep -c 'nexusRegulariserServicesObsoletes\|nexusCloturerServicesObsoletes\|nexusServicesOuvertsDuSite\|nexusAppliquerCloturePilote\|nexusReglesPilote'
0
```

**Historique exact, retracé par `git log -p` sur `nexus-auth.js`** :

- `cdc3332` (« Cycle des services en phase pilote — NEXUS referme sans inventer la fin ») et
  `4e1b4c3` (« Régularisation manager des services obsolètes (volet D) ») ont introduit, sur cette
  même branche candidate, cinq fonctions : `nexusReglesPilote`, `nexusAppliquerCloturePilote`,
  `nexusCloturerServicesObsoletes`, `nexusRegulariserServicesObsoletes`, `nexusServicesOuvertsDuSite`
  — plus une lecture du fuseau du site (`sites.timezone`) dans `nexusServiceCourant` pour borner le
  jour métier sans jamais fermer un service sur la base du fuseau de l'appareil.
- **`290a217` (« rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique) »,
  22/09/2026 21:21:58)** a remplacé `nexus-auth.js` presque intégralement — `git show --stat 290a217`
  mesure **867 lignes supprimées** dans ce seul fichier pour une intention annoncée de portage
  mécanique du garde `NEXUS_CONFIG`/`NexusBuild`/`NexusPage` (comparer à `request-9.md` §2, qui avait
  déjà établi que ce portage rendait le `nexus-auth.js` de la candidate octet-pour-octet identique à
  celui du rail canonique). **Le rail canonique n'a jamais porté la fonctionnalité de clôture pilote**
  — en la recopiant, `290a217` l'a donc effacée de la candidate, silencieusement : aucun message de
  commit ne signale une suppression de fonctionnalité, le message dit « mecanique ».
- **Aucun commit depuis `290a217` ne touche `nexus-auth.js`** (`git log --oneline
  290a217..origin/rebuild/carburants-65-20260922 -- nexus-auth.js` → vide ; le seul commit plus
  récent, `664af98`, ne touche que `.github/workflows/tests.yml`).
- Le module de règles dont ces fonctions dépendaient, **`nexus-pointage-regles.js`, est lui intact et
  inchangé** sur la candidate (`SOURCE_CLOTURE_PILOTE`, `MOTIF_CLOTURE_PILOTE`, `servicesObsoletes` y
  sont toujours présents et exportés, vérifié par lecture directe) : seule la partie appelante
  (`nexus-auth.js`) a été perdue. Une restauration ne repartirait donc pas de zéro sur les règles,
  mais devrait réconcilier les fonctions perdues avec les conventions introduites depuis
  (`NexusPage.identifiant()` au lieu de `window.location.pathname.split('/').pop()`,
  `NexusBuild.versionner()`) — un travail de relecture et d'arbitrage, pas une copie mécanique.

## 5. Pourquoi ce n'est pas traité comme un « simple problème de transport Git »

`decision-8.md` §5 autorise à ne pas demander de gate Créateur pour un problème de transport Git —
mais ceci n'en est pas un : aucun code n'est en attente de transport ici, du code **a disparu** de la
branche candidate elle-même, par un commit déjà présent sur cette branche. Réintroduire ces cinq
fonctions est un choix de contenu métier/applicatif (quelle version restaurer, comment la faire
cohabiter avec les gardes `NexusPage`/`NexusBuild` ajoutées après coup) — explicitement interdit à
cette session par `decision-8.md` (« Interdit : modifier `nexus-auth.js` ») et hors du périmètre
« outillage/QA pur » de l'arbitrage a posteriori (Q76) : ce n'est pas un bug local de harnais, c'est
une perte de fonctionnalité produit déjà committée puis effacée.

## 6. Gates inchangées — non avancées, conformément à `decision-8.md` §4

La preuve d'identité `nexus-config.js` réellement servi vers Supabase Test n'a pas été tentée : elle
suppose une candidate exécutable, ce qui n'est pas le cas tant que ce point n'est pas arbitré. La
question Cloudflare/`.html` (`decision-7.md` Point 2) reste non observée, non touchée — aucune
correction préventive.

## 7. Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture Supabase
Production, aucun déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun
secret créé/lu/exposé. Aucun fichier de la candidate modifié depuis ce canal — la zone de travail
locale (`.scratch-harnais-65/`) a été supprimée avant la fin de cette session, `git status` propre,
vérifié.
