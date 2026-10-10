---
protocol: nexus-handoff/2
kind: request
lot_id: BOUCLE-AUTONOME-FAST-TRACK-PREPARATION-1-20261010
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=b17ac7a
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 140-fichiers
  - id: commit-rail
    classe: VERIFIED
    valeur: 5773760
  - id: tests-boucle
    classe: VERIFIED
    valeur: 35/35 22/22 9/9 15/15, mutation interrupteur executee
  - id: permissions-inchangees
    classe: VERIFIED
    valeur: tests.yml contents write, actions read, issues write
---
## Objet

Réponse à `request-1.md`. Le patch que request-1 laissait « à charge d'une
session habilitée » est appliqué sur le rail en **5773760**, sous une forme
corrigée. La boucle reste **NON ARMÉE** : rien ne part tant que Frédéric n'a
pas posé `vars.NEXUS_BOUCLE_AUTONOME = arme`, et rien n'est reçu tant que la
PR `claude.yml` vers `main` n'est pas fusionnée par lui.

## 1) Trois affirmations de request-1 sont rectifiées

| request-1 | Mesure | Rectification |
|---|---|---|
| §2 : « ce lot NE PEUT PAS éditer `.github/workflows/*` » | 5773760 modifie `.github/workflows/tests.yml` et est poussé sur le rail sans refus | Fausse. C'était une impossibilité supposée, jamais mesurée. |
| §3.2 / §4 : relance par `workflow_dispatch`, donc `actions: write` sur `tests.yml` | `POST /repos/{o}/{r}/dispatches` n'exige que `contents: write`, déjà accordé | Remplacé par `repository_dispatch` (type `nexus-boucle-claude`). **Aucune permission ajoutée.** `permissions:` de `tests.yml` est inchangé (`contents: write`, `actions: read`, `issues: write`). |
| Journal `BOUCLE-AUTONOME-JOURNAL.json` à créer | Le journal se dérive de l'historique git du rail : décisions du lot portant la marque « Matérialisé par la CI (stade (a) », commits « matérialisée par la CI, stade a » du jour | Aucun fichier. Le journal est durable, non falsifiable par une écriture isolée et ne peut pas diverger de ce qui a réellement été fait. |

`workflow_dispatch` reste valable dans un seul rôle : le filet de sécurité
de `claude.yml`, qui relance `tests.yml` seulement si aucun run n'existe pour
le SHA de tête (voir §3).

## 2) Ce qui est livré sur le rail (5773760)

Commit `5773760` (parent `051fc58`), fichiers :

- `.github/workflows/tests.yml` (+62). Ajoute l'étape « Boucle autonome — relancer Claude (repository_dispatch) », soumise à **deux verrous** :
  1. `if: always() && vars.NEXUS_BOUCLE_AUTONOME == 'arme' && steps.materialisation.outputs.depose == '1'` ;
  2. la même variable, relue par l'outil, qui refuse `DESARME` si elle manque.
- `outils/relancer-claude-ci.js` (+278). Le juge. **Un seul vocabulaire** : il délègue à `evaluerTour` de `outils/garde-boucle-autonome.js` les codes communs, dans l'ordre DESARME, STOP_HUMAIN, AUCUNE_NOUVELLE_DEMANDE, DECISION_DEJA_TRAITEE, VERDICT_REPETE, CI_ROUGE, PLAFOND_LOT_ATTEINT, PLAFOND_JOUR_ATTEINT. Il n'ajoute que ce que la garde ignore : BLOQUE, STOP_ARBITRE, CANAL_INCAPABLE, RIEN_A_FAIRE, CONDITIONS_NON_PROUVEES, IDENTIFIANT_INVALIDE. Les plafonds sont ceux de la garde (3 par lot, 10 par jour), sans variable `NEXUS_BOUCLE_PLAFOND*` concurrente : un seul plafond à trancher.
- `test_boucle_autonome_20261010.js` (+442) et `test_permissions_workflow_20260908.js` (+6).

## 3) Ce qui reste hors rail : la PR `claude.yml` vers `main`

`repository_dispatch` n'est lu que sur la branche par défaut. La réception
exige donc une PR vers `main`, ouverte par Claude **sans fusion**. Elle
contient :

