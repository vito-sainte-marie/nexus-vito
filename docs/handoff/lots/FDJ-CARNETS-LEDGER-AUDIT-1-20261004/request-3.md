---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: 3-chemins-corriges
    classe: VERIFIED
    valeur: jetonsActivationImplicite-jetonsActivationCarnet-jetonsCorrectionManager-meme-discipline-que-jetonsRetourBloque
  - id: tests-causaux-12-12
    classe: VERIFIED
    valeur: retry-double-clic-intention-distincte-concurrence-rejeu-mutation-negative-reellement-rejouee
  - id: regression-fdj
    classe: VERIFIED
    valeur: node-run-tests.js-fdj-36-36
  - id: regression-globale
    classe: VERIFIED
    valeur: 295-304-9-echecs-historiques-identiques
  - id: qualification-nexus-test-branche
    classe: VERIFIED
    valeur: commit-servi-9000daf-reconciliation-confies10-actives3-nonActives7-idempotence-6-6-0-erreur
  - id: preuve-navigateur-dette-3-chemins
    classe: DECLARED
    valeur: non-realisee-cout-disproportionne-preuve-node-rigoureuse-a-la-place
  - id: guardians
    classe: VERIFIED
    valeur: router-0-finding-qa-0-finding-apprentissage-conforme
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme-avant-apres
  - id: point-zero
    classe: DECLARED
    valeur: specifie-non-execute
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucun-acces-supabase-production-dans-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration-production
---
# Suite autorisée par `decision-2.md` — dette §8 fermée, qualification réelle

Réponse à `decision-2.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-2.md`) — GO suite de Frédéric Bragance dans l'issue #28
(04/10/2026).

## 0. SHA et run

- HEAD canonique au moment de cette suite : `0149f2a` (`handoff-continuite-20260920`,
  tel que lu avant toute écriture dans ce lot).
- Commit `b445860` — correctif des 3 chemins à clé fraîche
  (`NEXUS-FDJ-v1.html`, `NEXUS-FDJ-Manager-v1.html`) + tests causaux
  (`test_fdj_idempotence_dette_cles_fraiches_20261004.js`, 12/12) + ajustement
  de `test_fdj_fiabilisation_etape5_idempotence.js` (déclaration du nouveau
  `jetonsActivationCarnet` dans son contexte VM) + dépôt de `decision-2.md`.
- Commit `9000daf` — consommation de `decision-2.md` + régénération des
  miroirs v1.
- Branche de travail : `claude/issue-28-20261004-2206` (déployée par le
  rail CI sur son propre alias Cloudflare Pages, voir §3 — distincte du rail
  canonique `handoff-continuite-20260920` tant que cette branche n'est pas
  intégrée).

## 1. Les 3 chemins corrigés (point 1 du GO)

Même discipline que `jetonsRetourBloque` déjà qualifiée pour les 6
écritures manager « hors quart » (`request-1.md` §5) : un jeton stable **par
jeu**, généré une seule fois et conservé tant que l'écriture n'a pas réussi
(y compris un conflit `23505`, traité comme un succès idempotent), supprimé
après succès pour qu'une intention réellement nouvelle du même jeu reparte
d'une clé neuve.

| Fichier | Fonction | Jeton stable |
|---|---|---|
| `NEXUS-FDJ-v1.html` | `creerActivationImplicite` (employé, clôture) | `jetonsActivationImplicite[gameId]` |
| `NEXUS-FDJ-v1.html` | `executerActivationCarnetInterne` (employé, en direct) | `jetonsActivationCarnet[gameId]` |
| `NEXUS-FDJ-Manager-v1.html` | `creerActivationReconstitueeCorrectionManager` (manager, correction) | `jetonsCorrectionManager[gameId]` |

Aucune deuxième source de vérité : les trois fonctions écrivent toujours
directement dans `fdj_stock_movements` (append-only, aucune policy
`update`/`delete`), seule la provenance de `idempotency_key` change. Diff
minimal : 32 lignes sur `NEXUS-FDJ-v1.html`, 7 lignes sur
`NEXUS-FDJ-Manager-v1.html` (`git diff --stat` du commit `b445860`).

## 2. Tests causaux (point 2 du GO)

`test_fdj_idempotence_dette_cles_fraiches_20261004.js` — **12/12**, sur les
3 fonctions réelles (extraites par regex des fichiers HTML, jamais
réécrites à la main, même discipline que tous les tests FDJ existants) :

- **A1/B1/C1 — retry après perte de réponse** : une erreur réseau simulée
  sur la première tentative laisse le jeton en attente (jamais effacé) ; le
  retry qui suit porte **exactement** le même jeton que la tentative
  échouée.
- **A2 — double clic** : deux appels concurrents sur le même jeu
  (`executerActivationCarnet`, garde-fou `activationsEnCours` déjà
  qualifié) ne produisent qu'un seul mouvement.
