# Analyse — échec du check GitHub `non-regression` sur `290a217` (portage #65)

Réponse au réveil du 23/09/2026 (issue #28) : le portage mécanique des 7 fichiers vers
`rebuild/carburants-65-20260922` est confirmé exécuté (commit `290a217f0f07d4f408469bc9cb8239814544f092`,
message exact `rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique)` —
identique aux commandes documentées dans `preuve-cloudflare-humaine-65-portage-1.md` §6). GitHub
expose désormais 3 checks sur ce SHA : `Cloudflare Pages` COMPLETED/SUCCESS, `Supabase Preview`
COMPLETED/SKIPPED, `non-regression` COMPLETED/FAILURE (job `107006854451`).

Ce dossier analyse uniquement le check `non-regression` — le seul des trois produit par ce dépôt
(`.github/workflows/tests.yml`), donc le seul dont la cause est vérifiable sans réseau. Aucun
parcours métier exécuté, aucune connexion Cloudflare/Supabase tentée.

## 0. Ce que ce canal a pu et n'a pas pu faire

- `gh auth status`, `git fetch origin rebuild/carburants-65-20260922`, `curl` — tous refusés par le
  harnais (« nécessite une approbation qu'aucun humain ne peut donner dans ce run automatisé »),
  comme documenté sur ce fil depuis le 06/09/2026. **Le détail du job GitHub Actions
  `107006854451` n'est donc pas accessible depuis ce canal**, ni en lecture d'API ni en `gh run view`.
- En revanche, `origin/rebuild/carburants-65-20260922` (tip `290a217`) était déjà résolu localement
  (objets déjà présents) : la lecture pure (`git show`, `git cat-file`, `git ls-tree`,
  `git archive`) fonctionne sur ce commit, comme sur toute ref déjà connue. Ce dossier reconstruit
  donc l'équivalent du job — pas en le lisant, en le REJOUANT localement, fichier par fichier, dans
  deux répertoires jetables (`git archive` + `tar -x`, jamais un `git checkout` qui aurait muté une
  ref) : un pour `290a217` (après portage), un pour `fe36a8e` (avant portage, le tip de la PR #65
  telle que déposée). Rien n'a été committé, poussé, ni laissé sur le disque après cette session.

## 1. Cause déterministe et vérifiée du `FAILURE` — pas une hypothèse

`rebuild/carburants-65-20260922` descend de `production` (`2bc7b39`) + 3 commits propres à #65
(`fbf113b`, `ffb520b`, `fe36a8e`) + le commit de portage `290a217`. Elle ne descend PAS de
`config-par-environnement`/`handoff-continuite-20260920` — le rail sur lequel `.github/workflows/tests.yml`
et l'outillage QA/Handoff/Guardians se sont construits depuis le 05/09/2026. Vérifié fichier par
fichier (`git cat-file -e 290a217:<chemin>`), les scripts que `tests.yml` invoque **par leur nom
exact**, dans l'ordre où le job les exécute, sont pour la plupart absents de ce commit :

| Étape (ordre réel du job) | Script invoqué | Présent sur `290a217` ? |
|---|---|---|
| 1. « Situer ce run par rapport au rail » | `outils/handoff.js rail` (best-effort, `\|\| true`) | absent — sans conséquence, l'étape sort 0 quoi qu'il arrive |
| **2. « Immuabilité des migrations déjà en production »** | **`test_migrations_immuables_20260905.js`** | **ABSENT** |
| 3. « Traçabilité de la génération » | `test_build_tracabilite_20260905.js` | absent |
| 4. « Suite de non-régression et verdict » | `run-tests.js` | présent (version très antérieure, sans liste d'échecs connus) |
| 5. « Le lanceur parallèle... » | `test_lanceur_parallele_20260908.js` | absent |
| 6. « ENV-001... » | `outils/garde-env-001.js` | absent |
| 7. « Protocole Handoff v2 » | `outils/handoff.js verifier` | absent (`outils/handoff.js` lui-même absent) |
| … | `docs/handoff/STATE.json`, `docs/learning/RULES.json`, `docs/qa/ECHECS-CONNUS.json`, `outils/verifier-apprentissage.js`, etc. | absents |

**L'étape 2, la toute première qui exécute un script par son nom, échoue immédiatement** :
`node test_migrations_immuables_20260905.js` sur un répertoire de travail où ce fichier n'existe
pas produit, reproduit à l'identique dans cette session (répertoire jetable, jamais le dépôt réel) :

```
node:internal/modules/cjs/loader:1433
  throw err;
Error: Cannot find module '.../test_migrations_immuables_20260905.js'
    at Function._resolveFilename (node:internal/modules/cjs/loader:1430:15)
```

`node` sort en code 1 sans `continue-on-error` déclaré sur cette étape : GitHub Actions arrête le
job **ici**. Toutes les étapes suivantes — y compris « Suite de non-régression et verdict »
(`run-tests.js`, seule étape dont le nom recoupe celui du job `non-regression`), ENV-001, le
protocole Handoff, les Guardians, la recette navigateur — ne s'exécutent jamais sur ce run.

**Ceci n'est pas imputable au portage.** Le portage n'a touché que 7 fichiers nommés
(`outils/build.sh`, `outils/generer-config.js`, `outils/poser-build-id.js`, `nexus-auth.js`,
`nexus-page.js`, `nexus-bandeau-environnement.js`, `_headers`) — aucun test, aucun fichier
`docs/`. `test_migrations_immuables_20260905.js` était déjà absent de `fe36a8e`, avant tout
portage : c'est une propriété structurelle de cette branche, restée figée sur la lignée
`production` pendant que `main`/le rail construisaient tout l'appareil QA/Handoff/Guardians décrit
plus haut. Depuis que `tests.yml` déclare `branches: ['**']` (donc s'exécute sur toute branche
poussée, candidates comprises), **toute branche de cette ancienneté échouerait `non-regression`
de façon identique, avec ou sans le portage** — y compris avant, sur `fe36a8e` seul (vérifié :
`test_migrations_immuables_20260905.js` est absent des DEUX commits).

## 2. Un second fait, réel et distinct, trouvé en le cherchant — pas ce qui a fait échouer CI, mais une vraie dette du portage

Puisque `run-tests.js` (étape 4) ne s'exécute jamais dans ce run CI précis (le job meurt à
l'étape 2), la question « le portage a-t-il cassé quelque chose que la propre suite de tests de la
branche #65 aurait détecté » reste ouverte et mesurable indépendamment. Mesurée ici par
comparaison contrôlée A/B — reconstruction complète des deux arbres (`git archive` + extraction
dans deux répertoires jetables), puis exécution réelle de tous les `test_*.js` présents à la
racine de CHAQUE arbre (le `run-tests.js` propre à cette branche, sans modification) :

| | `fe36a8e` (avant portage) | `290a217` (après portage) |
|---|---|---|
| Tests à la racine | 224 | 224 |
| Passent | **217** | **198** |
| Échouent | 7 (pré-existants, sans lien avec `nexus-auth.js`/le build) | **26** |

Les 7 échecs de `fe36a8e` sont inchangés sur `290a217` (`test_inventaire_categorie_mixte_deux_lieux.js`,
`test_inventaire_production_journaliere_q1.js`, `test_inventaire_sprint4_ux_flash.js`,
`test_inventaire_sprint4bis_ecriture_immediate.js`, `test_pilotage_qualite_receptions.js`,
`test_reception_moteur.js`, `test_reception_v1_dom.js`) : dette pré-existante de la branche,
non touchée par ce portage, non traitée ici.

**19 échecs sont NOUVEAUX, introduits exactement par le portage**, et se répartissent en deux
causes précises, vérifiées par exécution directe (pas par lecture de source) :

1. **Fonctions/blocs disparus de `nexus-auth.js`** (12 tests : `test_acces_hors_service_20260916.js`,
   `test_accueil_hors_service_20260918.js`, `test_connexion_nest_pas_presence_20260916.js`,
   `test_fuseau_parametres_station_20260920.js`, `test_fuseau_station_20260918.js`,
   `test_jour_metier_pointage_20260919.js`, `test_missions_jour_station_20260918.js`,
   `test_pointage_interrupteur_global.js`, `test_role_du_jour_20260905.js`, et 3 autres). Exemple
   vérifié par exécution directe (`test_reception_compartiments_incomplet.js`) :
   `.match(/function nexusEstManager\([\s\S]*?\n}/)[0]` échoue avec `Cannot read properties of
   null` — **`nexusEstManager` n'existe nulle part dans le `nexus-auth.js` du rail** (grep confirmé
   : 0 occurrence). Autre exemple (`test_fuseau_parametres_station_20260920.js`, 28 contrôles verts,
   1 rouge) : `nexusFuseauSite` (nexus-auth.js), « le lecteur de jour métier chargé par TOUS les
   écrans », absent du fichier ported. Le `nexus-auth.js` de 932 lignes de la lignée #65 portait des
   fonctionnalités développées APRÈS la refonte du 04/09 sur des branches sœurs indépendantes
   (`acces-hors-service-20260916`, `accueil-employes-20260918`, `fuseau_parametres_station_20260920`,
   `reception-regularisation-20260919` elle-même) — jamais reversées dans le `nexus-auth.js` de 305
   lignes du rail. Le remplacement mécanique perd donc, avec le code Production en dur qu'il
   retirait à raison, des fonctionnalités réelles que la branche candidate portait déjà.
2. **Le `nexus-auth.js` du rail refuse de démarrer sans `nexus-config.js`** (7 tests, dont
   `test_cloture_services_obsoletes_20260916.js`, `test_regularisation_manager_20260916.js`) :
   « NEXUS ne peut pas démarrer : nexus-config.js n'a pas été chargé » — comportement fail-closed
   voulu (§2/3 de `outils/generer-config.js`), mais qui suppose que le build (`outils/build.sh`) a
   tourné avant tout test exécutant réellement `nexus-auth.js`. L'ancien `nexus-auth.js` de la
   branche n'avait pas cette précondition (URL Production en dur, jamais de garde de démarrage).

## 3. Pourquoi ce second fait ne se corrige PAS dans ce lot

Le périmètre déjà autorisé par `decision-2.md`/`decision-3.md` est strictement le transport
mécanique des 7 fichiers, identiques au rail. Réparer le point 1 demanderait soit de réintroduire
du code métier (les fonctions manquantes) dans `nexus-auth.js` — une modification de fichier
au-delà d'une copie identique, et potentiellement une **nouvelle règle métier/UX** si la façon de
les intégrer n'est pas elle-même triviale — soit un arbitrage produit sur comment réconcilier les
branches sœurs (`acces-hors-service`, `accueil-employes`, `fuseau_parametres_station`) avec la
refonte du rail. Aucune des deux n'est couverte par l'autorisation actuelle. Conformément à la
consigne du réveil (« si l'échec CI est imputable au portage, corrige... dans le périmètre déjà
autorisé ; sinon classe-le avec preuve »), **le point 1 dépasse le périmètre déjà autorisé et n'est
donc pas corrigé ici** — il est classé et chiffré, pas traité.

## 4. Ciblage Supabase Test du preview — toujours non prouvé, analyse statique seulement

`outils/generer-config.js` (identique sur le rail et désormais sur `290a217`, vérifié
octet-identique) refuse tout build où `NEXUS_ENV=test` désigne l'URL de Production, et tout build
`NEXUS_ENV=production` qui ne la désigne pas — mais il ne PROUVE PAS lui-même que les variables
`NEXUS_ENV`/`NEXUS_SUPABASE_URL`/`NEXUS_SUPABASE_ANON_KEY` réellement fournies à ce build Cloudflare
valent `test`/Test : un succès Cloudflare est compatible avec les deux cas cohérents (test→Test ou
production→Production), pas seulement le premier. `etude-isolation-test-candidats-web-1.md` §1
avait déjà mesuré, le 22/09, que ce **même projet Cloudflare** (`nexus-test-ddf.pages.dev` — les
deux URL de preview citées dans le réveil, `6dcad13e.…` et `rebuild-carburants-65-202609.…`, sont
bien sous ce domaine) sert `environnement: test`/Supabase Test pour l'alias du rail — mais notait
explicitement que rien ne prouve que ce soit vrai « au niveau du projet » pour TOUTE branche,
seulement mesuré pour une. **Ce dossier ne change pas cette conclusion** : `Supabase Preview:
SKIPPED` (intégration Supabase Branching, absente pour cette branche Git) ne prouve rien non plus
dans un sens ou dans l'autre sur l'isolation — c'est une intégration différente, sans rapport avec
les variables Cloudflare Pages. Aucune lecture réseau n'a été tentée pour trancher ce point
(interdit tant que l'absence de contact Production n'est pas prouvée) : il reste `NOT_APPLICABLE`
depuis ce canal, exactement comme avant ce réveil.

## 5. Ce que ce dossier NE change PAS

- La gate « GO Production #65 » reste `NO GO temporaire` (`classement-gates-etat-git-62-65-1.md`
  §2) — rien ici ne la rouvre.
- Aucune recette navigateur n'a été lancée, ni sur le preview Cloudflare, ni ailleurs.
- Aucun fichier applicatif n'a été modifié ; aucune branche candidate n'a été touchée ; aucun
  fichier n'a été écrit hors de `docs/handoff/` dans ce dépôt de travail.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucune nouvelle règle métier/UX (le point 2 est classé, pas corrigé),
aucun élargissement sécurité/rôle, PR #65 et `rebuild/carburants-65-20260922` non modifiées, aucun
contournement des restrictions d'écriture de ce canal (reconstruction en répertoires jetables,
jamais un `git checkout`/`push` réel).