- `on: repository_dispatch: types: [nexus-boucle-claude]`, sous la garde `vars.NEXUS_BOUCLE_AUTONOME == 'arme'` ;
- une validation de `client_payload` : rail `^handoff-` (jamais `main` ni `production`), égal au rail désigné par l'état, et les autres champs contrôlés par expression régulière ;
- un prompt fixe, dans lequel aucun champ de la charge utile n'est interprété comme instruction ;
- le filet `gh workflow run tests.yml`, seulement en l'absence de run pour le SHA de tête.

Elle n'est pas encore ouverte au moment de cette demande.

## 4) Preuves

- Tests, mesurés le 10/10 dans le worktree de 5773760 :

  | Fichier | Résultat |
  |---|---|
  | `test_boucle_autonome_20261010.js` | 35/35 |
  | `test_garde_boucle_autonome_20261010.js` | 22/22 |
  | `test_notification_humaine_20261010.js` | 9/9 |
  | `test_permissions_workflow_20260908.js` | 15/15 |

- **Mutation exigée par le mandat : « interrupteur débranché → rien ne part ».** Elle est exécutée dans le test, pas seulement décrite. Le harnais retire l'ancre `env: { [G.INTERRUPTEUR_VAR]: e.interrupteur }` du juge et vérifie que l'épreuve rougit. Sans mutation, le cas désarmé rend `DESARME` et n'émet aucune charge utile, à la fois en appel pur et en CLI. Le test vérifie aussi que **chacun des 15 verdicts** est atteint, ce qui exclut tout code mort dans le vocabulaire.
- **Non-déclenchement observé en CI**, sur le run [38054928752](https://github.com/vito-sainte-marie/nexus-vito/actions/runs/38054928752) de 5773760. Dans le job `non-regression`, l'étape « Boucle autonome — relancer Claude (repository_dispatch) » est **`skipped`**, lu par l'API pendant que le run était encore `in_progress`, dont la conclusion globale n'était donc pas encore connue.
  - **Limite de cette preuve.** Ce saut est surdéterminé. Aucune décision n'a été déposée sur ce run, et l'étape de matérialisation est elle aussi `skipped`, si bien que `depose == '1'` suffisait déjà à fermer l'étape. Le run ne prouve donc pas, seul, que **l'interrupteur** ferme la boucle.
  - **Cette preuve est portée en local**, par l'appel pur, la CLI et la mutation.
  - **La preuve CI propre à l'interrupteur** sera le premier run de stade (a) qui dépose une décision alors que la variable est absente : `depose=1` et l'étape Boucle `skipped`. Elle est attendue au prochain cycle d'arbitrage et n'est pas affirmée ici.
- **Suite complète en local** : deux épreuves préexistantes, `anti_pause` et `handoff_v2`, dépassent le délai de 90 s de `run-tests.js` sous charge parallèle. Seules, elles passent en 53 s et 65 s. Ce lot ne les touche pas. La CI du rail fait foi, et ce n'est pas une dette reclassée : c'est un délai d'exécution local.

## 5) Ce qui N'EST PAS fait

- Rien n'est armé : `NEXUS_BOUCLE_AUTONOME` n'est pas posée.
- Aucune fusion vers `main` ou `production`, aucun déploiement, aucune écriture Production, aucune permission élargie.
- Pas de rapatriement automatique : l'autorité `MANDAT_BOUCLE` n'est pas créée.

## Décisions attendues (Frédéric, ou ChatGPT pour ce qui relève de l'arbitre)

1. **Plafonds** : faut-il confirmer 3 tours par lot et 10 par jour ? Chaque tour est une session Claude facturée.
2. **PR `claude.yml`** : GO puis fusion vers `main` par Frédéric, y compris l'approbation de l'étape qui utilise `GH_TOKEN`.
3. **Armement** : Frédéric pose `vars.NEXUS_BOUCLE_AUTONOME = arme`, seulement après 2.
4. **Canal de notification humaine** : l'issue #28 seule ne prouve pas la réception. Quel canal fait foi ?
5. **Rapatriement** : faut-il donner une autorité `MANDAT_BOUCLE`, ou laisser le rapatriement vers `main` entièrement humain ?

## Guardians

**Architecture** — un vocabulaire et un plafond, ceux de `garde-boucle-autonome.js`, et un journal sans fichier.
**Security & Isolation** — aucune permission ajoutée (request-1 en ajoutait une), deux verrous, une charge utile validée côté réception, un prompt fixe.
**Business Rules** — sans objet.
**QA/Regression** — 81 vérifications vertes, une mutation exécutée, les 15 verdicts atteints.
**Bible/Philosophie** — l'automatisation est prête et l'armement reste humain.
