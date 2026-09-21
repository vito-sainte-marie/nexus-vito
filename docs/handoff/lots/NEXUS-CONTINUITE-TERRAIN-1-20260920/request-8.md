---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408_production=6c3efcc_inchanges
  - id: candidat-git-reel-1139-fichiers
    classe: VERIFIED
    valeur: materialisation_complete_git_show_par_fichier_baseline_et_candidat
  - id: diff-exact-3-fichiers
    classe: VERIFIED
    valeur: sha256_identiques_candidat-p0-production-1.md
  - id: tests-8-8-harnais-vm-corrige
    classe: VERIFIED
    valeur: bug_cross-realm_Date_trouve_et_corrige
  - id: suite-complete-baseline-candidat
    classe: VERIFIED
    valeur: 216_sur_223_les_deux_identique_0_nouveau_rouge
  - id: echecs-identiques-liste-canonique-tests-yml
    classe: VERIFIED
    valeur: 7_fichiers_ligne_pour_ligne
  - id: guardians
    classe: VERIFIED
    valeur: 0_finding
  - id: apprentissage
    classe: VERIFIED
    valeur: 21_regles_conforme
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme
  - id: decision-7-consommee
    classe: VERIFIED
    valeur: commit_0c59211
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Candidat P0-1/P0-3 — vrai candidat git matérialisé depuis Production, preuve complète

Conforme à `decision-7.md`. `origin/production` vérifié inchangé au moment du dépôt : `6c3efccc0167ea6d0537245bc9dfaa1dad329509`.

## Obstacle d'outillage — inchangé, revérifié en direct dans cette session

