---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=f56edb0d production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: ci-b9e34f97
    classe: VERIFIED
    valeur: run-Tests-40259971081-success
  - id: consommation-decision-1
    classe: VERIFIED
    valeur: 3259eec7-preuve-action-b9e34f97
  - id: epreuves-bornage
    classe: VERIFIED
    valeur: test_preuve_action_branche_du_lot_20261026.js-8/8-M1-mord
  - id: recette-test-a
    classe: VERIFIED
    valeur: test_recette_navigateur_test_20260907.js-89/89
  - id: run-runner-40258106584
    classe: VERIFIED
    valeur: success-sans-consommation
---
# OUTILLAGE-REGULARISATION-20261026 : request-2 — preuve des conditions de decision-1, un écart à ratifier, deux propositions

## Preuve des conditions de decision-1

Reprise autorisée par Frédéric après un tour incomplet du runner : `github-actions-claude` (run « Claude » 40258106584) a poussé le travail (`b9e34f97`) mais n'a pas consommé la décision. Je l'ai consommée avec `--preuve-action b9e34f97` (commit `3259eec7`, statut `DECISION_CONSOMMEE`). Ce qui suit est lu sur le rail et rejoué, pas déclaré.

1. **Ratification des trois commits** (`6510a2e3`, `631f5d00`, `e251592c`) : acquise par decision-1. Épreuves rejouées sur le rail : `test_arbitrage_deja_traite_20261026.js` 9/9, `test_demande_classe_preuve_20261026.js` 3/3.
2. **Bornage de `--preuve-action`** : implémenté dans `commitHorsRegistre(ref, brancheDuLot)`. Refus avant écriture : `PREUVE_ACTION_HORS_BRANCHE_DU_LOT`, `BRANCHE_DU_LOT_INTROUVABLE`. `test_preuve_action_branche_du_lot_20261026.js` : 8/8 (rail seul refusé, SHA de la branche accepté, SHA inconnu refusé, branche introuvable refusée, trois cas voisins verts : sans marqueur, `--cloture`, `--prise-en-charge` idempotente). **Mutation de l'ascendance rejouée par moi** : l'épreuve M1 remplace la ligne `merge-base --is-ancestor` par un bloc vide dans une copie de `handoff.js`, et vérifie que le SHA rail-seul est alors accepté à tort. L'épreuve M1 passe, donc la mutation a mordu et la garde est bien celle qui refuse.
3. **Scénario Employé Test A** : les deux prises de poste successives sont conservées ; le second service est fermé par l'écran (pointage de départ, jamais SQL), l'échec de cette fermeture reste informatif. `test_recette_navigateur_test_20260907.js` : 89/89 (5 épreuves ajoutées par `b9e34f97`). Aucun service historique nettoyé.
4. **Ni Production ni `main`** : `b9e34f97` touche `docs/learning`, `outils/handoff.js`, `outils/recette-navigateur-test.js` et deux fichiers de test. **CI verte avant consommation** : run « Tests » 40259971081, success sur `b9e34f97`.

## Écart à déclarer : où se lit la branche du lot

Decision-1, condition 2, dit : « la branche provient exclusivement de l'enveloppe de décision ». Le runner a lu `BRANCHE_DU_LOT: <branche>` dans le **corps** de la décision (regex `^BRANCHE_DU_LOT:`), et non dans l'enveloppe, qui reste fixée au rail par `brancheRailValide` ; ajouter un champ à l'enveloppe changerait `nexus-handoff/2`. C'est une interprétation de la condition 2, pas son texte. Conséquence : une décision sans marqueur garde le comportement ancien (aucune restriction au-delà du rail), y compris decision-1 elle-même, qui ne porte pas le marqueur. **Nous demandons à l'arbitre de ratifier ou non cette lecture.** Si non, il faut soit un champ d'enveloppe versionné, soit un argument explicite, à trancher.

## Corrections au message de `b9e34f97`

Le message de commit annonce un câblage de `tests.yml` à faire et « consigné en demande Handoff ». C'est inexact :
- `run-tests.js` lance tout fichier `test_*.js` du répertoire (`readdirSync` + `startsWith('test_')`). Les épreuves de `6510a2e3`, de `631f5d00` et de `b9e34f97` sont donc déjà dans la CI via `node run-tests.js`. **Aucun câblage de `tests.yml` n'est à faire.**
- La « demande Handoff » annoncée n'existe pas : aucun fichier de demande n'a été déposé pour ce motif.

## Tour incomplet du runner

Le run 40258106584 s'est terminé en succès avec le travail poussé et la décision non consommée (statut resté `ATTENTE_CONSOMMATION_DECISION`). Je n'ai pas relevé de journal expliquant l'arrêt. À traiter comme un défaut de la boucle : un tour qui pousse du travail sans consommer ne doit pas se terminer en succès silencieux.

## Proposition A : un employé de recette réservé à l'automate

Constat : `recette-navigateur-test.js` joue ses scénarios avec Employé Test A, que les recettes manuelles utilisent aussi. Les deux prises de poste automatiques ferment, par `prise_de_poste_suivante`, les services ouverts à la main.

1. Créer un employé de recette réservé à l'automate sur Test, par un jeu **versionné et idempotent** (fichier SQL ou JSON sous `docs/` avec garde de réexécution : `insert … on conflict do nothing`, rejouable sans effet), sur le site de recette, avec les rôles que les scénarios exigent. Aucune écriture Production.
2. Le scénario passe à cet employé. **Decision-1 garde Employé Test A pour l'instant** : la transition se fait donc en deux temps. D'abord ajouter le nouvel employé et un second scénario qui l'utilise, tout en conservant le scénario d'Employé Test A et sa fermeture par l'écran ; ensuite, une fois le nouveau scénario vert sur plusieurs runs, retirer Employé Test A de l'automate.
3. Épreuve : le jeu est rejouable deux fois sans changer l'état ; une prise de poste automatique ne ferme jamais le service d'un autre employé que celui de recette ; mutation : sans le filtre sur l'employé de recette, l'épreuve rougit.

À arbitrer : le compte a-t-il besoin d'un compte Auth, ou la recette peut-elle l'ouvrir autrement ? (`employe-test-pro` n'en a pas.)

## Proposition B : une recette sautée ne doit plus passer pour un succès muet

Constat : le run `fd028e38` (12:02 du 25/10, run 40191407452) a attendu environ 4 minutes que NEXUS Test serve le commit du run, puis écrit « Recette navigateur Test non exécutée — NEXUS Test sert encore d964edb8, pas fd028e3 » et terminé en succès. Le job est vert, aucune paire de services n'a été créée, rien ne signale le trou.

1. **Minimum** : émettre `::warning::` visible sur le run, avec le commit servi et le commit attendu, en plus du message actuel. Le job reste vert.
2. **Idéal** : réessai borné jusqu'au déploiement du bon commit (par exemple trois tentatives espacées, plafond fixé à l'avance, puis `::warning::`). Un déploiement qui n'arrive jamais ne doit pas faire échouer le run (ENV-003, dégradation explicite) ; il doit rester visible.
3. Épreuve : un cas « Test sert un autre commit » produit la ligne `::warning::` et le plafond de tentatives ; mutation : sans l'émission, l'épreuve rougit.

## À arbitrer

1. Ratifier ou non la lecture de la condition 2 (marqueur dans le corps).
2. Proposition A : accord sur la transition en deux temps et sur la création d'un jeu versionné ; question du compte Auth.
3. Proposition B : minimum seul (`::warning::`), ou minimum plus réessai borné ; valeur du plafond.
