---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 18
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
    valeur: main=5b047e0 production=2bc7b39
  - id: decision-11-consommee
    classe: VERIFIED
    valeur: outils-handoff-js-consommer-commit-ab20a85
  - id: drift-11-migrations-reclassifie
    classe: VERIFIED
    valeur: git-diff-name-status-origin-production-HEAD-supabase-migrations-11-ajouts-0-suppression-0-modification
  - id: correctif-login-isole
    classe: VERIFIED
    valeur: 20260904175747_login_non_enumerable-non-test-ci-non-injecte-dans-65
  - id: delta-candidats-mesure
    classe: VERIFIED
    valeur: 65-1-migration-62-12-migrations-conforme-classement-gates-1-md
  - id: mecanisme-reconstruction-ecrit-et-teste
    classe: VERIFIED
    valeur: outils-reconstruire-baseline-candidat-sh-10-10-epreuves-dry-run-uniquement
  - id: regression
    classe: VERIFIED
    valeur: node-run-tests-js-0-regression-9-echecs-connus-inchanges
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router-0-nouveau-finding-verifier-apprentissage-guardian-qa-conformes
  - id: baseline-machine-readable-deposee
    classe: VERIFIED
    valeur: baseline-programme-stabilisation-1-json-et-md
  - id: execution-reelle-mecanisme
    classe: NOT_APPLICABLE
    valeur: aucun-projet-supabase-jetable-ni-acces-reseau-depuis-ce-canal-stop-explicite
  - id: isolation-cloudflare-candidats
    classe: NOT_APPLICABLE
    valeur: aucun-acces-cloudflare-inchange
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# `decision-11.md` consommée — mécanisme minimal prêt, baseline déposée, STOP sur ressource jetable

## 1. Décision consommée

`decision-11.md` (GO Créateur, `APPROVED_WITH_CONDITIONS`, `closes: false`, réponse à
`request-17.md`) matérialisée via `outils/handoff.js decision` puis consommée via
`outils/handoff.js consommer NEXUS-CONTINUITE-TERRAIN-2-20260922` (commit `ab20a85`). Registre
conforme avant/après (32 lots, mêmes avertissements préexistants, 0 nouvelle erreur). Miroirs
régénérés.

