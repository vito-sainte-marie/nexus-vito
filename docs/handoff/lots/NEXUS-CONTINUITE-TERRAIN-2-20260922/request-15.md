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
    valeur: main=5b047e0-production=2bc7b39
  - id: diff-minimal-explicable
    classe: VERIFIED
    valeur: seul-changement-injection-NEXUS_CONFIG-NexusBuild-NexusPage-aucune-assertion-touchee
  - id: execution-reelle-38-38
    classe: VERIFIED
    valeur: 24-regularisation-plus-14-cloture-contre-vrai-contenu-candidate-61-ecrans-reconstruits
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
# Voie 1 exécutée en local — 38/38 réel contre le vrai contenu candidate, transport toujours bloqué

## 1. `decision-10.md` consommée

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-14.md` : voie 1 retenue,
strictement limitée à la dette de harnais introduite par `290a217`. Consommée par
`outils/handoff.js consommer` (commit `091ceea`).

## 2. Diff minimal et explicable — confirmé, un seul type de changement dans chaque fichier

Comparaison directe (`git show <candidate>:<fichier>` contre les harnais
`*-harnais-realigne-1.js` déjà déposés dans ce lot) : la seule différence entre chaque test
original et son harnais réaligné est l'injection de contexte VM exigée par le portage `290a217`,
rien d'autre :

- ajout d'une lecture de `nexus-page.js` (`const PAGE = fs.readFileSync(...)`) ;
- `window.NEXUS_CONFIG` stubé (config Test minimale, aucune vraie clé, `fetch` reste interdit) ;
- `ctx.NexusBuild = { versionner: (src) => src }` (stub d'infrastructure neutre, non métier) ;
- `vm.runInContext(PAGE, ctx)` puis `ctx.NexusPage = ctx.window.NexusPage` (pont window/globalThis).

Aucune assertion métier existante n'est touchée, affaiblie ou supprimée dans les deux fichiers.
Les harnais `*-harnais-realigne-1.js` déjà présents dans ce lot **sont** ce diff appliqué — aucun
nouveau fichier n'a été créé pour cette étape.

## 3. Exécution réelle des deux tests — contre le vrai contenu candidate, pas contre la zone jetable

Reconstruction en lecture seule (`git show <ref>:<chemin>`, fichier par fichier, hors dépôt, jamais
commitée), plus complète que celle de `request-14.md` : `nexus-auth.js` (blob `a0b2acc5`, restauré),
`nexus-pointage-regles.js`, `nexus-page.js`, `NEXUS-Cockpit-v2.html`, `NEXUS-Pointage-v1.html`, la
migration `20260916195000_cloture_source_cycle_pilote.sql`, et **les 61 écrans `NEXUS-*.html` réels
de la candidate** (liste complète, `NEXUS-Live-Developpement-v1.html` seul absent — confirmé
supprimé sur la candidate par `git diff --name-status`). Les deux harnais réalignés ont ensuite été
placés sous le nom des fichiers originaux et exécutés avec `node`, pour de vrai :

- `test_regularisation_manager_20260916.js` (contenu réaligné) : **24/24**.
- `test_cloture_services_obsoletes_20260916.js` (contenu réaligné), y compris l'assertion à balayage
  de répertoire « les six consommateurs chargent nexus-pointage-regles.js » — la seule qui exigeait
  la reconstruction des 61 écrans, pas seulement des deux fichiers cités par les tests : **14/14**.
- **Total 38/38**, contre le contenu réel de la candidate — pas la zone jetable préparatoire de
  `decision-8`/`request-12`.

**Mutation négative réelle** : les deux fichiers originaux, non modifiés, rejoués contre exactement
le même arbre reconstruit, échouent tous les deux, mot pour mot, sur `NEXUS ne peut pas démarrer :
nexus-config.js n'a pas été chargé` — confirmant que c'est bien l'injection de `NEXUS_CONFIG` qui
fait la différence, rien d'autre dans la reconstruction.

## 4. CI candidate complète — toujours NON acquise, honnêtement

Le transport vers `rebuild/carburants-65-20260922` reste bloqué dans ce canal, comme documenté à
chaque réveil de ce fil depuis le 06/09/2026 : `git push`, `git checkout <ref> --`, `git archive`,
`git worktree add`, `git ls-tree` sur un ref distant, `git hash-object` restent refusés (une
approbation qu'aucun humain ne peut donner dans ce run automatisé). Seuls `git show <ref>:<chemin>`
et `git diff <refA> <refB> -- <chemin>` fonctionnent, ce qui a permis la reconstruction du §3 mais
pas l'écriture sur la candidate elle-même.

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

Puis mesurer les check-runs réels du commit poussé (même méthode sans jeton que `request-14.md`,
API publique `check-runs`) et revenir par un nouveau `request-N.md` avec le résultat `non-regression`
réel — vert ou, s'il reste rouge, la liste précise des échecs restants pour comparaison au baseline
de 19 déjà connu.

## 6. Gate Cloudflare/build — non touchée, conservée séparément (point 4)

Aucune action sur ce point dans ce tour : ni lecture ni modification de la configuration
Cloudflare/build. Elle reste distincte de la gate CI candidate et de la gate harnais.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé,
aucune écriture sur `rebuild/carburants-65-20260922` ni sur aucune branche hors de celle assignée à
cette session (`claude/issue-28-20260924-0833`). `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
