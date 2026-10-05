---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7-production=30544c9-rail=e99d2f5-inchangees
  - id: decision-7-deposee-consommee
    classe: VERIFIED
    valeur: commit-d959d8b-depot-1ce4355-consommation
  - id: ledger-correction-reconstruit
    classe: VERIFIED
    valeur: 3-hunks-nexus-fdj-moteur.js-identique-au-candidat-deja-qualifie-7e41b3b
  - id: idempotence-9-chemins-reconstruits
    classe: VERIFIED
    valeur: jetonIntention-plus-4-dictionnaires-architecture-rpc-pr62-preservee
  - id: test-ledger-correction
    classe: VERIFIED
    valeur: 2-2-candidat-plus-mutation-negative-reelle-2-echecs-sur-production-non-corrigee
  - id: test-idempotence-matrice-9-9
    classe: VERIFIED
    valeur: 46-46-candidat-plus-mutation-negative-reelle-helpers-absents-de-production
  - id: aucune-insertion-reintroduite
    classe: VERIFIED
    valeur: grep-sur-les-2-diffs-html-zero-occurrence-insert-ajoutee
  - id: pr62-preservee
    classe: VERIFIED
    valeur: commandes-rpc-parametres-resolution-serveur-inchanges-seul-p_jeton-change
  - id: exclusions-respectees
    classe: VERIFIED
    valeur: aucune-migration-test-only-aucun-point-zero-aucun-anon5-aucun-fichier-etranger
  - id: qualification-nexus-test-ci
    classe: NOT_APPLICABLE
    valeur: aucun-acces-reseau-supabase-ci-depuis-ce-canal-capacite-classee-HUMAN
  - id: transport-branche-pr
    classe: NOT_APPLICABLE
    valeur: diffs-et-snapshots-complets-fournis-aucune-ecriture-possible-hors-branche-session
  - id: fusion-production
    classe: NOT_APPLICABLE
    valeur: stop-point-9-du-go-aucune-fusion-tentee
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucun-merge-aucune-migration
---
# request-8 — candidat FDJ reconstruit contre le code réel de Production (préparation/qualification, aucune fusion)

Réponse à `decision-7.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-7.md`) — GO explicite de Frédéric Bragance dans l'issue
#28 (05/10/2026) : « ARBITRAGE HUMAIN — GO REQUEST-7 FDJ CARNETS ».

## Verdict

**NON_PRET_POUR_FUSION_PRODUCTION.** Le candidat est construit, prouvé par
exécution réelle (pas une trace manuelle), et n'introduit aucune régression
d'architecture — mais aucune recette navigateur ni exécution CI/nexus-test
réelle n'a eu lieu (aucun accès réseau/Supabase/CI depuis ce canal, limite
déjà documentée dans tout ce fil). Ce retour ne demande pas d'arbitrage de
fusion : il rend compte du travail de préparation/qualification autorisé
par `decision-7.md`, strictement non-fusionnant.

## 0. HEAD Production revalidé au démarrage

`origin/production` = `30544c9af7ebf83d8ec1ba3882418252380036f1` — **identique**
au SHA cité par `decision-7.md`/`request-7.md`. Aucune conséquence à
recalculer : le diagnostic de `request-7.md` reste valide tel quel.
`origin/main` = `d6093b76519826c4f820e00f5bca9fb8148b1f96`,
`origin/handoff-continuite-20260920` = `e99d2f5c92ce2c0e136b90aee81d23e0ed045c46`
(HEAD de cette session) — aucun des trois n'a bougé depuis `request-7.md`.

## 1. Décision canonique déposée et consommée

`decision-7.md` matérialisée via `outils/handoff.js decision` (auteur
« Frédéric Bragance », verbatim complet du GO), commit `d959d8b`, puis
consommée (commit `1ce4355`). `node outils/handoff.js verifier` reste
conforme après dépôt (35 lots, 16 avertissements — tous préexistants — 11
dérogations).

## 2. Correctif reconstruit — 3 fichiers, base = contenu RÉEL de `production`

