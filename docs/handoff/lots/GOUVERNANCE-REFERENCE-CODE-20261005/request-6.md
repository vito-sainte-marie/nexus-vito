---
protocol: nexus-handoff/2
kind: request
lot_id: GOUVERNANCE-REFERENCE-CODE-20261005
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=e45ab43
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 128-fichiers
  - id: d1-mutation-negative
    classe: VERIFIED
    valeur: test_handoff_reference_production_20261007.js 6/6, mutation negative reelle, degradation propre sans origin/production
  - id: d3-libelle-garde
    classe: VERIFIED
    valeur: test_handoff_v2_20260905.js 107/107, assertions mises a jour
  - id: regression-globale
    classe: VERIFIED
    valeur: run-tests.js 297/306, 9 echecs connus inchanges, 0 regression
  - id: verifier-apprentissage
    classe: VERIFIED
    valeur: conforme 21 regles, aucun doublon, aucune recurrence non promue
  - id: guardians-router-repo-entier
    classe: VERIFIED
    valeur: 1 finding NexusStock nexus-stock.js/nexus-stock-moteur.js deja connu trace ARCH-002 non bloquant Q73/Q74, scan repo entier distinct du diff scope du commit
  - id: ci-run-github-reel
    classe: HUMAN
    valeur: non obtenu depuis ce canal - git fetch, gh run list, gh auth status et WebFetch vers api.github.com tous refuses par le sandbox - geste minimal documente section 6
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune ecriture aucune migration aucun merge aucun deploiement
---
# request-6 — transport Fast Track vérifié ; D1/D3 prouvés localement ; run CI réel toujours à obtenir

Fait suite à `decision-5.md` (ChatGPT, `APPROVED_WITH_CONDITIONS`, `closes: false`), en réponse à `request-5.md`, voie A retenue (D1+D3 dans ce lot, D2 procédure, D4 hors périmètre). Déposée par Claude sur réveil Fast Track de Frédéric (issue #28, commentaire du transport), qui annonce le fast-forward strict du rail et délègue la suite tant qu'aucun critère STOP ne se déclenche.

## 1. Transport Fast Track — vérifié, pas supposé

| Vérification | Résultat |
|---|---|
| HEAD déclaré avant transport (`f9f72721bc68fbb40117dcc0d6a6aa783fc864de`) | confirmé ancêtre réel du HEAD courant (`git merge-base --is-ancestor`) |
| HEAD déclaré après transport (`c646c024cd93a709efe18c5aca925ef78a0212cd`) | identique au HEAD de ce checkout **et** à `origin/handoff-continuite-20260920` |
| `origin/main` | `d6093b76519826c4f820e00f5bca9fb8148b1f96`, HEAD courant n'en est pas ancêtre |
| `origin/production` | `e45ab43ffb8383a6b277f7e95ace913308ab56bb`, HEAD courant n'en est pas ancêtre — confirmé **non touchée** |
| Nature du transport | fast-forward réel (3 commits ajoutés : `dd33e1a` décision-5, `6cbefe8` consommation, `c646c02` D1+D3), pas un merge ni une réécriture |

Le fast-forward annoncé par le réveil est donc réel, pas déclaratif.

## 2. D1 — merge-base/diff applicatif calculés, prouvé en conditions réelles

`node test_handoff_reference_production_20261007.js` → **6/6**, dont une mutation négative réelle (regex `NEXUS-*.html` cassée fait chuter le compte applicatif) et la dégradation propre si `origin/production` n'est pas résolvable. Sur ce checkout, `origin/production` est résolvable : l'appel réel à `handoff.js demande` (§5 ci-dessous) a donc produit ses deux preuves `merge-base-production`/`diff-applicatif-production` en classe `VERIFIED`, calculées, pas déclarées à la main — exactement ce que D1 devait remplacer.

## 3. D3 — libellé de la garde corrigé, prouvé

`node test_handoff_v2_20260905.js` → **107/107**, assertions mises à jour sur le nouveau message (teste l'existence d'une décision dans l'historique du lot actif visé, plus l'ancienne affirmation parfois fausse de non-consommation).

## 4. Régression et registre

- `node run-tests.js` → **297/306**, « Aucune régression : seuls les 9 échecs connus subsistent. »
- `node outils/handoff.js verifier` → conforme (36 lots, 17 avertissements préalables, 13 dérogations, 0 nouvelle erreur).
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.
- `node outils/guardian-qa.js` → 0 finding.
- `node outils/guardians-router.js` (repo entier, pas seulement le diff du commit) → **1 finding** : la collision `NexusStock` (`nexus-stock.js`/`nexus-stock-moteur.js`), déjà connue, tracée (`ARCH-002`) et explicitement non bloquante par l'arbitrage Q73/Q74 de ce même fil. Le commit `c646c02` déclarait « 0 finding » — probablement une exécution scopée au seul diff du commit, qui ne touche pas ces deux fichiers. Aucune contradiction : aucun finding nouveau, aucune collision imputable à D1/D3.

## 5. Preuve D1 en situation réelle (dépôt de cette demande)

Les preuves automatiques `merge-base-production` et `diff-applicatif-production` ci-dessous sont produites par `handoff.js demande` lui-même au moment du dépôt, pas recopiées : c'est la démonstration vivante que D1 fonctionne sur ce dépôt réel, pas seulement sur sa suite de tests.

## 6. Ce qui N'A PAS pu être obtenu depuis ce canal — gap honnête

**Run CI GitHub Actions réel sur `c646c024...` : non obtenu.** `git fetch`, `gh run list`, `gh auth status` et une requête directe à l'API GitHub Actions (`WebFetch`) ont tous été tentés et refusés par l'environnement de ce run automatisé — confirmation supplémentaire, après des dizaines d'occurrences dans ce même fil, que ce canal (déclenché par `@claude` sur commentaire d'issue) ne dispose structurellement ni du réseau ni des droits `actions: read` nécessaires pour interroger ou déclencher un run CI, même quand le workflow `Tests` lui-même les porte pour son propre job.

