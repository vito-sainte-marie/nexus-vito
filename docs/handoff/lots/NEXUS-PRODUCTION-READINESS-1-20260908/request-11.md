---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 11
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: defaut-10-mutation-sandbox
    classe: VERIFIED
    valeur: 6-sur-6_2650_balayages_ENOENT_reproduit_dans_bac_a_sable
  - id: defaut-10-isolation-parallele
    classe: VERIFIED
    valeur: 12_executions_paralleles_reelles_0_echec_0_ENOENT
  - id: suite-complete
    classe: VERIFIED
    valeur: 254_sur_263_9_echecs_historiques_inchanges_0_regression
  - id: guardians
    classe: VERIFIED
    valeur: 1_finding_nexusstock_arch002_deja_connu_0_nouveau_finding
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme_29_lots_10_avertissements_0_nouvelle_erreur
  - id: decision-9-consommee
    classe: VERIFIED
    valeur: commit_766b456_marque_consomme
  - id: recette-connectee
    classe: NOT_APPLICABLE
    valeur: secrets_absents_de_ce_canal_deja_fermee_par_run_34523206197
  - id: ci-verdict-candidat
    classe: NOT_APPLICABLE
    valeur: gh_indisponible_depuis_ce_canal_a_confirmer_par_orchestrator
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Défaut 10 fermé pour de bon, défaut Auth 13 confirmé fermé — prochaine étape : re-mesures Production et gate finale

## Ce qui était demandé

`decision-9.md` fermait le défaut Auth (§13) sur la foi du run connecté
`34523206197` et autorisait uniquement le correctif minimal restant : sortir
`__fixture_race_repro_20260910__.js` de la racine réelle du dépôt pour que
`test_fixtures_hors_depot_20260910.js` ne coure plus contre
`test_build_tracabilite_20260905.js`.

## Correctif appliqué (commit `ed66744`)

`test_fixtures_hors_depot_20260910.js` : `listerPuisCopier` accepte
désormais une racine source explicite (par défaut `RACINE`, comportement de
la contre-épreuve inchangé — elle ne fait que lire). La reproduction de
mutation crée un répertoire temporaire dédié (`fs.mkdtempSync(os.tmpdir())`)
et y écrit/efface la fixture, puis y fait balayer `listerPuisCopier` —
jamais plus la racine réelle du dépôt. Aucune logique métier, aucun script
de release, aucune garde Production touchés.

## Preuves réellement exécutées

- **Mutation toujours réelle dans son bac à sable** : `node
  test_fixtures_hors_depot_20260910.js` seul → 6/6, dont la reproduction de
  l'`ENOENT` (2650 balayages observés sur 4 s) et la contre-épreuve (20
  balayages sans écriture concurrente, jamais d'`ENOENT`).
- **Preuve négative de l'isolation** : 12 exécutions complètes et réelles (3
  rounds × 4, deux processus indépendants par round) de
  `test_fixtures_hors_depot_20260910.js` et
  `test_build_tracabilite_20260905.js` lancés en parallèle — **0 échec, 0
  ENOENT** sur les deux fichiers. Avant ce correctif, cette même
  configuration reproduisait le défaut par intermittence (documenté dans
  `blocages-ouverts-1.md`, section « ROUVERT le 10/09/2026 »).
- **Suite complète** : `node run-tests.js` → **254/263**, les 9 échecs
  historiques strictement inchangés, **0 régression**.
- **Guardians** : `node outils/guardians-router.js` → 1 finding, la
  collision `NexusStock` déjà connue et tracée (ARCH-002, non bloquante par
  arbitrage Q73/Q74) — **0 nouveau finding**. `node outils/guardian-qa.js` →
  0 finding (263 épreuves). `node outils/verifier-apprentissage.js` →
  conforme (20 règles).
- **Handoff** : `node outils/handoff.js verifier` → conforme (29 lots, 10
  avertissements préexistants, 6 dérogations, 0 nouvelle erreur).
  `decision-9.md` consommée (`node outils/handoff.js consommer
  NEXUS-PRODUCTION-READINESS-1-20260908`).