Aucun cherry-pick, aucune copie globale de fichier : chaque fichier a été
relu intégralement depuis `origin/production` (`git show`), et le
correctif a été réécrit à la main contre CE contenu, vérifié hunk par hunk
avant d'être figé. Diffs complets joints à ce lot
(`candidat-8-nexus-fdj-moteur.diff`, `candidat-8-NEXUS-FDJ-Manager-v1.diff`,
`candidat-8-NEXUS-FDJ-v1.diff`), ainsi que les fichiers complets
`candidate-*`/`prod-*` qui les ont produits (snapshots de `production` au
HEAD ci-dessus + candidat).

### a) `nexus-fdj-moteur.js` — routage `'correction'` (3 hunks, 7 lignes nettes)

Exactement le correctif déjà qualifié par `request-1.md §4`/`7e41b3b` :
`'correction'` annule désormais `actives` (comme une `activation` de signe
opposé) au lieu de router vers `confies`/`bureau` par emplacement de
destination, dans `soldesCarnetsParJeu` ET `soldesCarnetsAvecReference`
(cohérence, Article 11). **Vérifié ligne par ligne que ce hunk s'applique
identique au candidat déjà qualifié** : le diff entre mon candidat et
`7e41b3b:nexus-fdj-moteur.js` est nul sur la zone touchée (seule différence
résiduelle : une fonction non liée, `permissionsEcartCaisseEmploye`,
divergente pour une raison distincte et documentée dès `request-7.md §1`).

### b) `NEXUS-FDJ-Manager-v1.html` — 7 chemins, jeton stable superposé à l'architecture RPC réelle de PR #62

**L'architecture RPC de PR #62 n'est pas touchée** : mêmes noms de
fonction, mêmes commandes serveur (`fdj_enregistrer_mouvement_stock`,
`fdj_activer_carnet`), mêmes paramètres métier. Seule la valeur de
`p_jeton` change : au lieu de `genererIdempotencyKey()` appelée fraîche à
chaque appel (confirmée dans le code réel de production, 7 occurrences),
chaque fonction envoie désormais un jeton **stable**, conservé jusqu'au
succès :
- 5 formulaires à état persistant (`reappro`, `retraitCaisse`, `reception`,
  `rapprochement`, `blocage`) : nouvelle fonction `jetonIntention(etat)`
  (`if (!etat.jeton) etat.jeton = genererIdempotencyKey(); return etat.jeton;`),
  jeton posé sur l'objet d'état lui-même — remis à zéro par le `= null`
  déjà existant après succès/Annuler.
- 2 écritures sans formulaire persistant, par jeu : `jetonsRetourBloque`
  (`retournerDepuisBloque`, déjà « hors quart » mais appel direct depuis la
  liste) et `jetonsCorrectionManager` (`creerActivationReconstitueeCorrectionManager`,
  le 3ᵉ chemin « dette fraîche » de `request-1.md §8`, déclenché depuis
  `enregistrerEdition`) — dictionnaire par `gameId`, entrée supprimée après
  succès.

### c) `NEXUS-FDJ-v1.html` — 2 chemins « dette fraîche », même discipline

`jetonsActivationImplicite`/`jetonsActivationCarnet`, dictionnaires par
`gameId`, pour `creerActivationImplicite` et `executerActivationCarnetInterne` —
les deux derniers chemins de la dette `request-1.md §8`. Pour
`executerActivationCarnetInterne`, le jeton est aussi libéré sur la branche
« réponse idempotente » (`retourActivation.idempotent === true`), pas
seulement sur le succès direct — sinon un rejeu reconnu par le serveur
laisserait le jeton posé et bloquerait toute activation réellement
nouvelle du même jeu.

**Aucun `.insert()` direct réintroduit** (vérifié : `grep` sur les deux
diffs, zéro occurrence ajoutée). **Aucun second calcul métier** — les deux
fichiers continuent de déléguer entièrement aux commandes serveur
existantes, seule la provenance du jeton change.

## 3. Matrice 9/9 — RPC réel, cycle du jeton, retry, succès/reset, nouvelle intention

Table produite par l'exécution réelle de
`candidat-8-test-idempotence-matrice.js` (voir §4) :

