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
  - id: refs-protegees
    classe: VERIFIED
    valeur: main-et-production-non-touches
  - id: diff-minimal-explicable
    classe: VERIFIED
    valeur: seul-changement-injection-NEXUS_CONFIG-NexusBuild-NexusPage-aucune-assertion-touchee
  - id: execution-reelle-38-38
    classe: VERIFIED
    valeur: 24-regularisation-plus-14-cloture-contre-61-ecrans-reconstruits-independamment
  - id: mutation-negative-reelle
    classe: VERIFIED
    valeur: deux-originaux-non-modifies-echouent-identiquement-nexus-config-non-charge
  - id: ci-candidate-complete
    classe: NOT_APPLICABLE
    valeur: transport-toujours-bloque-aucune-requalification-en-vert
  - id: gate-65
    classe: VERIFIED
    valeur: NO_GO-inchange-point-5-decision-10
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Voie 1 exécutée et vérifiée indépendamment — 38/38 réel contre le vrai contenu candidate, transport toujours bloqué

## 1. `decision-10.md` consommée

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-14.md` : voie 1 retenue,
strictement limitée à la dette de harnais introduite par `290a217`. Consommée par
`outils/handoff.js consommer` (commit `44b05d3`).

## 2. Diff minimal et explicable — vérifié par comparaison directe, pas supposé

Comparaison réelle (`diff -u`) entre chaque test original tel qu'il vit aujourd'hui sur
`rebuild/carburants-65-20260922` (récupéré par `git show <ref>:<chemin>`) et le harnais réaligné
correspondant déjà déposé dans ce lot (`*-harnais-realigne-1.js`) :

- `test_regularisation_manager_20260916.js` : 373 → 400 lignes, diff de 27 lignes utiles.
- `test_cloture_services_obsoletes_20260916.js` : diff de 22 lignes utiles.

Dans les deux cas, le seul changement est : lecture de `nexus-page.js`, `window.NEXUS_CONFIG` stubé
(config Test minimale, `fetch` reste interdit plus bas), `ctx.NexusBuild = { versionner: (src) =>
src }` (stub neutre, non métier), `vm.runInContext(PAGE, ctx)` puis `ctx.NexusPage =
ctx.window.NexusPage` (pont window/globalThis). Aucune assertion existante n'est ajoutée, retirée ou
modifiée dans l'un ou l'autre fichier.

## 3. Exécution réelle des deux tests — reconstruction indépendante, pas réutilisation d'un résultat annoncé

Reconstruction en lecture seule, fichier par fichier (`git show origin/rebuild/carburants-65-20260922:<chemin>`,
jamais committée) : `nexus-auth.js`, `nexus-pointage-regles.js`, `nexus-page.js`, la migration
`supabase/migrations/20260916195000_cloture_source_cycle_pilote.sql`, et **les 61 écrans
`NEXUS-*.html` réels de la candidate** — liste obtenue par `git diff --name-only
4b825dc642cb6eb9a060e54bf8d69288fbee4904 origin/rebuild/carburants-65-20260922 -- 'NEXUS-*.html'`
(diff contre l'arbre vide, donc liste complète, pas un sous-ensemble), comptée à 61 ;
`NEXUS-Live-Developpement-v1.html` bien absent de cette liste, cohérent avec sa suppression connue
sur la candidate.

Les deux harnais réalignés ont été placés sous le nom des fichiers originaux dans cette
reconstruction et exécutés avec `node`, pour de vrai :

- `test_regularisation_manager_20260916.js` (contenu réaligné) : **24/24**.
- `test_cloture_services_obsoletes_20260916.js` (contenu réaligné), y compris l'assertion à
  balayage de répertoire « les six consommateurs chargent nexus-pointage-regles.js » — la seule qui
  exige la reconstruction des 61 écrans, pas seulement des deux fichiers cités par les tests :
  **14/14**.
- **Total 38/38**, contre le contenu réel de la candidate, mesuré indépendamment dans cette session
  (pas la reprise d'un résultat annoncé par une session précédente).

**Mutation négative réelle** : les deux fichiers originaux, non modifiés (récupérés séparément par
`git show`), rejoués contre exactement le même arbre reconstruit, échouent tous les deux, mot pour
mot, sur « NEXUS ne peut pas démarrer : nexus-config.js n'a pas été chargé » — confirmant que c'est
bien l'injection de `NEXUS_CONFIG` qui fait la différence, rien d'autre dans la reconstruction.

## 4. CI candidate complète — toujours NON acquise, honnêtement

Le transport vers `rebuild/carburants-65-20260922` reste bloqué dans ce canal : `git push` vers une
branche distante autre que celle assignée à cette session, `git archive` et `git ls-tree` sur un ref
distant sont refusés par l'outillage de ce run (approbation indisponible en run automatisé). Seuls
`git show <ref>:<chemin>` et `git diff <refA> <refB> -- <chemin>` fonctionnent — suffisants pour la
reconstruction du §3, pas pour l'écriture sur la candidate elle-même.

**Conséquence explicite, conformément à decision-10 point 3** : la CI candidate complète n'a pas pu
être rejouée sur le commit corrigé (il n'existe pas encore), donc **elle n'est pas requalifiée comme
verte**. Le point 5 de `decision-10.md` s'applique sans ambiguïté : `#65` reste `NO GO`.

## 5. Transport — commandes exactes pour une session avec écriture sur `rebuild/carburants-65-20260922`

```
git fetch origin rebuild/carburants-65-20260922 handoff-continuite-20260920
git checkout -b lot/continuite-terrain-2-harnais-fix origin/rebuild/carburants-65-20260922
git show origin/handoff-continuite-20260920:docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_regularisation_manager_20260916-harnais-realigne-1.js > test_regularisation_manager_20260916.js
git show origin/handoff-continuite-20260920:docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_cloture_services_obsoletes_20260916-harnais-realigne-1.js > test_cloture_services_obsoletes_20260916.js
node --check test_regularisation_manager_20260916.js
node --check test_cloture_services_obsoletes_20260916.js
node test_regularisation_manager_20260916.js
node test_cloture_services_obsoletes_20260916.js
node run-tests.js
git add test_regularisation_manager_20260916.js test_cloture_services_obsoletes_20260916.js
git commit -m "fix(#65): realigner les deux harnais originaux sur NEXUS_CONFIG (290a217)"
git push origin lot/continuite-terrain-2-harnais-fix:rebuild/carburants-65-20260922
```

Puis mesurer les check-runs réels du commit poussé et revenir par un nouveau `request-N.md` avec le
résultat `non-regression` réel — vert ou, s'il reste rouge, la liste précise des échecs restants
pour comparaison au baseline déjà connu.

## 6. Gate Cloudflare/build — non touchée, conservée séparément (point 4)

Aucune action sur ce point dans ce tour : ni lecture ni modification de la configuration
Cloudflare/build. Elle reste distincte de la gate CI candidate et de la gate harnais.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé,
aucune écriture sur `rebuild/carburants-65-20260922` ni sur aucune branche hors de celle assignée à
cette session (`claude/issue-28-20260924-0955`). `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