Documentation mise à jour dans le même esprit que le reste du lot (commit
`319c13d`) : `blocages-ouverts-1.md` porte désormais la fermeture définitive
du §10, et `faits-pret-pour-production.json` reflète les fermetures de §10
et §13 sans toucher `aucunBlocageNonResolu.valeur` — cette déclaration reste
celle de Frédéric, jamais celle de Claude.

## Ce qui n'a pas pu être vérifié depuis ce canal

**Recette connectée** : `outils/recette-navigateur-test.js` se dégrade
explicitement (`NEXUS_TEST_MANAGER_PIN`/`NEXUS_TEST_CREATEUR_PIN` absents de
ce runner, ENV-003, non bloquant) — comme à chaque réveil de ce fil, ce
canal `issue_comment` n'a jamais accès aux secrets Test. Ce point n'a pas
besoin d'être rejoué ici : `decision-9.md` le ferme déjà sur la preuve du
run `34523206197`, antérieur à cette session.

**Verdict CI calculé sur le SHA candidat** :
`outils/evaluer-pret-pour-production.js` appelle `gh run list`, indisponible
dans ce canal (approbation réseau impossible en run automatisé). Les
commits de ce lot (`ed66744`, `058949c`, `319c13d`) sont poussés sur
`claude/issue-28-20260910-2006`, ce qui déclenche un run `push` réel du
workflow `Tests` — mais la chaîne connectée (semis, journal Live, Playwright,
recette navigateur) y est `skipped` par construction
(`if: github.ref == 'refs/heads/config-par-environnement'`), donc ce run ne
peut de toute façon pas revalider la recette. Seule la « Suite de
non-régression et verdict » (inconditionnelle) y sera exercée en conditions
CI réelles.

## Demande pour la suite

Le périmètre autorisé par `decision-9.md` est terminé et prouvé
localement. Pour la suite, ce lot ne demande plus qu'un geste Orchestrator,
déjà autorisé :

1. **Intégrer** le correctif (`ed66744`, `058949c`, `319c13d`) sur
   `config-par-environnement`, et confirmer par `gh run list --commit
   <SHA>` que la « Suite de non-régression et verdict » est verte sur les
   deux événements (`push` et `pull_request`) — condition nécessaire pour
   que `ci_et_guardians_conformes` cesse d'être `BLOQUE`.
2. **Rejouer les re-mesures Production SELECT-only déjà autorisées**
   (`re-mesure-finale-gate-1.md` : référentiel Advisor, cohérence
   `site`/`site_id`, résolution du fuseau, reprise des services ouverts,
   absence d'écriture concurrente, non-existence de `nexus_live_events`) —
   la dernière mesure (`preuve-re-mesure-finale-1.md`, 10/09 14 h 02 UTC)
   expire le **11/09/2026 à 14 h 02 UTC**, dans la fenêtre restante.
3. **Préparer la gate finale spécifique** : une fois 1 et 2 acquis, rejouer
   `node outils/evaluer-pret-pour-production.js --sha <SHA intégré>` pour
   recalculer les dix critères de `faits-pret-pour-production.json` sur le
   candidat réel — pas raconté — puis soumettre à Frédéric la déclaration de
   `aucunBlocageNonResolu` (§7 restant `cause non isolée`, non bloquant par
   nature, à sa seule appréciation) et la gate humaine elle-même.

Aucune nouvelle architecture n'a été introduite. `Prêt pour Production` ne
vaudra à aucun moment autorisation Production ; celle-ci reste explicitement
celle de Frédéric, sur une release et un impact mesurés.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase
Production, aucun déploiement ni rollback Production, aucune copie non
anonymisée de Production, aucun secret/PIN/service_role lu, affiché ou
exposé, aucun élargissement de surface de sécurité. Migration 21 reste
exclue de cette release, inchangée.