**Note de forme, assumée** : le réveil nommait cette décision « sur request-18 ». La demande
active au moment du dépôt était `request-17.md` (aucun `request-18.md` n'existait) — `decision-11.md`
y répond ; ce fichier-ci EST `request-18.md`, le prochain retour canonique, pas l'objet de
l'arbitrage précédent.

## 2. Cible de qualification et drift reclassifié (decision-11.md §1, §6)

Mesuré le 24/09/2026 contre les refs Git réellement présentes (`origin/production`,
`origin/handoff-continuite-20260920`, `origin/reception-regularisation-20260919`,
`origin/fdj-vague1-cycle-caisse-20260916`) — aucun `git fetch`/`git push` nécessaire.

**Correction par rapport au 22/09** : les « 11 migrations Test/CI absentes de tout arbre Git »
(`classement-gates-etat-git-62-65-1.md` §2, `dossier-decision-pr-62.md` §8.1) sont en réalité
présentes sur le rail `handoff-continuite-20260920` (`git diff --name-status origin/production
HEAD -- supabase/migrations/` : 11 ajouts, 0 suppression, 0 modification). Elles manquaient à
l'arbre `production`/candidates, pas à Git dans son ensemble. Ceci ne referme PAS la gate « dérive
de schéma Supabase Test » (le côté base de données réelle reste non vérifié depuis ce canal — aucun
accès), mais corrige la description du drift.

**Sur ces 11 fichiers, un seul n'est pas Test/CI** : `20260904175747_login_non_enumerable`. C'est
le « correctif Login » nommé par `decision-11.md` §3 — une mesure de sécurité réelle (fermeture
d'une énumération anonyme de l'annuaire employés via `employees_public`), dont l'en-tête porte
lui-même : « ORDRE DE PROMOTION — INCOMPATIBLE AVEC LE CODE ACTUELLEMENT EN PRODUCTION ».
Conformément à la décision : **non injecté dans `#65`**, isolé et tracé comme dette infrastructure/
baseline distincte pour la première fois sous forme machine-readable. Les 10 autres sont Test/CI
par construction (nom auto-déclaratif, rôle `nexus_ci_recette`, ou dépendance à `nexus_live_events`,
elle-même déjà exclue de Production par le manifeste historique).

Détail fichier par fichier, avec motif : `baseline-programme-stabilisation-1.json` /
`baseline-programme-stabilisation-1.md`, déposés dans ce lot.

## 3. Mécanisme minimal pour `#65` (et générique pour `#62`) — decision-11.md §4, §5

`outils/reconstruire-baseline-candidat.sh` (nouveau, **aucune nouvelle logique de reconstruction** :
orchestre `outils/reconstruire-base-test.sh`, inchangé). Principe : `origin/production` est un
ancêtre direct de `#62` et `#65` (vérifié par le script lui-même avant tout geste) — le répertoire
`supabase/migrations/` de chaque branche candidate est donc exactement Production + son propre
delta, sans aucune des 11 migrations ci-dessus. Reconstruire depuis un git worktree jetable
détaché sur la branche candidate donne directement la baseline demandée, sans filtrer ni réordonner
quoi que ce soit — aucun nouveau module produit, réutilisation stricte de l'existant.

Gardes fail-closed : refuse la cible Production, refuse la cible Test historique `nexus-test`
(non détruit, non réutilisé pour cette preuve — decision-11.md §2), refuse une candidate dont
Production n'est pas un ancêtre, refuse un delta qui ne serait pas un ajout pur. Mode
`DRY_RUN=oui` : audit complet (SHA résolus, delta imprimé) sans créer de worktree ni ouvrir de
connexion.

**Preuve apportée, réellement exécutée** : `test_reconstruire_baseline_candidat_20260924.js`,
10/10, toutes en `DRY_RUN` — delta exact mesuré contre les refs réelles (1 migration pour `#65`,
12 pour `#62`, conforme à `classement-gates-etat-git-62-65-1.md` §3), les 4 gardes de refus
vérifiées individuellement, aucun worktree créé (vérifié par `git worktree list` avant/après).
`node run-tests.js` : aucune régression, seuls les 9 échecs connus subsistent. `guardians-router.js` :
0 nouveau finding (seule la collision `NexusStock` déjà tracée `ARCH-002` subsiste, sans rapport).
`verifier-apprentissage.js` et `guardian-qa.js` : conformes.

## 4. STOP — besoin exact avant exécution réelle (decision-11.md §4)

Exécuter réellement ce mécanisme requiert un **projet Supabase jetable/isolé**, distinct de
Production (`uzhjpqpctpvxytxpxoqz`) et du Test historique (`udljdqxerrbbbajxubfn`), plus
`NEXUS_TEST_DB_URL` (ou équivalent) pointant dessus. Ni la création de ce projet ni l'accès
réseau/identifiants correspondants ne sont possibles depuis ce canal (GitHub Issue) — confirmé par
construction, comme pour tout accès Supabase depuis le 06/09/2026. **Rien n'a donc été créé.**
Geste suivant, une fois ce besoin levé : `outils/reconstruire-baseline-candidat.sh
reception-regularisation-20260919 <ref-jetable>`, puis recette candidate `#65`, puis même
procédure pour `#62`.

## 5. Baseline machine-readable (decision-11.md §6)

Premier dépôt : `baseline-programme-stabilisation-1.json` (SHA Production, inventaire migrations
Production/rail/candidats, drift classifié fichier par fichier, mécanisme de reconstruction,
besoin exact, limites de ce canal) + `baseline-programme-stabilisation-1.md` (explication en
prose). À compléter à chaque geste ultérieur (mesure DB réelle, isolation Cloudflare, exécution du
script), pas une version finale.

## 6. Ce qui reste hors de portée de ce canal, inchangé

Isolation Supabase Test des candidats web (observation Cloudflare humaine préalable, non faite —
`etude-isolation-test-candidats-web-1.md` §5) ; preuve de création réelle de la migration `#65`
contre une base jetable (bloquée par §4 ci-dessus) ; dérive de schéma côté base de données réelle
de `nexus-test` (non revisitée — seule la comparaison Git l'a été) ; portage de la chaîne de
configuration sur `#62`/`#65`, délibérément non fait, séquencé après l'observation Cloudflare.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase, aucune promotion
Production, aucun secret créé/lu/exposé, aucune nouvelle règle métier/UX/rôle/RLS/sécurité, aucun
nouveau module produit (réutilisation stricte de `outils/reconstruire-base-test.sh`), aucune baisse
de gate, aucun reset destructif du Test historique. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
