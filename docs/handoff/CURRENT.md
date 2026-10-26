<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-REGULARISATION-20261026/request-7.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=f00eda7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 166-fichiers
  - id: ci-rail
    classe: VERIFIED
    valeur: run-40420143576-0e292c1a
  - id: decision-humaine
    classe: HUMAN
    valeur: Frederic-autorise-la-reprise-de-decision-5
---
# OUTILLAGE-REGULARISATION-20261026 : request-7 — demande de clôture : convention Test A en garde, preuves de decision-5

BRANCHE_DU_LOT: handoff-continuite-20260920

decision-5 (APPROVED_WITH_CONDITIONS, closes false, matérialisée par la CI en c628e085) a été prise en charge par l'outil (`consommer --prise-en-charge`, provenance CI établie) puis consommée avec `--preuve-action 0e292c1a`. Le runner n'ayant pas été déclenché après la decision-5, la reprise a été autorisée par Frédéric.

## Preuve des conditions de decision-5

1. **Convention Test A, inscrite.** Règle GOV-012 dans `docs/learning/RULES.json` : Employé Test A est réservé à la recette automatique ; les recettes manuelles documentées (docs/recettes, datées du 26/10/2026 ou après) utilisent Employé Test B ou Manager Test.
2. **Garde.** `outils/garde-recette-manuelle-test-a.js` refuse (RECETTE_MANUELLE_CITE_TEST_A) une recette manuelle citant Test A sous trois graphies (« Employé Test A », `employe-test-a`, « Test A »). Elle passe sur l'arbre réel, donc la CI l'applique.
3. **Mutation qui a mordu.** `test_garde_recette_manuelle_test_a_20261026.js`, 7/7 : M1 (portée de date retirée) et M2 (détection neutralisée) changent le verdict de la garde sur le même jeu d'entrée, ce que l'épreuve vérifie.
4. **CI du rail verte** sur 0e292c1a : Tests, run 40420143576, success. Revue Guardian : convention et garde conformes.
5. **Aucun élargissement de surface.** Test seulement ; aucun compte Auth, secret ni accès créé ; aucun identifiant de Test A réutilisé ; rien sur `main` ni en Production. Les conditions « trois passages verts » et « épreuve d'isolation » sont sans objet (decision-5).

## Preuve du traitement de l'écart decision-4 (89c29900)

1. Fiche INCIDENTS : INC-30d73c608322.
2. Dérogation visible : `STATE.json` derogations[], règle DECISION_CHATGPT_RENVOI_HUMAIN sur OUTILLAGE-REGULARISATION-20261026/decision-4.md, imprimée par `verifier`.
3. Garde de l'outil (beef5f0e, CI verte run 40418123414) : `decision --auteur ChatGPT` refuse avant écriture un renvoi humain (BLOCKED ou OWNER_NEXT: Frédéric) ; le validateur nomme tout cas postérieur ; test_garde_decision_chatgpt_renvoi_humain_20261026.js, 12/12.

## Limites

- La garde ne contrôle que les recettes documentées dans `docs/recettes/`. Elle ne peut pas empêcher une connexion manuelle en Test A dans un navigateur : ce risque reste couvert par la convention seule.
- L'exception « RECETTE: automatique » est déclarative : rien ne vérifie que la recette décrite est réellement automatique.
- Aucune nouvelle garde n'est demandée : une limite dite vaut mieux qu'une garde qui laisse croire qu'elle couvre tout.
- La suite complète locale a échoué par dépassements de délai (90 s) sous charge, sur des tests différents d'un passage à l'autre et passant seuls ; la CI est verte.

## Constat sur le runner

Depuis le 25/10, le runner n'a jamais terminé un tour seul : arrêts sans consommation, puis aucun déclenchement après la decision-5 (aucun run « Claude » depuis celui de 13:58Z, en échec). La PR #159 rendra le premier cas visible ; le second, l'absence de déclenchement, reste à diagnostiquer dans un lot suivant.

## À arbitrer

Clore le lot OUTILLAGE-REGULARISATION-20261026 (closes: true) sur la base des preuves ci-dessus.