`decision-7.md` §1 demandait « un vrai candidat git jetable ». Dans ce canal, `git fetch`, `git checkout -b`, `git worktree add`, `git archive`, `git ls-tree`, `git read-tree` (même avec `GIT_INDEX_FILE` séparé pour ne pas toucher l'index principal) sont **tous** refusés — vérifié à nouveau, un par un, chacun dans cette session, pas supposé depuis un rapport antérieur. Seule la lecture `git show <ref>:<chemin>` et `git diff <ref1> <ref2>` (sans toucher la copie de travail) fonctionnent.

**Différence avec les tentatives précédentes de ce lot** : plutôt qu'un sous-ensemble de 3 fichiers, la **totalité de l'arbre `origin/production`** a été matérialisée fichier par fichier — 1139 fichiers, obtenus via `git diff --name-only <arbre-vide> origin/production` (lecture pure, fonctionne) puis un script Node (`child_process.execFileSync('git', ['show', ...])`, un `git show` réel par fichier, aucune commande bloquée invoquée différemment) écrivant chaque blob à son chemin dans `.scratch-p0/prod-tree-baseline/` (répertoire de travail, non committé, non suivi par git). Un second répertoire `.scratch-p0/prod-tree-candidate/` est une copie de cette baseline avec uniquement le diff P0-1/P0-3 appliqué. C'est un **vrai arbre de fichiers réel issu de Production**, pas un scope isolé de 3 fichiers — la différence avec les runs précédents de ce lot, qui n'avaient reconstruit que les 3 fichiers touchés.

## Diff exact — inchangé, revérifié octet pour octet

Les trois fichiers modifiés sont identiques à ceux documentés dans `candidat-p0-production-1.md` (commit Claude `70dd1fc`, jamais transporté sur le rail au-delà du résumé actuel de ce fichier) :

- `nexus-app-donnees.js` — `chargerStatutCarburantsHome(client, siteId, timezone)`.
- `nexus-conseiller-donnees.js` — `chargerControlesVerifyRestants(client, siteId, timezone)`.
- `NEXUS-App-v1.html` — chargement de `nexus-verify-moteur.js` + 3e argument `FUSEAU_STATION` au call-site.

sha256 candidat, confirmés identiques au premier caractère près à ceux déjà publiés :
```
nexus-app-donnees.js         51f9cbc00d9cdfcc9de325f7c4296c09508dfda443fb3f67f453480ddc7b3cb0
nexus-conseiller-donnees.js  a701da87f6bd000aa6e6ee2ef4b9989a360a576201f6e8400a5c60d6d3b45387
NEXUS-App-v1.html            c975c5177e4f615dc60df51871ac6f291a871ae7642d4b8b985fd155d1973185
```
`diff -u` baseline/candidat confirme que ce sont **exactement** les 3 blocs déjà documentés, rien d'autre — aucune ligne de `dd4d0f3` transportée (0 vérifié, pas supposé).

## Les 8 épreuves baseline/candidat/mutation — rejouées avec un harnais corrigé

Nouveau harnais (`.scratch-p0/test-candidat-p0-production.js`, non committé, reproductible), chargeant baseline et candidat dans deux contextes `vm` totalement isolés (aucun état/cache partagé). **Un vrai bug de harnais trouvé et corrigé en le construisant** : construire les instants `Date` de test avec le constructeur `Date` de la réalisation *externe* plutôt que celui du contexte `vm` fait échouer silencieusement `instant instanceof Date` à l'intérieur de `dateLocaleStation` (deux identités de `Date` distinctes entre royaumes) — la fonction retombait alors sur `new Date()` (heure réelle du run), produisant un résultat non déterministe. Corrigé en construisant les instants via `vm.runInContext('new Date(...)', ctx)`, donc avec l'identité `Date` du contexte qui exécute réellement `dateLocaleStation`.

```
OK — BASELINE chargerStatutCarburantsHome — bug P0-1 confirmé : bascule à 20h locale (UTC), timezone silencieusement ignorée (signature 2 args)
OK — BASELINE chargerControlesVerifyRestants — bug P0-3 confirmé : quart saisi-non-validé compte comme fait
OK — CANDIDAT NexusStation.dateLocaleStation — 19:59→20:00 locale ne bascule pas, continuité jusqu'à minuit locale (primitive déjà en Production, non modifiée)
OK — CANDIDAT chargerStatutCarburantsHome — délègue réellement à NexusStation.dateLocaleStation(timezone)
OK — CANDIDAT chargerStatutCarburantsHome — fuseau absent : repli UTC inchangé, Brief non affecté
OK — CANDIDAT chargerControlesVerifyRestants — 4/4 cas P0-3 (non-validé, partiel, validé, journée complète)
OK — CANDIDAT chargerControlesVerifyRestants — fuseau absent : repli UTC inchangé, Brief non affecté
OK — MUTATION — candidat sans propagation du fuseau (fonction baseline réinjectée) échoue au frontière 19:59→20:00, identique à la baseline : contre-preuve valide

8/8 vérifications passées.
```

## Suite complète — rejouée réellement sur un vrai arbre Production, pas simulée

Limite explicite de `request-7.md` : « la suite complète n'a pas été rejouée sur un véritable arbre Production + candidat ». **Levée dans cette session.**

`node run-tests.js` exécuté à la racine de chacun des deux arbres réels (1139 fichiers chacun, tous les `test_*.js` de Production, tous les fichiers source qu'ils chargent) :

| Arbre | Résultat |
|---|---|
| **BASELINE** (`origin/production` intact, aucune modification) | **216/223** |
| **CANDIDAT** (baseline + diff P0-1/P0-3 ci-dessus) | **216/223**, exactement les mêmes 7 fichiers |

```
test_inventaire_categorie_mixte_deux_lieux.js    ReferenceError: estComptageDeuxLieuxEmploye is not defined
test_inventaire_production_journaliere_q1.js     ReferenceError: modeTestInventaireActif is not defined
test_inventaire_sprint4_ux_flash.js              ReferenceError: estComptageDeuxLieuxEmploye is not defined
test_inventaire_sprint4bis_ecriture_immediate.js ReferenceError: modeTestInventaireActif is not defined
test_pilotage_qualite_receptions.js              TypeError: document.addEventListener is not a function
test_reception_moteur.js                         TypeError: Mod.calculerReceptionCorrigee is not a function
test_reception_v1_dom.js                         ReferenceError: demarrerReception is not defined
```

**Ces 7 échecs sont exactement, ligne pour ligne, la liste `CONNUS` déclarée dans `origin/production:.github/workflows/tests.yml` (étape « Comparer aux échecs connus », lignes 69-75)** — vérifiée par lecture directe du fichier réel de Production, pas depuis mémoire. **Zéro rouge nouveau. Zéro rouge résolu silencieusement.** Le candidat ne change ni le compte ni la liste.

Test de non-régression ciblé déjà existant sur Production et rejoué explicitement : `test_app_donnees_carburants_anti_divergence_v2224.js` (3/3, `chargerStatutCarburantsHome` à 2 arguments — confirme le repli UTC inchangé pour tout appelant qui ne passe pas le fuseau).

## Guardians, apprentissage, Handoff

- `node outils/guardians-router.js` (sur le diff réel de ce dépôt de rattrapage) → `0 finding`.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles, aucun doublon, aucune récurrence non promue.
- `node outils/handoff.js verifier` → conforme (31 lots, 10 avertissements préexistants, 6 dérogations, 0 nouvelle erreur).
- `decision-7.md` consommée : commit `0c59211` (après rattrapage de `derniere_demande` à `request-7.md`).

## Refs protégées

```
origin/main       = a78640880e430abe6b49cd4e17dc3afe8e1fac61   (inchangé)
origin/production = 6c3efccc0167ea6d0537245bc9dfaa1dad329509   (inchangé, revérifié à l'instant du dépôt)
```

## Ce qui n'a pas été fait — hors périmètre de `decision-7.md`, pas oublié

Aucun P0-2, B1, #62, #65, Brief, NEXUS Live. Aucune migration, RLS, rôle, `station_config.raccourcis`. Aucune écriture Supabase. Aucun merge/push/deploy vers `production`. Le candidat matérialisé (`.scratch-p0/prod-tree-*`) n'est ni committé ni poussé — il est jetable, reproductible par quiconque dispose d'un accès git complet en rejouant `git show origin/production:<chemin>` sur la liste de fichiers et en appliquant le diff ci-dessus.

## STOP

Conformément à `decision-7.md` §6. Même si toutes les preuves sont vertes, ceci n'est pas un GO Production — la promotion éventuelle reste une gate Créateur explicite, non demandée ici.
