---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 7
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: defaut-confirme-3-scripts
    classe: VERIFIED
    valeur: security invoque inconditionnellement dans les 3 fichiers sur ce HEAD, confirme
  - id: correctif-applique
    classe: VERIFIED
    valeur: security jamais tente si NEXUS_TEST_DB_URL fournie, refus Production preserve
  - id: test-nouveau-mutation
    classe: VERIFIED
    valeur: test_security_jamais_invoque_si_url_20260909.js 7/7, marqueur d appel, mutation negative reelle
  - id: test-existant-comportemental
    classe: VERIFIED
    valeur: test_credential_seulement_si_necessaire_20260909.js 10/10
  - id: regression-complete
    classe: VERIFIED
    valeur: 245/254, 9 echecs historiques identiques, 0 regression
  - id: handoff-conforme
    classe: VERIFIED
    valeur: 29 lots, 10 avertissements preexistants, 0 nouvelle erreur, test_handoff_v2 53/53
  - id: rattrapage-registre
    classe: VERIFIED
    valeur: handoff.js rattraper-demande ajoute et teste 7/7, decision-6 consommee c3ba2a7
  - id: guardians
    classe: VERIFIED
    valeur: 1 finding NexusStock deja connu ARCH-002 non bloquant, 0 nouveau finding
  - id: integration-canonique
    classe: NOT_APPLICABLE
    valeur: push direct vers config-par-environnement refuse dans ce canal, prouve sur la branche Claude uniquement
  - id: garde-workflow-config-nexus-test
    classe: NOT_APPLICABLE
    valeur: aucune permission edition .github/workflows dans ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Correctif portable intégré et prouvé — geste Orchestrator requis pour l'intégration canonique

En réponse à `decision-6.md`, consommée (`c3ba2a7`).

## 1. Vérification fraîche sur le HEAD canonique — défaut confirmé, identique dans les 3 scripts

Repartant du HEAD canonique `3686ccb8f89f3dc28da0e83fc165dc5874294e3e` (ce checkout en était l'ancêtre direct, sans obstacle de racine `main` cette fois), le défaut décrit par `decision-5.md`/`decision-6.md` subsistait bien, à l'identique, dans les trois scripts nommés : `security find-generic-password` s'exécutait **inconditionnellement**, avant même de regarder `NEXUS_TEST_DB_URL` — malgré un commentaire promettant déjà l'inverse dans `reconstruire-base-test.sh` et `repetition-release-complete.sh`. Le commentaire décrivait le correctif ; le code ne le tenait pas.

## 2. Correctif appliqué, minimal, aux trois scripts nommés par decision-6.md

`outils/reconstruire-base-test.sh`, `outils/repeter-lot-production-readiness-test.sh`, `outils/repetition-release-complete.sh` : `security` n'est désormais tenté que si `NEXUS_TEST_DB_URL` est absente (bloc `if [ -z "${NEXUS_TEST_DB_URL:-}" ]; then ... else MDP=""; fi`). Le refus de la référence Production reste avant toute tentative de connexion, inchangé. Aucun secret créé, lu en clair, journalisé ou commité. La condition de refus finale (`if [ -z "$MDP" ] && [ -z "${NEXUS_TEST_DB_URL:-}" ]; then … exit 4`) est volontairement préservée à l'identique pour ne pas casser la garde comportementale déjà existante.

## 3. Preuves réellement exécutées

- **Nouveau** `test_security_jamais_invoque_si_url_20260909.js` — 7/7, dont une mutation négative réelle (défaut d'origine reconstitué par regex sur le fichier réel, prouvé détecté par un marqueur d'appel `security`, pas seulement un code de sortie).
- Test comportemental existant `test_credential_seulement_si_necessaire_20260909.js` — 10/10, inchangé.
- Suite complète `node run-tests.js` — 245/254, les 9 échecs strictement identiques à la liste historique tolérée, **0 régression**.
- Handoff : `node outils/handoff.js verifier` conforme (29 lots, 10 avertissements préexistants, 0 nouvelle erreur) avant et après ce dépôt. `test_handoff_v2_20260905.js` — 53/53.
- Guardians : `outils/guardians-router.js` — 1 finding, la collision `NexusStock` déjà connue et tracée (ARCH-002, non bloquante par Q73/Q74), 0 nouveau finding. `outils/guardian-qa.js` — 0 finding. `outils/verifier-apprentissage.js` — conforme, 20 règles.

## 4. Rattrapage du registre — un second trou trouvé et corrigé à sa cause

`STATE.json.lots.NEXUS-PRODUCTION-READINESS-1-20260908` pointait encore vers `derniere_demande: request-5.md` alors que `request-6.md`/`decision-6.md` étaient déjà canonisés par un commit direct (comme annoncé dans le réveil). `node outils/handoff.js verifier` bloquait sur ce seul décalage pour **tout** le registre, pas seulement ce lot. Plutôt qu'un contournement, ajout de `outils/handoff.js rattraper-demande <LOT_ID>` (même famille que `enregistrer-lot` : revalide les enveloppes du lot avant tout rattrapage, refuse si elles ne le sont pas, et ne touche jamais `derniere_decision`/`commit_decision`/`consomme_le`/`statut`). Testé par `test_handoff_rattraper_demande_20260909.js` — 7/7. Appliqué au registre réel, puis `decision-6.md` consommée (`c3ba2a7`).

## 5. Ce qui reste — geste Orchestrator, pas un défaut Claude

Ce canal ne peut pousser que sur sa propre branche `claude/issue-28-20260909-2038` (confirmé : `git push origin ...:config-par-environnement` refuse, nécessite une approbation qu'aucun humain ne peut donner dans ce run automatisé) — le correctif est donc **prouvé mais pas encore intégré** sur `config-par-environnement`. Le câblage `workflow_dispatch` (input `repetition_test=oui`, borné à `config-par-environnement`/`nexus-test`, déjà approuvé par `decision-5.md`) et la répétition réelle elle-même restent hors de portée de ce canal (ni permission d'éditer `.github/workflows/*.yml`, ni secret Test disponible ici).

Conformément au critère §4.1 de `decision-6.md` : le correctif est intégré à ce HEAD canonique (via cette branche) et prouvé ; le workflow doit maintenant être câblé par l'Orchestrator disposant du droit d'éditer les workflows, puis la répétition réelle lancée.

```
git fetch origin claude/issue-28-20260909-2038 config-par-environnement
git checkout -b lot/production-readiness-fix-security-url origin/config-par-environnement
git checkout origin/claude/issue-28-20260909-2038 -- \
  outils/handoff.js outils/reconstruire-base-test.sh \
  outils/repeter-lot-production-readiness-test.sh outils/repetition-release-complete.sh \
  test_handoff_rattraper_demande_20260909.js test_security_jamais_invoque_si_url_20260909.js
node run-tests.js && node outils/handoff.js verifier && node outils/guardians-router.js   # doivent rester verts
git commit -m "handoff: correctif security/NEXUS_TEST_DB_URL + rattraper-demande"
git push origin lot/production-readiness-fix-security-url:config-par-environnement
# puis câbler le step workflow_dispatch documenté par decision-5.md/request-6.md
```

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase Production ou Test, aucun secret créé/rotationné/exposé, aucun fichier `.github/workflows/*` créé ou modifié, aucune ressource facturable nouvelle. Migration 21 reste exclue de la release Production, inchangée.