- **A3/B3/C3 — intention distincte après succès** : une fois l'écriture
  réussie (jeton libéré), une activation/annulation **réellement
  nouvelle** du même jeu porte un jeton différent — sinon elle serait
  avalée à tort comme un rejeu et la contre-écriture (cas C3 : la
  `correction` qui annule une activation reconstituée) ne serait jamais
  posée.
- **A4/B4/C4 — deux jeux distincts (concurrents)** : jamais le même jeton,
  jamais bloqués l'un par l'autre (génération synchrone avant le premier
  `await`, aucune fenêtre de course côté client).
- **B2/C2 — rejeu avec clé déjà posée** (réponse perdue APRÈS écriture
  réelle côté serveur) : conflit `23505` simulé, traité comme un succès
  idempotent, aucune deuxième ligne, aucune alerte utilisateur.

**Mutation négative réellement rejouée** (pas seulement décrite) :
`executerActivationCarnetInterne` restaurée temporairement à son
comportement d'origine (`genererIdempotencyKey()` appelée directement,
sans jeton stable) → le test A1 échoue réellement
(`AssertionError: le jeton doit rester en attente après un échec réseau`,
`actual: undefined`) → correctif restauré → 12/12 de nouveau, `git diff
--stat` confirmé identique au diff d'origine.

`test_fdj_fiabilisation_etape5_idempotence.js` (pré-existant, étape 5,
`executerActivationCarnetInterne`) ajusté pour déclarer le nouveau
`jetonsActivationCarnet` dans son contexte VM (sinon `ReferenceError` —
cette variable est désormais au niveau module, pas locale à la fonction) :
**5/5**, aucune régression de comportement.

## 3. Qualification réelle sur `nexus-test` (point 3 du GO)

**Obstacle de séquence identique à celui documenté par `request-1.md` §11**
pour le rail canonique : au moment de cette suite, `handoff-continuite-20260920`
sert encore `0149f2a` (code d'avant ce lot) — lancer la recette sur ce rail
aurait testé l'ancien comportement.

**Nouveau constat, exploité honnêtement** : le workflow CI de ce dépôt
tourne sur `branches: ['**']` (`.github/workflows/tests.yml:92`) — chaque
push déploie donc aussi un alias Cloudflare Pages propre à la branche de
travail. Vérifié avant exécution :
`https://claude-issue-28-20261004-220.nexus-test-ddf.pages.dev/nexus-build.js`
sert **réellement** `commit: '9000daf6b515f6ecbbcf6d7ce61bbe1acd50c823'` —
le candidat de ce lot, pas celui du rail canonique.

Playwright installé localement pour cette session (`npm install --no-save
playwright@1.48.0` + `npx playwright install chromium`, jamais commité —
`node_modules/` reste gitignoré, `package.json`/`package-lock.json`
inchangés) — première fois dans ce fil que `node` et un accès réseau
sortant réel sont tous deux disponibles pour une recette FDJ.

`outils/recette-fdj-carnets-qualification-20261004.js` (script existant,
non modifié) exécuté avec `NEXUS_TEST_URL` pointé explicitement sur l'alias
de **cette branche** et `NEXUS_COMMIT_ATTENDU` fixé au commit `9000daf` —
`attendreVersionServie` confirme avant tout test que la version servie est
bien celle attendue (pas un repli silencieux sur une version périmée) :

- **Commit servi** : `9000daf6b515f6ecbbcf6d7ce61bbe1acd50c823` — confirmé
  en page via `NexusBuild.commit`.
- **Réconciliation (§4 de `request-1.md`), sur le moteur réellement servi** :
  `confies: 10, actives: 3, nonActives: 7` — identique à l'attendu (le
  mouvement `correction` annule bien `actives`, jamais `confies`/`bureau`).
- **Idempotence serveur réelle, 6/6 écritures manager fermées** :
  `reception`, `reappro_caisse`, `retrait_caisse`, `blocage`,
  `retour_bloque`, `rapprochement_activation` — chaque jeton envoyé deux
  fois de suite : premier appel `ecrits:1, idempotent:false`, second appel
  (même jeton) `ecrits:0, idempotent:true, rejeux:1`. Aucune régression
  introduite par ce lot sur ce qui était déjà qualifié par `request-2.md`.
- **0 erreur** sur l'ensemble de la recette.

