---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=c259476
  - id: transport-fdj-decision10
    classe: VERIFIED
    valeur: commits-27ca3ca-7fa73c6-corps-identique-a-a70e7de
  - id: transport-gouvernance-request1-decision1
    classe: VERIFIED
    valeur: commits-1f835a0-b6ff903-fdebb7f
  - id: correctif-garde-immuabilite
    classe: VERIFIED
    valeur: merge_base_production_head-commit-b25096d
  - id: preuve-causale-garde
    classe: VERIFIED
    valeur: test_garde_immuabilite_merge_base_20261005.js-4-sur-4
  - id: regression-suite
    classe: VERIFIED
    valeur: 296-sur-305-9-echecs-connus-inchanges
  - id: guardians-apprentissage
    classe: VERIFIED
    valeur: handoff-verifier-conforme-guardians-1-finding-dette-connue-nexusstock
  - id: ci-run-github-reel
    classe: HUMAN
    valeur: non-declenchable-depuis-ce-canal-run-a-obtenir-apres-integration-rail
  - id: migrations-rail-only-hors-decision
    classe: DECLARED
    valeur: 20-non-traitees
  - id: transport-vers-rail
    classe: HUMAN
    valeur: six-commits-pousses-sur-claude-issue-28-20261005-2257-pas-encore-fast-forward-sur-handoff-continuite-20260920
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-ecriture-aucune-migration-aucun-merge-aucun-deploiement
---
# request-2 — qualification du rouge CI traitée, transport canonique fait depuis ce checkout

Fait suite à `decision-1.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`),
elle-même en réponse à `request-1.md`. Périmètre exécuté : traitement du
rouge CI `37356858235`, transport canonique de `decision-10.md` FDJ et de
`request-1.md`/`decision-1.md` de ce lot, tous trois déposés exclusivement
via `outils/handoff.js`. Aucun fichier applicatif touché.

## 1. SHA et transport

- HEAD canonique au départ de ce réveil : `3761220c5d17b2d30806de41b3b3f3b165ed690b`
  (identique au rail `handoff-continuite-20260920`, confirmé avant toute
  écriture).
- HEAD de ce checkout après transport : `b25096dd1b3df789236b5748cab791559445918d`,
  six commits ajoutés, tous par `outils/handoff.js` (jamais une écriture à
  la main dans `lots/`) :
  1. `27ca3ca` — `FDJ-CARNETS-LEDGER-AUDIT-1-20261004/decision-10.md`
     (déposée via `handoff.js decision`, corps identique octet pour octet
     à la version précédemment rédigée sur le candidat bloqué `a70e7de`).
  2. `7fa73c6` — consommée via `handoff.js consommer` + miroirs régénérés.
  3. `1f835a0` — `GOUVERNANCE-REFERENCE-CODE-20261005/request-1.md`
     (déposée via `handoff.js demande`, corps identique octet pour octet).
  4. `b6ff903` — `decision-1.md` de ce lot (déposée via `handoff.js
     decision`, `APPROVED_WITH_CONDITIONS`, `closes: false`), matérialisant
     l'arbitrage relayé dans l'issue #28 le 05/10/2026.
  5. `fdebb7f` — consommée via `handoff.js consommer` + miroirs régénérés.
  6. `b25096d` — correctif de la garde d'immuabilité (ci-dessous).
- Production de référence, inchangée tout au long : `c259476fa51e46f3b30fdd93918f2f78b88aec04`.
- `node outils/handoff.js verifier` : conforme après chaque dépôt et après
  ce transport (36 lots, 15 avertissements — tous préexistants —, 11
  dérogations, 0 nouvelle erreur).
- **Blocage résiduel, structurel, déjà documenté dans ce fil depuis le
  06/09/2026** : ce canal ne peut pousser que sur sa propre branche
  (`claude/issue-28-20261005-2257`) ; il n'a pas les moyens techniques
  d'intégrer ces six commits sur `handoff-continuite-20260920` lui-même. Le
  transport est donc **prouvé et commité, pas encore intégré au rail**.
  Commandes de rapatriement en fin de ce document.

## 2. Traitement du rouge CI `37356858235`

**Diagnostic confirmé par mesure, pas supposé.** `test_migrations_immuables_20260905.js`
comparait Production à son **tip courant** (`origin/production`, 292
migrations) contre le système de fichiers local. Sous l'ancien modèle
(chaque branche mire l'intégralité de l'applicatif), une migration de
Production absente localement ne pouvait signifier qu'une suppression.
Ce n'est plus vrai pour un rail qui a cessé de prétendre à cette autorité
(condition 1 de `decision-1.md`) : mesuré, Production porte 292 migrations,
le rail (au point `3761220`) en porte 310 dont 20 rail-only et exactement 2
manquantes — `20261005090000_fdj_reconciliation_canonique_caisse.sql` et
`20261005180000_fdj_ouverture_quart_caissiere_seule.sql` — ajoutées à
Production par les PR #75/#76, jamais transportées sur le rail, jamais
supprimées.

