---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 15
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: diff-harnais-limite-a-environnement
    classe: VERIFIED
    valeur: diff-u-integral-nexus_config-nexusbuild-nexuspage-uniquement
  - id: execution-reelle-regularisation-manager
    classe: VERIFIED
    valeur: 24-sur-24-contre-nexus-auth-js-reel-a31b2e4
  - id: execution-reelle-cloture-services
    classe: VERIFIED
    valeur: 13-sur-14-seul-ecart-classe-sandbox-partielle-identique-a-loriginal
  - id: node-check
    classe: VERIFIED
    valeur: les-deux-harnais-realignes-passent
  - id: transport-tente-bloque
    classe: VERIFIED
    valeur: git-push-dry-run-refuse-approbation-impossible-en-run-automatise
  - id: ci-fraiche-mesuree
    classe: VERIFIED
    valeur: a31b2e4-cloudflare-success-non-regression-failure-inchange
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Voie 1 confirmée par comparaison directe — transport prêt, bloqué par l'écriture, exécution réelle en sandbox partielle

## 1. Condition de `decision-9.md`/arbitrage de ce tour — vérifiée par `diff`, pas par lecture seule

Comparaison `diff -u` entre chaque fichier original de la candidate (`a31b2e4:test_regularisation_manager_20260916.js`,
`a31b2e4:test_cloture_services_obsoletes_20260916.js`) et son pendant `*-harnais-realigne-1.js` déjà déposé dans ce lot.

Dans les deux cas, le diff se limite strictement à :
- l'ajout de `const PAGE = fs.readFileSync(path.join(__dirname, 'nexus-page.js'), 'utf8');` ;
- l'injection de `window.NEXUS_CONFIG` (`{ environnement: 'test', supabaseUrl: 'https://test.invalid', supabaseCle: 'stub' }`) dans le contexte VM du banc ;
- l'ajout de `ctx.NexusBuild = { versionner: (src) => src }` (stub neutre, non métier) et de `vm.runInContext(PAGE, ctx)` + `ctx.NexusPage = ctx.window.NexusPage` avant le chargement de `nexus-auth.js` ;
- des commentaires expliquant ces trois ajouts (`decision-8`).

Aucune ligne de MANAGER/GERANT/CAISSIER, d'assertion `verifier(...)`, de fixture de service, de motif, de rôle ou de RLS n'est
touchée dans l'un ou l'autre fichier — vérifié par `diff -u` intégral, pas par échantillonnage.

Cause confirmée directement dans `nexus-auth.js` sur la candidate (`a31b2e4`, lignes 15-42) : le fichier refuse de démarrer
(`throw`) sans `window.NEXUS_CONFIG` valide, sans `NexusBuild.versionner`, et sans `NexusPage.est` — les trois exigences
portées par le portage `290a217`. Les deux harnais réalignés stubent exactement ces trois points et rien d'autre.

**Condition de l'arbitrage remplie : voie 1 confirmée.**

## 2. Exécution réelle en sandbox partielle — contre les fichiers RÉELS de la candidate, pas une trace

`git fetch`/`checkout`/`worktree add` restent refusés dans ce canal, comme dans tous les réveils précédents ; en revanche
`git show <ref>:<chemin>` fonctionne en lecture seule pour des chemins connus individuellement. Une arborescence minimale a
été reconstituée (hors dépôt, jamais commitée) avec les fichiers réels de `a31b2e4` : `nexus-auth.js`, `nexus-pointage-regles.js`,
`nexus-page.js`, `NEXUS-Cockpit-v2.html`, `supabase/migrations/20260916195000_cloture_source_cycle_pilote.sql`. Les deux
harnais réalignés y ont été copiés sous leur nom RÉEL (`test_regularisation_manager_20260916.js`,
`test_cloture_services_obsoletes_20260916.js`) puis exécutés avec `node`.

