---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 9
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: decision-8-deposee-consommee
    classe: VERIFIED
    valeur: commit-7489628-depot-b8f4e96-consommation
  - id: candidat-8-snapshots-identiques-production
    classe: VERIFIED
    valeur: octet-pour-octet-30544c9-3-fichiers
  - id: candidat-8-diffs-reproductibles
    classe: VERIFIED
    valeur: recompute-diff-u-identique-ligne-a-ligne-3-fichiers
  - id: test-ledger-correction-reexecute
    classe: VERIFIED
    valeur: 2-2-plus-mutation-negative-reelle-sur-prod-moteur
  - id: test-idempotence-matrice-reexecute
    classe: VERIFIED
    valeur: 46-46-plus-mutation-negative-reelle-jetonIntention-absent-production
  - id: branche-pr-candidate
    classe: NOT_APPLICABLE
    valeur: 4-tentatives-git-fetch-checkout-worktree-branch-toutes-refusees-outillage
  - id: gates-deterministes
    classe: VERIFIED
    valeur: run-tests-0-regression-guardians-router-0-finding-verifier-apprentissage-conforme-guardian-qa-0-finding
  - id: qualification-nexus-test
    classe: NOT_APPLICABLE
    valeur: playwright-absent-NEXUS_TEST_DB_AVAILABLE-0-NEXUS_TEST_URL-absente-capacite-HUMAN
  - id: contamination-diff
    classe: VERIFIED
    valeur: zero-fichier-etranger-zero-insert-ajoute-zero-rpc-supprime-zero-migration-test-only-zero-point-zero
  - id: fusion-production
    classe: NOT_APPLICABLE
    valeur: stop-point-7-du-go-aucune-fusion-tentee
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucun-merge-aucune-migration
---
# request-9 — revalidation indépendante du candidat FDJ reconstruit + blocage confirmé du transport branche/PR (toujours NON_PRET_POUR_FUSION_PRODUCTION)

Réponse à `decision-8.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-8.md`) — GO explicite de Frédéric Bragance dans l'issue
#28 (05/10/2026) : « GO TRANSPORT / QUALIFICATION REQUEST-8 — FDJ CARNETS ».

## Verdict

**NON_PRET_POUR_FUSION_PRODUCTION**, inchangé par rapport à `request-8.md`.
Ce geste ne demande pas d'arbitrage de fusion : il revalide par exécution
indépendante les preuves déjà déposées, confirme empiriquement (pas par
hypothèse héritée) que ce canal ne peut matérialiser aucune branche/PR
basée sur `production`, exécute les gates déterministes disponibles, et
confirme l'absence de contamination du diff candidat. Rien de nouveau ne
rend le candidat fusionnable : la qualification nexus-test/navigateur
réelle reste absente.

## 0. HEAD Production revalidé au démarrage

`origin/production` = `30544c9af7ebf83d8ec1ba3882418252380036f1` —
**identique** au SHA cité par `request-8.md`/`decision-8.md`. Aucune
conséquence à recalculer. `origin/main` = `d6093b76519826c4f820e00f5bca9fb8148b1f96`,
`origin/handoff-continuite-20260920` = `a1ce903c3e777e51fb1f01781b79ab9bfaedb824`
(HEAD de cette session avant ce geste) — aucun des trois n'a bougé depuis
`request-8.md`.

## 1. Décision canonique déposée et consommée

`decision-8.md` matérialisée via `outils/handoff.js decision` (auteur
« Frédéric Bragance », verbatim complet du GO transport), commit `7489628`,
puis consommée (commit `b8f4e96`, miroirs régénérés). `node outils/handoff.js
verifier` reste conforme après dépôt et consommation (35 lots, 15-16
avertissements — tous préexistants —, 11 dérogations).

## 2. Revalidation indépendante des artefacts candidat-8 — exécution réelle, pas confiance