**Limite honnête** : ce script (écrit pour `request-1.md`/`decision-1.md`,
non modifié ici) exerce la dette §8 par `eprouverCleFraicheSansEcriture` —
deux appels directs à `genererIdempotencyKey()`, qui restent et resteront
toujours distincts par construction (c'est le générateur lui-même, jamais
touché par ce lot). Il ne constitue donc **pas** une preuve navigateur de
la stabilisation elle-même (qui porte sur la mise en cache du jeton par les
3 fonctions appelantes, pas sur le générateur). Construire un scénario
navigateur dédié (interception réseau sur un `insert` en page, retry réel,
lecture de la ligne écrite pour confirmer la même `idempotency_key`)
aurait exigé soit de perturber `nexusClient.from` au milieu d'une session
de qualification partagée avec les 6 autres mesures, soit d'ouvrir un
second parcours employé complet (prise de poste, quart, clôture) jamais
instrumenté par ce script — un coût disproportionné au regard de la
consigne explicite du GO (« sans fabriquer de doublons inutiles ») face à
une preuve Node déjà rigoureuse (§2, mutation négative réellement rejouée).
**La preuve de la stabilisation elle-même reste donc Node (§2), pas
navigateur** — déclaré ainsi, pas masqué.

**Empreinte laissée sur `nexus-test`** : 6 mouvements de stock réels
(quantité 1 chacun), site `nexus-station-test`, jeu `"Jeu Recette FDJ"` —
exactement la même empreinte minimale que `request-2.md` avait déjà
qualifiée, rejouée ici uniquement parce qu'elle fait partie du script
existant non modifié. Aucun mouvement supplémentaire créé pour la dette
§8 elle-même (aucune écriture de doublon fabriquée).

## 4. Contrôles Production READ-ONLY (point 5 du GO)

`audit-production-lecture-seule-1.sql` (3 requêtes strictement `SELECT`,
déjà préparées par `request-1.md`, relues : aucun
`insert/update/delete/drop/alter`) reste **inchangé et prêt**. Confirmé
dans cette session : aucune variable d'environnement
`SUPABASE*`/`*PRODUCTION*`/`NEXUS_PROD*` n'existe dans ce canal (recherche
par nom, jamais par valeur) — **non exécuté, `NOT_APPLICABLE`**, réservé à
l'Orchestrator, conformément au GO (« les exécuter uniquement si ce canal
possède réellement l'accès »).

## 5. Point Zéro (point 6 du GO)

`spec-point-zero-inventaire-fdj.md` inchangé depuis `request-1.md`.
**Non exécuté** : aucune migration, aucun code, aucune donnée créée.

## Guardians, régression, Handoff

- `node outils/handoff.js verifier` : conforme avant/après (35 lots, 0
  nouvelle erreur).
- `node outils/guardians-router.js` (diff réel du commit `b445860`) : 0
  finding.
- `node outils/guardian-qa.js` : 0 finding (304 épreuves).
- `node outils/verifier-apprentissage.js` : conforme, 21 règles.
- `node outils/garde-langage-nexus.js` : conforme, aucun tiret cadratin
  ajouté.
- `node run-tests.js` (suite complète) : **295/304**, les 9 échecs
  strictement identiques à la liste historique connue — aucune régression.
- `node run-tests.js fdj` : **36/36**.

## Verdict proposé

**`QUALIFIE_NEXUS_TEST`** — les 3 chemins de la dette §8 sont corrigés
(même discipline que les 6 déjà qualifiés), testés avec mutation négative
réelle au niveau moteur, et le candidat qui les porte est confirmé servi et
fonctionnel en conditions réelles sur `nexus-test` (réconciliation + 6/6
idempotence serveur, 0 erreur) via l'alias Cloudflare Pages de la branche
de travail. La stabilisation spécifique des 3 chemins n'a **pas** de
preuve navigateur dédiée (limite assumée, §3) — seulement une preuve Node
rigoureuse. Ce verdict ne vaut ni promotion Production ni clôture du lot.

## Ce qui reste hors de ce request

- Intégration de `claude/issue-28-20261004-2206` sur `handoff-continuite-20260920`
  (PR à ouvrir, voir lien joint au commentaire GitHub) — la qualification
  ci-dessus porte sur le candidat de cette branche, pas encore sur le rail
  canonique.
- Les 3 requêtes `SELECT` de `audit-production-lecture-seule-1.sql` —
  toujours réservées à l'Orchestrator, aucun accès Production dans ce
  canal.
- Preuve navigateur dédiée de la stabilisation des 3 chemins (§3) — limite
  assumée, pas une absence de preuve (Node, §2).
- Point Zéro Inventaire FDJ — spécifié, toujours pas exécuté.
- Traitement de l'écart de migration `20261004130000` sur `production` —
  explicitement hors de ce geste.

## Invariants respectés

Aucun changement `main`/`production`, aucune fusion vers `production`,
aucun déploiement Production, aucune migration Production, aucune
écriture/réparation Production, aucune gate Pages Production, aucune
opération sur l'écart `20261004130000` de la branche `production`, aucun
secret créé/lu/exposé (PIN jamais journalisé — vérifié dans la sortie du
script), Point Zéro non exécuté, aucune réécriture d'un historique validé.