| # | Chemin | RPC réel | Cycle du jeton | Retry | Succès / reset | Nouvelle intention |
|---|---|---|---|---|---|---|
| 1 | `enregistrerReappro` | `fdj_enregistrer_mouvement_stock(reappro_caisse)` | `jetonIntention(reappro)` | même jeton | `reappro=null` | jeton différent |
| 2 | `enregistrerRetraitCaisse` | `fdj_enregistrer_mouvement_stock(retrait_caisse)` | `jetonIntention(retraitCaisse)` | même jeton | `retraitCaisse=null` | jeton différent |
| 3 | `enregistrerReception` | `fdj_enregistrer_mouvement_stock(reception)` | `jetonIntention(reception)` | même jeton | `reception=null` | jeton différent |
| 4 | `validerRapprochement` | `fdj_enregistrer_mouvement_stock(rapprochement_activation)` | `jetonIntention(rapprochement)` | même jeton | `rapprochement=null` | jeton différent |
| 5 | `enregistrerBlocage` | `fdj_enregistrer_mouvement_stock(blocage)` | `jetonIntention(blocage)` | même jeton | `blocage=null` | jeton différent |
| 6 | `retournerDepuisBloque` | `fdj_enregistrer_mouvement_stock(retour_bloque)` | `jetonsRetourBloque[gameId]` | même jeton | `delete` | jeton différent |
| 7 | `creerActivationReconstitueeCorrectionManager` | `fdj_activer_carnet` | `jetonsCorrectionManager[gameId]` | même jeton | `delete` | jeton différent |
| 8 | `creerActivationImplicite` | `fdj_activer_carnet` | `jetonsActivationImplicite[gameId]` | même jeton | `delete` | jeton différent |
| 9 | `executerActivationCarnetInterne` | `fdj_activer_carnet` | `jetonsActivationCarnet[gameId]` | même jeton (y compris réponse idempotente) | `delete` | jeton différent |

**9/9, 46 assertions, 0 échec.**

## 4. Tests causaux — exécutés réellement, pas tracés à la main

Deux fichiers, joints à ce lot, exécutés depuis leur emplacement final :

- `node docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidat-8-test-ledger-correction.js`
  → **2/2** sur le candidat corrigé.
  **Mutation négative réelle** (pas supposée) : le MÊME test, pointé sur
  `prod-moteur.js` (production telle quelle, sans le correctif), **échoue
  réellement** avec les valeurs exactes prédites par le bug
  (`confiés=9, actives=2` au lieu de `confiés=10, actives=1` sur le cas
  terrain reconstruit : réception 22, transfert 10, activation 2,
  correction -1 caisse→caisse) — confirmant que le bug est présent
  aujourd'hui en production, pas une hypothèse.
- `node docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidat-8-test-idempotence-matrice.js`
  → **46/46** sur les deux candidats (manager + employé).
  **Mutation négative réelle** : le même test, pointé sur `prod-manager.html`/`prod-employe.html`
  (via les variables d'environnement `FDJ_TEST_MANAGER_FILE`/`FDJ_TEST_EMPLOYE_FILE`
  documentées en tête de fichier), échoue immédiatement — `jetonIntention`
  et les quatre dictionnaires (`jetonsRetourBloque`, `jetonsCorrectionManager`,
  `jetonsActivationImplicite`, `jetonsActivationCarnet`) **n'existent pas du
  tout** dans le code réel de production : la dette de jeton frais n'est pas
  une hypothèse, le mécanisme de stabilisation est absent à 100 %.

Extraction des fonctions réelles par regex + comptage d'accolades (même
discipline que `test_fdj_idempotence_ecritures_manager_20261004.js`/
`test_fdj_idempotence_dette_cles_fraiches_20261004.js`) — jamais une
réécriture à la main des fonctions testées.

## 5. Qualification nexus-test/CI — limite explicite, non contournée

**Aucune exécution nexus-test ni CI réelle sur ce candidat.** Ce canal
GitHub Issue n'a, comme documenté à chaque réveil de ce fil depuis le
06/09/2026, ni identifiants Supabase, ni accès réseau, ni droit de
déclencher un `workflow_dispatch`. Les tests ci-dessus sont des tests
unitaires purs (VM sandbox, faux client Supabase) — ils prouvent la
**logique** du correctif, jamais son comportement contre une base
`nexus-test` réelle ni un navigateur réel. Capacité manquante classée
`HUMAN`, pas fabriquée.