**Correctif, sans contournement de la garde et sans recopie d'applicatif.**
La référence d'immuabilité devient le **point de divergence** de la
branche avec Production (`git merge-base origin/production HEAD`), pas son
tip courant. Mesuré sur ce point précis (`501c0c7...`, 240 migrations) :
**zéro** migration manquante — le rail n'a rien supprimé de ce qui existait
en Production au moment de sa divergence, ce qui est l'invariant réel que
le contrôle protège (celui qu'aurait arrêté 95cc92a le 04/09). Les 52
migrations ajoutées à Production depuis cette divergence (dont les 2
citées) sont désormais listées comme information, et ne sont plus
évaluées par ce contrôle — exactement la frontière posée par la condition 1.
Aucun fichier de migration n'a été copié, renommé ou neutralisé ; aucune
règle n'a été assouplie pour les migrations d'une branche qui descend
réellement de Production au tip courant (le merge-base y vaut le tip,
comportement strictement inchangé).

**Preuve causale, par dépôt Git jetable** (`test_garde_immuabilite_merge_base_20261005.js`,
jamais une resimulation de la logique — le fichier réel de la garde est
copié et exécuté comme `node` l'exécuterait en CI) :
1. une migration ajoutée après la divergence du rail ne fait plus rougir
   la garde (le rouge que ce lot ferme) ;
2. une migration déjà présente au point de divergence qui disparaît du
   système de fichiers local fait toujours rougir la garde ;
3. une migration antérieure à la divergence dont le contenu change fait
   toujours rougir la garde ;
4. sans divergence (merge-base == tip == HEAD, cas d'une branche
   applicative à jour), le comportement est strictement inchangé.
Chaque scénario a aussi été rejoué contre l'ANCIEN code de la garde
(`git show 3761220:...`) pour confirmer que le scénario 1 y échoue
réellement — la preuve causale ne se contente pas d'un vert, elle montre
que le rouge d'origine était réel et que le correctif le ferme précisément.

**Mesures locales, réelles, sur ce HEAD :**
- `node test_migrations_immuables_20260905.js` : vert — 240 migrations
  contrôlées au point de divergence, 52 ajoutées depuis et non évaluées,
  292 au tip courant de Production.
- `node test_garde_immuabilite_merge_base_20261005.js` : 4/4.
- `node run-tests.js` : **296/305**, les 9 échecs strictement identiques à
  la liste historique tolérée (`docs/qa/ECHECS-CONNUS.json`) — 0 régression.
- `node outils/handoff.js verifier` : conforme.
- `node outils/verifier-apprentissage.js` : conforme, 21 règles, aucun
  doublon, aucune récurrence non promue.
- `node outils/guardians-router.js` : 1 finding — la collision `NexusStock`
  déjà connue et documentée comme le seul finding attendu sur le canon
  (commentaire de `tests.yml` autour de l'étape « Guardians backend —
  rapport », dette ARCH-002 préexistante, non liée à ce lot, non bloquante
  par construction : `|| true`).

**Ce qui n'est PAS encore mesuré : un run GitHub Actions réel sur ce
commit précis.** Ce canal ne peut pas déclencher ni observer de run CI sur
une branche qu'il ne peut pas pousser au-delà de la sienne. Les mesures
ci-dessus sont des exécutions réelles de `node`, pas une trace manuelle —
mais elles ne remplacent pas le run CI qu'obtiendra la session qui
intégrera ces commits sur le rail. Classé honnêtement `HUMAN` plutôt que
fabriqué.

## 3. Définition des autorités telle qu'appliquée

- **`origin/production`** : autorité du code applicatif réellement servi,
  des migrations applicatives (`supabase/migrations/`) et des tests
  applicatifs de référence. Non modifié par ce lot.
- **`handoff-continuite-20260920`** : autorité du protocole Handoff
  (`docs/handoff/**`, `STATE.json`, miroirs v1, `outils/handoff.js`, gardes
  de registre). Les deux lots transportés dans ce réveil (FDJ decision-10,
  GOUVERNANCE-REFERENCE-CODE-20261005 request-1/decision-1) relèvent
  exclusivement de cette autorité. Le correctif de `test_migrations_immuables_20260905.js`
  est un outil de gouvernance/CI, pas un fichier applicatif — cohérent avec
  la frontière posée par la condition 1.
- **Les 20 migrations rail-only** restent hors décision, non qualifiées,
  non traitées par ce lot — conformément à `request-1.md` §1.

## 4. Blocages restants

1. Intégration des six commits sur `handoff-continuite-20260920` lui-même
   (§1, blocage structurel de canal).
2. Run CI GitHub Actions réel sur le commit intégré (§2, dépend du point 1).
3. Mécanique outillée de déclaration automatique du merge-base à l'ouverture
   d'un lot (`request-1.md` §3) : toujours non construite, posée pour un lot
   d'outillage séparé.

## 5. Pour intégrer depuis une session habilitée

```
git fetch origin claude/issue-28-20261005-2257 handoff-continuite-20260920
git merge-base --is-ancestor origin/handoff-continuite-20260920 origin/claude/issue-28-20261005-2257 \
  && echo "fast-forward possible"
git push origin claude/issue-28-20261005-2257:handoff-continuite-20260920
node outils/handoff.js verifier
node run-tests.js
```

**STOP. Aucun autre geste avant arbitrage sur ce retour.**
