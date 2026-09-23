---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 10
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: harnais-realignes
    classe: VERIFIED
    valeur: 2-fichiers-patches-NEXUS_CONFIG-NexusBuild-stub-vrai-nexus-page-js
  - id: preuve-negative-sans-patch
    classe: VERIFIED
    valeur: meme-echec-nexus-config-non-charge-reconfirme-sur-664af98
  - id: preuve-positive-avec-patch
    classe: VERIFIED
    valeur: chargement-reussi-2-premieres-assertions-metier-vertes
  - id: fonctions-manquantes-harnais1
    classe: VERIFIED
    valeur: 5-fonctions-absentes-de-nexus-auth-js-sur-rail-candidate-et-main
  - id: harnais2-regression-metier
    classe: VERIFIED
    valeur: zero-update-emis-mesure-reellement
  - id: suite-candidate-complete
    classe: NOT_APPLICABLE
    valeur: conditionnee-par-decision8-a-des-assertions-metier-non-atteintes
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: git-push-fetch-ls-tree-worktree-archive-tous-refuses
  - id: gates-identite-test-cloudflare
    classe: NOT_APPLICABLE
    valeur: inchangees-non-retouchees-ici
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Harnais réalignés et exécutés réellement — assertions métier absentes de `nexus-auth.js`

Exécution de `decision-8.md` (en réponse à `request-9.md`, commit `1b8521b30f48e376204077904497dabe9f8d2ef9`).
`decision-8.md` consommée avant tout autre geste (`node outils/handoff.js consommer
NEXUS-CONTINUITE-TERRAIN-2-20260922`), registre revalidé conforme.

## 1. `nexus-auth-corrige-65-20260923.js` — non transporté

Conforme à `decision-8.md` §1 : aucune action, ce point reste clos.

## 2. Les deux harnais — réalignés, dans le périmètre exact autorisé

Patch appliqué uniquement à `test_regularisation_manager_20260916.js` et
`test_cloture_services_obsoletes_20260916.js` : `window.NEXUS_CONFIG` (déjà autorisé), stub
`NexusBuild.versionner` (aucune assertion des deux fichiers ne porte sur le build-id ou le
versionnement, vérifié par grep avant patch — condition de `decision-8.md` §2), et le **vrai**
`nexus-page.js` exécuté puis relié (`ctx.NexusPage = ctx.window.NexusPage`), jamais réimplémenté.
Aucune ligne de `nexus-auth.js` touchée. Diffs complets et fichiers patchés persistés dans ce lot :
`test_regularisation_manager_20260916-harnais-realigne-1.js`,
`test_cloture_services_obsoletes_20260916-harnais-realigne-1.js`,
`preuve-execution-harnais-realignes-20260923.md`.

## 3. Exécution réelle sur l'arbre candidate actuel (`origin/rebuild/carburants-65-20260922` = `664af98`)

**Sans le patch** : même échec exact que `request-9.md` (« nexus-config.js n'a pas été chargé »),
reconfirmé sur ce HEAD candidate. **Avec le patch** : le chargement de `nexus-auth.js` réussit dans
les deux bancs — les deux premières assertions du harnais 1 (contenu métier réel) passent au vert.

## 4. Fait matériel nouveau : les assertions métier échouent, indépendamment du harnais

- **Harnais 1** — `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`,
  `nexusAppliquerCloturePilote`, `nexusEstManager`, `nexusCloturerServicesObsoletes` sont absentes de
  `nexus-auth.js`, vérifié sur le rail, sur la candidate (identiques entre eux) **et sur
  `origin/main`** (`5b047e008c07746b1c91846e50247ee594e07314`). Aucune des trois branches
  connaissables depuis ce canal ne les porte.
- **Harnais 2** — `nexusServiceCourant` existe mais c'est la version antérieure au 16/09/2026 : elle
  filtre sur la date locale de l'appareil (jamais `sites.timezone`) et journalise un service
  obsolète au lieu de le refermer. Mesuré réellement : `0 !== 1` UPDATE émis.

Cause plausible, non tranchée : le portage « mécanique » `290a217` (« porter la chaîne de
build/config du rail — 7 fichiers ») semble avoir apporté une version de `nexus-auth.js` antérieure
à la fonctionnalité « cycle pilote » du 16/09/2026, alors que les autres pièces de cette même
fonctionnalité (règles dans `nexus-pointage-regles.js`, UI dans `NEXUS-Cockpit-v2.html`, migration
`20260916195000_cloture_source_cycle_pilote.sql`) sont déjà présentes ou apportées séparément sur la
candidate. Non tranché : retracer l'historique complet dépasserait ce que ce canal peut faire sans
`git log -p`/`git blame` sur des refs distantes (également hors de portée, voir §5).

Détail complet, diffs, commandes exactes et sorties intégrales dans
`preuve-execution-harnais-realignes-20260923.md`.

## 5. Pourquoi ce retour s'arrête ici

Clause STOP de `decision-8.md` : « les harnais échouent encore après fourniture correcte des
dépendances runtime » → retour par `request-N.md`. Le mandat de ce réveil interdit explicitement
toute règle métier/UX/RLS/rôle — écrire les cinq fonctions manquantes ou refondre
`nexusServiceCourant` serait exactement cela ; je ne l'ai pas fait. Par construction,
« exécuter ensuite seulement la suite candidate complète » (`decision-8.md` §3) ne s'applique pas :
cette étape est conditionnée à des harnais qui atteignent leurs assertions métier. Je n'ai donc pas
exécuté `run-tests.js` sur une reconstruction partielle et nécessairement non exhaustive de l'arbre
candidate (`git ls-tree`, `git worktree add`, `git archive` refusent tous une approbation dans ce
canal — seule une liste de fichiers connue à l'avance a pu être extraite via `git show`) : le total
en résultant serait trompeur et ne répondrait pas à la question posée.

## 6. Transport — écriture candidate toujours inaccessible

`git push`/`git fetch`/`git ls-tree`/`git worktree add`/`git archive` vers/depuis
`rebuild/carburants-65-20260922` refusent tous une approbation qu'aucun humain ne peut donner dans
ce run automatisé, retesté explicitement. Conformément à `decision-8.md` §5, aucune gate Créateur
n'est demandée pour ce seul obstacle Git non-Production : le diff exact est persisté dans ce lot,
sur `handoff-continuite-20260920` elle-même (branche canonique).

## Guardians

- **Architecture & Cohérence** : patch limité aux deux fichiers de test ; aucune ligne de
  `nexus-auth.js`/`nexus-page.js`/`nexus-pointage-regles.js` modifiée ; `nexus-page.js` exécuté
  réellement, jamais réimplémenté.
- **Security & Isolation** : aucun secret, aucune opération réseau/Supabase (`fetch` lève dans les
  deux bancs), zone de travail locale supprimée avant la fin de la session.
- **Business Rules** : aucune règle métier ajoutée ou modifiée — le constat de ce retour est
  précisément qu'il en manque, rapporté et non corrigé.
- **QA/Regression** : preuve négative et positive toutes deux réexécutées dans cette session, pas
  supposées ; échec métier mesuré avec message exact (`0 !== 1`, `is not a function`).
- **Bible/Philosophie** : préférence donnée à rapporter un fait matériel nouveau plutôt qu'élargir
  silencieusement le périmètre pour obtenir un vert.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase Production/NEXUS Production, aucun
secret/PIN/service_role, aucune règle métier/UX/RLS/rôle ajoutée, aucun fichier applicatif touché.
Gates identité Test / Cloudflare de `decision-7.md` inchangées, non retouchées ici.
