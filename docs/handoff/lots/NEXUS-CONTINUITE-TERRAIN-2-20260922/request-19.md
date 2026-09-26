---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 19
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: fingerprint-reverifie
    classe: VERIFIED
    valeur: node-outils-reveil-orchestrateur-js-json-identique-a-request-18
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-15-avertissements-11-derogations-0-nouvelle-erreur
  - id: run-tests
    classe: VERIFIED
    valeur: aucune-regression-9-echecs-connus
  - id: guardians
    classe: VERIFIED
    valeur: 1-finding-nexusstock-arch-002-deja-connu
  - id: push-canonique-impossible
    classe: VERIFIED
    valeur: git-push-dry-run-requiert-approbation-indisponible
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Re-vérification fraîche de `request-18.md` — rien de neuf, deux blocages confirmés inchangés

Déposée au titre de **Q76** (a posteriori, outillage/mesure pur) : aucune modification
applicative, aucune écriture, aucun secret. Répond au réveil du 26/09/2026 sur l'issue #28
demandant de vérifier fraîchement que le document désigné par `request-18.md` est lisible à
distance et que les homonymes sont bien écartés par empreinte, avant de poursuivre.

## 1. Ce qui a été re-mesuré, pas relu

Cette session démarre exactement au HEAD canonique : `948849d` = `origin/handoff-continuite-
20260920`. Reproduction indépendante de la mesure de `request-18.md` §7, avec
`node outils/reveil-orchestrateur.js --json` :

- `lisible_a_distance: true` — confirmé identique ;
- `memes`: `handoff-continuite-20260920`, `origin/handoff-continuite-20260920`,
  `claude/issue-28-20260926-1219` (cette session) ;
- `homonymes`: les 4 mêmes branches, par empreinte (`git hash-object`), pas par nom —
  `origin/claude/issue-28-20260924-2119`, `-2147`, `-2209`, `origin/claude/issue-28-20260925-
  1048` — correctement écartées, non offertes en lecture ;
- `branche_declaree_trompeuse: false`, `non_publiee: false` — inchangé ;
- motif toujours `DEMANDE_DEPASSEE` (`request-18.md` attend encore un arbitrage, `decision-10.md`
  répond à `request-16.md`, pas à `request-18.md`).

Aucune dérive depuis le dépôt de `request-18.md` : les quatre branches homonymes n'ont ni
disparu ni changé de contenu, la désignation `wake_to` reste la même adresse.

## 2. Santé du registre et de la suite, mesurée à neuf

- `node outils/handoff.js verifier` : conforme — 32 lots, 15 avertissements, 11 dérogations,
  toutes préexistantes, 0 nouvelle erreur.
- `node run-tests.js` : « Aucune régression : seuls les 9 échecs connus subsistent. » —
  identique à la base historique de ce fil.
- `node outils/guardians-router.js` : 1 finding, la collision `NexusStock` déjà connue et
  tracée (`ARCH-002`), non bloquante par arbitrage antérieur — aucun nouveau finding.
- `git push --dry-run origin HEAD:handoff-continuite-20260920` : requiert encore une
  approbation qu'aucun humain ne peut donner dans ce run automatisé — le blocage d'écriture
  déjà mesuré par `request-17.md` (permissions API `push:false`) tient toujours.

## 3. La recommandation outillage de `etude-isolation-test-candidats-web-1.md` §3.1 est déjà faite

`urlTestDeBranche()` existe (`outils/recette-navigateur-test.js:199`) et est couverte par
`test_recette_navigateur_test_20260907.js`. Rien à ajouter de ce côté.

## 4. Pourquoi cette session s'arrête ici

Aucun arbitrage technique déterministe supplémentaire n'est débloqué par cette re-vérification.
Les deux points encore ouverts du lot restent exactement ceux déjà déposés :

- **`request-18.md` §5** : une vraie décision Créateur — accorder ou non `issues: write` pour
  que le réveil se poste seul. Ce n'est pas un arbitrage technique déterministe ; je ne le
  tranche pas.
- **`request-17.md`** : les gates `#65` restantes (isolation Supabase Test des candidats,
  preuve de création réelle de la migration) demandent un geste humain (observation Cloudflare)
  ou un accès que ce canal n'a pas (Supabase Test jetable, droits de push sur le rail) — confirmé
  à nouveau ci-dessus, pas supposé.

Conformément à l'instruction reçue, je reprends les preuves manquantes de `#65` seulement
lorsqu'elles deviennent atteignables depuis ce canal — ce n'est toujours pas le cas — et je ne
rouvre aucun diagnostic déjà acquis (`classement-gates-etat-git-62-65-1.md` reste la référence,
inchangée).

## Ce qui n'a pas été touché

Aucune modification `main`/`production`, aucune migration/écriture Supabase, aucune promotion
Production, aucun secret lu ou exposé, aucune des quatre branches divergentes modifiée, aucun
portage vers une branche candidate, aucun déploiement.

## Invariants respectés

`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail canonique. Aucun changement
`main`/`production`, aucune opération Supabase, aucun secret/PIN/service_role, aucune nouvelle
règle métier/UX/rôle/RLS.