## 6. Exclusions strictes respectées

Aucun des éléments suivants n'a été touché ou repris dans le candidat :
migrations Test-only `20261004200000`/`20261004200100`, Handoff/gouvernance
hors nécessité de preuve, Point Zéro, `20261004130000`/ANON5, tout fichier
étranger au lot. Le candidat se limite strictement aux 3 fichiers
applicatifs cités.

## 7. Preuve qu'aucun travail PR #62 n'est supprimé

Vérifié par lecture des diffs eux-mêmes : les trois commandes serveur
(`fdj_enregistrer_mouvement_stock`, `fdj_activer_carnet`), tous leurs
paramètres métier (`p_operation`, `p_lignes`, `p_motif`,
`p_emplacement_source`, `p_shift_id`, `p_game_id`, `p_quantite`,
`p_methode`, `p_justification`), la résolution serveur de
`site`/`employee_id`/`created_by`, et la lecture de `retour.idempotent`
restent strictement inchangés. Seule la valeur transmise dans `p_jeton`
change. Confirmé mécaniquement : `grep` sur les deux diffs HTML ne trouve
aucune ligne supprimée contenant `nexusClient.rpc(` (les lignes `-` des
diffs portent uniquement sur `p_jeton: genererIdempotencyKey(),` et les
en-têtes de fonction).

## 8. État du transport — pas une branche/PR réelle, diffs + snapshots complets fournis

Cette session ne peut pousser que sur sa propre branche
(`claude/issue-28-20261005-1033`, basée sur `handoff-continuite-20260920`),
jamais créer de branche depuis `production` ni ouvrir de PR vers
`production` (restriction d'outillage de ce canal, documentée dans tout ce
fil). Le candidat est donc livré sous forme de **diffs unifiés** + **snapshots
complets** (candidat et production-telle-quelle, pour que les diffs
s'appliquent et que les tests soient rejouables tels quels), dans ce lot :

```
docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/
  candidat-8-nexus-fdj-moteur.diff
  candidat-8-NEXUS-FDJ-Manager-v1.diff
  candidat-8-NEXUS-FDJ-v1.diff
  candidat-8-test-ledger-correction.js
  candidat-8-test-idempotence-matrice.js
  candidate-moteur.js / candidate-manager.html / candidate-employe.html   (candidat)
  prod-moteur.js / prod-manager.html / prod-employe.html                  (production au HEAD ci-dessus)
```

Pour matérialiser une vraie branche/PR candidate depuis une session avec
droit d'écriture (jamais depuis ce canal) :

```
git fetch origin production
git checkout -b lot/fdj-carnets-correctif-reconstruit-production origin/production
cp docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidate-moteur.js nexus-fdj-moteur.js
cp docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidate-manager.html NEXUS-FDJ-Manager-v1.html
cp docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/candidate-employe.html NEXUS-FDJ-v1.html
git diff --stat   # doit afficher exactement les 3 fichiers, tailles ~ ±1 ligne des diffs joints
git add nexus-fdj-moteur.js NEXUS-FDJ-Manager-v1.html NEXUS-FDJ-v1.html
git commit -m "fdj: correctif ledger 'correction' + jeton stable (9 chemins), reconstruit contre production (PR #62 préservée)"
# puis : qualification réelle nexus-test/navigateur AVANT toute ouverture de PR vers production,
# conformément au point 5 ci-dessus.
```

## Invariants respectés

Aucun changement `main`/`production` — aucune commande d'écriture tentée
contre ces refs, aucune branche de transport créée, aucun cherry-pick
appliqué. Aucune fusion, aucun déploiement, aucune migration, aucune
écriture/réparation Production, aucun Point Zéro, aucun traitement de
l'écart `20261004130000`, aucun secret créé/lu/exposé. `decision-7.md`
déposée et consommée (Handoff uniquement). Le lot reste ouvert
(`closes: false`) : conformément au point 9 du GO, **STOP** — ce retour
attend l'arbitrage de Frédéric, aucune fusion n'a été ni effectuée ni
tentée.