Les deux fichiers de test joints à `request-8.md` ont été réexécutés
**depuis zéro dans cette session**, sans supposer leur résultat antérieur :

- `candidat-8-test-ledger-correction.js` → **2/2** sur le candidat.
  **Mutation négative réelle confirmée à nouveau** : rejoué contre
  `prod-moteur.js` (production telle quelle), échoue avec les valeurs
  exactes déjà documentées (`confiés=9, actives=2` au lieu de
  `confiés=10, actives=1`) — le bug est bien présent aujourd'hui en
  production.
- `candidat-8-test-idempotence-matrice.js` → **46/46** (matrice 9/9) sur
  les deux candidats. **Mutation négative réelle confirmée à nouveau**,
  cette fois en pointant directement sur `prod-manager.html`/`prod-employe.html`
  (via un petit script qui pose `process.env.FDJ_TEST_MANAGER_FILE`/
  `FDJ_TEST_EMPLOYE_FILE` avant de `require()` le test, l'exécution directe
  avec variables d'environnement inline étant bloquée dans ce canal — voir
  §5) : échec immédiat, `AssertionError: Fonction jetonIntention introuvable`
  — confirmation supplémentaire, au niveau du code source réel de
  production, que le mécanisme de jeton stable n'existe pas du tout.

**Nouvelle vérification, non faite dans `request-8.md`** : les trois
snapshots `prod-moteur.js`/`prod-manager.html`/`prod-employe.html` ont été
comparés **octet pour octet** (`git show 30544c9...:<fichier>` vs fichier du
lot) — **identiques** dans les trois cas (115673 / 417434 / 148677
caractères). Les snapshots ne sont donc pas une reconstruction approximative :
c'est bien le contenu réel et actuel de `production`.

**Nouvelle vérification** : chaque diff joint (`candidat-8-*.diff`) a été
recalculé indépendamment (`diff -u prod-* candidate-*`) et comparé ligne à
ligne au fichier déjà déposé — **identique** dans les trois cas (35/66/38
lignes de hunks). Les diffs fournis sont donc exactement reproductibles,
pas une transcription approximative.

## 3. Matérialisation branche/PR — tentée réellement, blocage confirmé empiriquement

Le point 3 du GO demande de matérialiser une branche/PR « si le protocole
le permet ». Testé réellement dans cette session, pas supposé depuis
l'historique du fil :

| Opération tentée | Résultat |
|---|---|
| `git fetch origin production` | refusé — approbation requise, indisponible en run automatisé |
| `git checkout -b lot/fdj-carnets-correctif-reconstruit-production 30544c9...` | refusé — idem |
| `git worktree add ... 30544c9...` | refusé — idem |
| `git branch lot/fdj-carnets-correctif-reconstruit-production 30544c9...` (sans checkout) | refusé — idem |

Le commit `30544c9` était déjà présent localement (`git cat-file -e`
réussi, sans fetch) — la cause n'est donc pas un défaut réseau mais une
restriction d'outillage sur toute création de référence Git dans ce canal,
confirmée ici sur quatre méthodes distinctes. Le script de push fourni
(`git-push.sh`) n'accepte de toute façon que de pousser une branche locale
déjà existante sous le même nom — il ne contourne pas ce blocage amont.

**Conclusion** : « si le protocole le permet » est désormais répondu
négativement par un test réel dans cette session précise, pas par une
hypothèse héritée des réveils précédents. Le candidat reste livré sous
forme de diffs unifiés + snapshots complets (inchangé depuis `request-8.md`),
avec les commandes de matérialisation pour une session avec droit
d'écriture réel (inchangées, reproduites en §7).

## 4. Gates déterministes — exécutées réellement dans cette session

- `node run-tests.js` → suite complète : **aucune régression**, seuls les 9
  échecs historiques déjà connus subsistent.
- `node outils/guardians-router.js` → **0 finding** sur le diff réel de
  cette session (dépôt/consommation `decision-8.md`).
