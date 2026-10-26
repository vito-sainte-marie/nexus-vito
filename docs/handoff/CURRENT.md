<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-REGULARISATION-20261026/request-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
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
  - id: ci-ec015c75
    classe: VERIFIED
    valeur: ec015c75
  - id: pr-claude-yml
    classe: VERIFIED
    valeur: 159
  - id: echecs-connus-9
    classe: VERIFIED
    valeur: ECHECS-CONNUS.json
  - id: semis-idempotent
    classe: VERIFIED
    valeur: a098b991
---
# OUTILLAGE-REGULARISATION-20261026 : request-3 — preuve des conditions de decision-2

BRANCHE_DU_LOT: handoff-continuite-20260920

Reprise sous l'autorisation de Frédéric pour ce lot. Decision-2 (`286edb06`) a été consommée par `--preuve-action 6b72289f` (commit `84d17dcc`). Ce qui suit a été relu sur le rail et rejoué.

## Preuve des conditions de decision-2

Les sections 1 à 5 ci-dessous constituent cette preuve, condition par condition.

## 1. BRANCHE_DU_LOT obligatoire, et comment le marqueur arrive

- **Obligation** : le validateur refuse, après l'ancre `286edb06`, toute décision consommée avec `--preuve-action` sans exactement un marqueur valide (`BRANCHE_DU_LOT_ABSENT`, `_MULTIPLE`, `_INVALIDE`, `_INTROUVABLE`). Épreuve `test_marqueur_branche_du_lot_obligatoire_20261026.js`.
- **Arrivée dans les décisions futures** : deux voies, l'arbitre d'abord, la CI ensuite. Le relais instruit l'arbitre (`ARBITRE-CHATGPT.md`, § 6 bis) de reprendre la ligne `BRANCHE_DU_LOT:` de la request. Si l'arbitre n'en met pas, `materialiser-decision-ci.js` l'injecte.
- **Correction demandée par la vérification de `6b72289f`/`84d17dcc` (commit `ec015c75`)** : la CI ne prend plus le rail par défaut. Elle lit la branche de travail **déclarée par la request du lot** (`brancheDeLaRequest`). Request sans marqueur ou marqueur invalide : refus avant écriture. Marqueur de l'arbitre différent de celui de la request : refus. Le rail n'est retenu que s'il est déclaré comme branche de travail, ce que fait cette request.
- **Épreuves** : `test_materialiser_decision_ci_20261009.js` 23/23 ; `test_marqueur_branche_du_lot_obligatoire_20261026.js` 21/21, dont L1–L10 (L6 : lot sur branche de PR, la décision reçoit la branche de PR et non le rail) et **MU5**, qui remet le défaut « rail » dans une copie et fait rougir L6 (la mutation mord).
- **Conséquence à connaître** : request-2 ne porte pas de marqueur ; seules les requests déposées à partir de celle-ci en portent un. Cette request-3 en porte un (ligne ci-dessus).

## 2. Les « 9 échecs connus » contre la référence de 7

La liste `docs/qa/ECHECS-CONNUS.json` compte **9** entrées, depuis QA-007 (09/09/2026). Le run CI « Tests » 40264925011 (`84d17dcc`) en affiche **9** aussi, identiques à ma suite locale (diff vide des deux listes). Le « 7 » des comptes rendus de lots précédents omettait deux fichiers :
- `test_chaine_temporelle_carburant_20260821.js` : `chargerControleJour` exige un fuseau, le test l'appelle sans (contrat durci après l'écriture du test) ;
- `test_inventaire_parcours_depot_boutique_reste.js` : `NexusStation is not defined` (test par découpe, cassé par une refactorisation).

Aucun n'est propre à mon environnement : même liste en CI et en local. C'est le compte rendu qui était incomplet, pas la liste. Aucune modification de la liste.

## 3. Semis de l'employé automate sur Test

`outils/semer-employe-automate-test.sql` exécuté sur Test (`udljdqxerrbbbajxubfn`) deux fois. Première exécution : `employees` 7 → 8. Seconde : toujours 8, une seule ligne pour l'identifiant, empreinte de ligne identique (`a098b991…`). Sans secret, sans compte Auth, sans suppression. Production non touchée. Le compte Auth ne sera créé que si un test prouve qu'il est indispensable.

## 4. claude.yml

PR vers `main` : https://github.com/vito-sainte-marie/nexus-vito/pull/159 (câblage de `juger-tour-claude.js` après la détection de TOUR_VIDE ; repli en avertissement si le rail n'a pas l'outil). À relire et fusionner par Frédéric ; rien poussé sur `main`. La proposition du rail citait `nexus-handoff/STATE.json` ; le chemin réel est `docs/handoff/STATE.json`, corrigé dans la PR et dans la proposition.

## 5. Autres conditions

- **Proposition A, étape 1** : fait (semis versionné et idempotent, § 3). Employé Test A est conservé. Reste l'étape 2 : scénario sur le nouvel employé, trois runs verts consécutifs, puis épreuve d'isolation et sa mutation avant tout retrait de Test A. Rien n'est retiré.
- **Proposition B** : `recette-navigateur-test.js` réessaie au plus 3 fois à 120 s d'intervalle, puis émet `::warning::` (commit antérieur au `84d17dcc`, épreuves rejouées en CI).
- **Tour incomplet** : `juger-tour-claude.js` et son épreuve avec mutation sont sur le rail ; le câblage attend la PR #159.
- **Corrections au message de `b9e34f97`** : consignées dans request-2 (aucun câblage de `tests.yml`, la demande annoncée n'existait pas).
- **Ni `main` ni Production** : aucun accès, aucune lecture.

## À arbitrer

1. Les points 1 à 4 couvrent-ils les conditions 1, 4, 5 et 6 de decision-2 ?
2. Autoriser la suite de la proposition A (étape 2, trois runs verts) ?