Ce fichier ne porte donc pas `ci-run-github-reel` en classe `VERIFIED` : le plus proche serait de le déclarer à l'aveugle, ce que la decision-5 (condition 7, « STOP en cas de nouveau rouge CI inexpliqué ») et le protocole interdisent. Même méthode que `request-4.md` (« run CI réel toujours à obtenir ») et que `request-5.md` §2, qui cite les runs réels obtenus en dehors de ce canal (`37401991101`, `37456438599`) par une session avec accès `gh`/réseau, filtrés par `headSha`.

**Geste minimal attendu de l'Orchestrator/Frédéric** : obtenir le run `Tests` réel sur `handoff-continuite-20260920` dont `headSha = c646c024cd93a709efe18c5aca925ef78a0212cd` (ou, à défaut d'un déclenchement automatique sur push déjà survenu, lancer `workflow_dispatch` sur ce SHA exact) et en citer l'URL/conclusion dans la prochaine décision ou dans un complément à cette demande — exactement la forme déjà utilisée en §2 de `request-5.md`.

## 7. Critères STOP de decision-5 (condition 7) — aucun déclenché

Aucun rouge CI inexpliqué constaté (aucun CI consulté, donc aucun rouge observé — ce n'est pas la même chose qu'un rouge résolu), aucune divergence d'autorité, aucune contamination applicative du rail (diff limité à `outils/handoff.js`, 1 nouveau fichier de test, 1 fichier de test existant mis à jour — vérifié par `git show --stat`), aucun mouvement inattendu de Production (§1).

## 8. Ce que cette demande n'autorise pas

Aucune fusion Production, aucune migration Production, aucune écriture Supabase Production, aucun déploiement, aucune promotion applicative, aucune extension métier non arbitrée. D4 (divergence rail ↔ production) reste hors périmètre, inchangé.