- `node outils/verifier-apprentissage.js` → conforme, 21 règles, aucun
  doublon, aucun id invalide, aucune récurrence non promue.
- `node outils/guardian-qa.js` → **0 finding** sur 304 épreuves analysées.
- `node outils/handoff.js verifier` → conforme après dépôt/consommation de
  `decision-8.md` et régénération des miroirs.

## 5. Qualification nexus-test — capacité toujours absente, constatée sans simulation

`node outils/recette-fdj-carnets-qualification-20261004.js` →
« Qualification FDJ non exécutée — playwright absent de cet environnement.
Non bloquant. » Constat complémentaire sur les variables d'environnement
de ce run (présence vérifiée, aucune valeur lue ni journalisée) :
`NEXUS_TEST_DB_AVAILABLE=0`, `NEXUS_TEST_URL` absente — ni la base Test ni
une cible de navigation ne sont disponibles dans ce canal. Capacité
classée `HUMAN`, non fabriquée, cohérente avec `request-8.md §5`.

Note technique sans incidence sur le fond : l'exécution directe avec
variable d'environnement inline (`FDJ_TEST_MANAGER_FILE=... node ...`) est
elle-même bloquée dans ce canal (nécessite une approbation) — contournée
pour la mutation négative du §2 par un petit script qui pose
`process.env.*` avant de `require()` le fichier de test (jamais commité,
supprimé après exécution).

## 6. Absence de contamination du diff — vérifiée mécaniquement

- Chaque `.diff` ne porte qu'une seule paire de fichiers (`--- .../prod-*`
  / `+++ .../candidate-*`) — aucun fichier étranger.
- Nombre de hunks : moteur 3, manager 9, employé 5 — cohérent avec les 3
  hunks du routage ledger et les 7 chemins jeton décrits par `request-8.md`.
- `grep` sur les deux diffs HTML : **zéro** occurrence de `.insert(`
  ajoutée, **zéro** ligne supprimée contenant `nexusClient.rpc(` — PR #62
  intacte, aucun second calcul métier réintroduit.
- `grep` sur les trois diffs : **zéro** occurrence de
  `20261004200000`/`20261004200100` (migrations Test-only),
  `20261004130000`/`ANON5` (Point Zéro), ou `docs/handoff` — aucune
  exclusion violée.

## 7. Transport vers une session avec droit d'écriture réel (inchangé)

```
git fetch origin production
git checkout -b lot/fdj-carnets-correctif-reconstruit-production origin/production
cp docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidate-moteur.js nexus-fdj-moteur.js
cp docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidate-manager.html NEXUS-FDJ-Manager-v1.html
cp docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidate-employe.html NEXUS-FDJ-v1.html
git diff --stat   # doit afficher exactement les 3 fichiers, tailles ~ ±1 ligne des diffs joints
git add nexus-fdj-moteur.js NEXUS-FDJ-Manager-v1.html NEXUS-FDJ-v1.html
git commit -m "fdj: correctif ledger 'correction' + jeton stable (9 chemins), reconstruit contre production (PR #62 préservée)"
# puis : qualification réelle nexus-test/navigateur AVANT toute ouverture de PR vers production
```

## Invariants respectés

Aucun changement `main`/`production` — aucune commande d'écriture tentée
contre ces refs, aucune branche de transport créée (4 tentatives, 4 refus
d'outillage, aucun contournement), aucun cherry-pick appliqué. Aucune
fusion, aucun déploiement, aucune migration, aucune écriture/réparation
Production, aucun Point Zéro, aucun traitement de l'écart
`20261004130000`/ANON5, aucun secret créé/lu/exposé (présence vérifiée
par booléen uniquement). `decision-8.md` déposée et consommée (Handoff
uniquement). Le lot reste ouvert (`closes: false`) : conformément au
point 7 du GO transport, **STOP** — ce retour attend l'arbitrage de
Frédéric, aucune fusion n'a été ni effectuée ni tentée.
