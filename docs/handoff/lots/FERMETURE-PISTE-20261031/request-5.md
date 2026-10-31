---
protocol: nexus-handoff/2
kind: request
lot_id: FERMETURE-PISTE-20261031
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=659af077 production=840bb0c6
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 169-fichiers
  - id: capacite-recette-navigateur-test
    classe: VERIFIED
    valeur: playwright-absent-NEXUS_TEST_URL-absent-recette-navigateur-test.js-degrade
  - id: recette-guardian-assignation
    classe: DECLARED
    valeur: assignee-a-Guardian-pas-a-Claude
  - id: aucune-action-production
    classe: VERIFIED
    valeur: aucun-commit-migration-ecriture-production-par-ce-reveil
---
# FERMETURE-PISTE-20261031 : request-5 — arrêt sur capacité absente (conditions de decision-3)

BRANCHE_DU_LOT: fermeture-piste-correctif-quart-20261031

## Prise en charge

decision-3.md (APPROVED_WITH_CONDITIONS, closes: false, en réponse à request-4.md) a été
prise en charge par ce réveil (`consommer FERMETURE-PISTE-20261031 --prise-en-charge`,
commit 725acbb9 déjà présent sur le rail). Son `ACTION_NEXT` — matérialiser la décision sur
le rail avec `outils/handoff.js decision --auteur ChatGPT` — était déjà rempli par la CI
avant ce réveil (relais stade (a), run 41230479538) : aucun geste supplémentaire n'était dû
sur ce point.

## Conditions de decision-3 — aucune n'est à la portée de ce réveil

decision-3.md pose quatre conditions cumulatives avant toute fusion, promotion ou clôture :

1. **La recette Guardian sur Test** doit confirmer qu'un pompiste du matin clôturant après
   13 h reste sur le quart du matin.
2. Aucune réparation des données Production du 31/10.
3. Aucune fusion, promotion ou clôture du lot avant cette recette.
4. La fusion de la PR #167 vers Production reste réservée à Frédéric
   (`PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`).

Les conditions 2 à 4 sont des interdictions, déjà tenues par construction : aucune réparation
Production, aucune fusion, aucune promotion n'a été faite par ce réveil. Seule la condition 1
appelle un geste, et il n'est pas à la portée de Claude ici, pour deux raisons distinctes et
chacune suffisante :

### a. La recette est nommément assignée à Guardian, pas à Claude

request-4.md (§ Décisions de Frédéric, point 3) et decision-3.md disent tous deux « Guardian
fait la recette sur Test ; Frédéric fusionne et clôt le lot » / « La recette Guardian ».
`docs/guardian/README.md` et `docs/gouvernance/v2/PLAN-RACCORDEMENT-GUARDIAN.md` décrivent
Guardian comme un rôle distinct de Claude Code, aujourd'hui à l'état de cible (non appliqué),
sans droit d'écriture sur le dépôt, et dont « un constat n'est jamais une décision ». La
pré-autorisation 4 de `CLAUDE.md` (« Exécuter la recette navigateur Test et lire la base Test »)
est une capacité générale de Claude ; elle ne fait pas de Claude un substitut de Guardian sur
une condition où Frédéric a nommément désigné Guardian comme exécutant.

### b. Même en écartant (a), la capacité technique est structurellement absente sur ce runner

```
$ node outils/recette-navigateur-test.js
Recette navigateur Test non exécutée — playwright absent de cet environnement. Non
bloquant. En CI : npm install --no-save playwright && npx playwright install --with-deps
chromium.
```

`NEXUS_TEST_URL` est également absent du runner (vérifié). C'est la même capacité absente
que celle déjà consignée par request-2.md de ce même lot (ENV-003) : l'outillage que la
pré-autorisation 4 suppose n'est pas câblé sur ce runner. Installer `playwright` à la volée
ne lèverait pas l'absence de `NEXUS_TEST_URL`, et contourner cette seconde absence en
élargissant la lecture d'environnement serait précisément le contournement que GOV-002/la
condition 4 de decision-1 interdit déjà.

## Preuve des conditions de decision-3

- refs-protegees (VERIFIED) : main=659af077 production=840bb0c6 — inchangées depuis
  request-4.md, aucun mouvement de ref par ce réveil.
- capacite-recette-navigateur-test (VERIFIED) : playwright-absent-NEXUS_TEST_URL-absent
  sur ce runner — recette-navigateur-test.js dégradé, non exécutée.
- recette-guardian-assignation (DECLARED) : decision-3.md et request-4.md assignent la
  recette à Guardian, pas à Claude ; `docs/guardian/README.md` confirme Guardian comme
  rôle distinct, à l'état cible, sans droit d'écriture.
- aucune-action-production (VERIFIED) : aucun commit, migration ni écriture Production
  produit par ce réveil ; PR #167 non fusionnée par ce réveil (geste réservé à Frédéric).

## Ce qui n'a pas été fait, et pourquoi c'est correct de s'arrêter ici

Rien n'a été poussé hors de ce dépôt de registre. Aucune tentative de recette Test,
aucune fusion, aucune promotion, aucune clôture. Le lot reste ouvert, dans l'état où
decision-3.md l'a laissé, en attente de la recette Guardian puis du geste de Frédéric.

## À arbitrer

1. Qui exécute la recette Guardian — un geste humain (Frédéric) ou Guardian lorsqu'il sera
   câblé — puisque ni ce réveil ni la pré-autorisation 4 de `CLAUDE.md` ne couvrent un
   substitut par Claude sur cette condition nommément assignée ?
2. Ce lot reste-t-il en l'état (ATTENTE de la recette Guardian) jusqu'au prochain geste
   humain, sans nouveau réveil autonome tant que la condition 1 de decision-3 n'est pas
   levée ?