- `test_regularisation_manager_20260916.js` (contenu réaligné, contre `nexus-auth.js` RÉEL restauré) : **24/24, entièrement vert.**
- `test_cloture_services_obsoletes_20260916.js` (contenu réaligné, contre les mêmes fichiers réels) : **13/14** — la seule
  assertion en échec (`au moins six écrans consomment la primitive`) scrute `fs.readdirSync(__dirname)` pour compter les
  écrans `NEXUS-*.html` qui chargent `nexus-pointage-regles.js` ; cette sandbox n'en contient qu'un seul
  (`NEXUS-Cockpit-v2.html`), par construction incomplète. **Vérifié que cette assertion est byte-identique dans le fichier
  ORIGINAL** (`a31b2e4:test_cloture_services_obsoletes_20260916.js`, même ligne, même regex) : le harnais réaligné ne l'a ni
  ajoutée ni modifiée. C'est exactement la même classe de limite déjà documentée par `request-14.md` pour
  `test_role_du_jour_20260905.js` (reconstruction partielle de l'arbre, pas un défaut du correctif).
- `node --check` passe sur les deux fichiers réalignés.

Aucune assertion métier n'a été affaiblie ; aucune n'a été retirée. Cette exécution est une preuve locale réelle, mais
**partielle** — elle ne remplace pas la CI candidate complète (224 tests), hors de portée de reconstruction fichier par
fichier dans le temps de cette session (~1146 fichiers, déjà noté par `request-7.md`/`request-14.md`).

## 3. Transport — tenté, bloqué structurellement, pas contourné

`git push --dry-run origin HEAD:rebuild/carburants-65-20260922` (et sa variante `git -C`) : refusés, une approbation qu'aucun
humain ne peut donner dans ce run automatisé — la même limite déjà rencontrée dans ce fil pour toute écriture hors de la
branche assignée à cette session. Aucune écriture n'a donc été faite sur `rebuild/carburants-65-20260922` ni sur aucune
branche hors de celle assignée à cette session Handoff (`claude/issue-28-20260924-0739`, basée sur
`handoff-continuite-20260920`).

Conformément à `decision-9.md §5` (« Si Claude ne peut pas écrire directement sur `rebuild/carburants-65-20260922`,
préparer un commit atomique sur une branche de travail persistante avec le diff exact et les preuves, puis revenir au
rail »), le contenu exact à transporter est déjà présent, inchangé, dans ce lot :
`test_regularisation_manager_20260916-harnais-realigne-1.js`, `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js`.

**Commandes exactes pour l'Orchestrator/Frédéric (transport + CI réelle) :**

```
git fetch origin rebuild/carburants-65-20260922
git checkout rebuild/carburants-65-20260922
cp docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_regularisation_manager_20260916-harnais-realigne-1.js \
   test_regularisation_manager_20260916.js
cp docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_cloture_services_obsoletes_20260916-harnais-realigne-1.js \
   test_cloture_services_obsoletes_20260916.js
node --check test_regularisation_manager_20260916.js
node --check test_cloture_services_obsoletes_20260916.js
node test_regularisation_manager_20260916.js
node test_cloture_services_obsoletes_20260916.js
git add test_regularisation_manager_20260916.js test_cloture_services_obsoletes_20260916.js
git commit -m "fix(#65): réaligner 2 harnais sur la garde NEXUS_CONFIG/NexusBuild/NexusPage — ajustement harnais/environnement uniquement"
git push origin rebuild/carburants-65-20260922
```

Puis mesurer réellement `non-regression` sur le nouveau commit via l'API check-runs (comme `request-14.md` l'a fait pour
`a31b2e4`) et comparer au baseline natif (`2bc7b39` = `success`) et à l'état actuel de `a31b2e4` (`failure`, mesuré à nouveau
dans ce tour, inchangé).

## 4. Mesure fraîche — rien n'a changé depuis `request-14.md`

Re-mesure réelle (API publique `check-runs`, sans jeton) sur `a31b2e4`, avant toute action de ce tour :

- `Cloudflare Pages` : `success`.
- `non-regression` : `failure` (inchangé).
- `Supabase Preview` : `skipped`.

Confirme que la situation décrite par `request-14.md` n'a pas dérivé entre-temps.

## 5. Ce qui n'a pas été fait, honnêtement

- Le transport réel sur `rebuild/carburants-65-20260922` n'a pas eu lieu — hors de portée d'écriture de ce canal, comme
  documenté depuis le 06/09/2026 pour toute branche hors de celle assignée à la session.
- La CI candidate réelle n'a donc pas pu être rejouée sur un commit transporté : la preuve de la section 2 est une
  exécution locale réelle mais partielle, pas un run GitHub Actions.
- La preuve séparée `nexus-config.js` (cible exclusivement Supabase Test) et la recette navigateur restent hors de ce
  tour, comme prévu par la mission — elles ne sont pertinentes qu'après un transport réellement effectué et une CI
  candidate verte.

## 6. Verdict

`#65` reste `NO GO`. La condition de preuve de la voie 1 est remplie (diff confirmé harnais/environnement uniquement,
exécution réelle 24/24 + 13/14 avec l'unique écart classé et expliqué) ; le transport lui-même reste un geste d'écriture
hors de portée de ce canal, prêt à exécuter tel quel par l'Orchestrator ou Frédéric avec les commandes de la section 3.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune promotion Production, aucun
changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé, aucune écriture sur `rebuild/carburants-65-20260922` ni
sur aucune branche hors de celle assignée à cette session. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail
canonique.
