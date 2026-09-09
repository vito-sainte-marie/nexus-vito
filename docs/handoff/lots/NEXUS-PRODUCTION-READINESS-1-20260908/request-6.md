---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 6
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
    valeur: security invoque inconditionnellement dans les 3 fichiers avant correctif
  - id: correctif-applique
    classe: VERIFIED
    valeur: security n a jamais tente si NEXUS_TEST_DB_URL fournie, ligne de refus combinee preservee
  - id: test-nouveau-mutation
    classe: VERIFIED
    valeur: test_connexion_test_url_avant_trousseau_20260909.js 3/3, execution reelle et mutation negative
  - id: test-existant-comportemental
    classe: VERIFIED
    valeur: test_credential_seulement_si_necessaire_20260909.js 10/10, echouait avant ce correctif
  - id: regression-complete
    classe: VERIFIED
    valeur: 241/250, 9 echecs historiques identiques, 0 regression
  - id: handoff-conforme
    classe: VERIFIED
    valeur: 29 lots, 10 avertissements preexistants, 0 nouvelle erreur
  - id: guardians
    classe: VERIFIED
    valeur: 1 finding NexusStock deja connu ARCH-002 non bloquant, 0 nouveau finding
  - id: garde-workflow-config-nexus-test
    classe: NOT_APPLICABLE
    valeur: aucune permission d edition sur .github/workflows dans ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Correctif scripts intégré et prouvé sur le HEAD canonique — decision-5.md exécutée

## 1. Vérification fraîche du défaut — confirmée, plus large que signalé

Repartant du HEAD canonique `ee3576dc6ab575029ee10052734c9fff0d253e7e`, la vérification demandée a confirmé le défaut : les trois scripts qui invoquent `security find-generic-password` le faisaient tous **inconditionnellement**, avant même de regarder `NEXUS_TEST_DB_URL`. Le commentaire de chacun promettait un ordre que le code ne tenait pas.

Périmètre réellement touché — un script de plus que ce que le réveil nommait :

- `outils/reconstruire-base-test.sh` (cité par `request-5.md`) ;
- `outils/repeter-lot-production-readiness-test.sh` (cité par `request-5.md`) ;
- `outils/repetition-release-complete.sh` — **non cité**, découvert en cherchant si un test déjà présent sur le canon couvrait le même défaut. `test_credential_seulement_si_necessaire_20260909.js` (déjà commité, jamais vert depuis son ajout) le couvre déjà tous les trois et confirme la même cause dans les trois fichiers.

## 2. Correctif appliqué (minimal, même forme dans les trois fichiers)

`security` n'est désormais tenté que si `NEXUS_TEST_DB_URL` est absente :

```bash
MDP=""
if [ -z "${NEXUS_TEST_DB_URL:-}" ]; then
  MDP="$(security find-generic-password -a nexus -s nexus-test-db -w 2>/dev/null || true)"
  if [ -z "$MDP" ]; then
    MDP="${NEXUS_TEST_DB_PASSWORD:-}"
  fi
fi
if [ -z "$MDP" ] && [ -z "${NEXUS_TEST_DB_URL:-}" ]; then
  echo "Aucun moyen de se connecter : ..." >&2
  exit 4
fi
```

La ligne de refus combinée (`[ -z "$MDP" ] && [ -z "${NEXUS_TEST_DB_URL:-}" ]`) est délibérément conservée telle quelle : c'est elle que `test_credential_seulement_si_necessaire_20260909.js` mute pour prouver sa propre épreuve. La modifier sans nécessité aurait cassé un filet déjà en place. Le refus de la référence Production reste avant toute tentative de connexion dans les trois fichiers — inchangé.

## 3. Preuves exigées par decision-5.md §3 — toutes acquises

1. **Tests ciblés avec mutation négative** : nouveau `test_connexion_test_url_avant_trousseau_20260909.js` (exécution réelle des deux scripts les plus simples à mettre en situation, faux `security`/`psql`, preuve que `security` n'est jamais invoqué quand l'URL suffit, et mutation négative confirmant que l'ancien ordre aurait été détecté) — **3/3**. Le test déjà présent sur le canon, `test_credential_seulement_si_necessaire_20260909.js` (comportemental, couvre les trois scripts dont `repetition-release-complete.sh`) — **10/10**, alors qu'il échouait avant ce correctif (sa mutation ne trouvait plus le motif attendu dans le fichier réel).
2. **Suite complète sans nouvelle régression** : `node run-tests.js` → **241/250**, les 9 échecs restants strictement identiques à la liste historique tolérée par la CI (inventaire/réception/DOM, sans lien avec ce correctif) — 0 régression.
3. **Handoff conforme** : `node outils/handoff.js verifier` → conforme avant et après (29 lots, 10 avertissements préexistants, 0 nouvelle erreur).
4. **Guardians sans nouveau finding imputable** : `node outils/guardians-router.js` sur le diff réel du commit → 1 finding, la collision `NexusStock` déjà connue et tracée (ARCH-002, non bloquante par arbitrage Q73/Q74) — 0 nouveau finding. `node outils/guardian-qa.js` → 0 finding. `node outils/verifier-apprentissage.js` → conforme, 20 règles.
5. **Garde workflow bornée à `config-par-environnement`/`nexus-test`** : non re-produite ici — ce canal ne peut toujours pas éditer `.github/workflows/*.yml`. Le patch proposé par une session précédente (`repetition-executable-2-pooler-ipv6-20260909.md`) portait déjà cette triple garde (branche canonique, `workflow_dispatch` avec input explicite `oui`, refus interne codé en dur de la référence Production) ; il reste à vérifier et appliquer par l'Orchestrator, cette session n'ayant pas les moyens de le refaire ni de le contourner.
6. **Aucun secret exposé** : aucune valeur de credential lue, affichée ou journalisée à aucune étape.

## 4. decision-5.md consommée

```
NEXUS-PRODUCTION-READINESS-1-20260908 :
  statut            : DECISION_CONSOMMEE
  derniere_decision : decision-5.md
  commit_decision   : 1b364b783e026c65e2005e1df38c839fbcb6ab91
```

## 5. Ce qui reste — pour l'Orchestrator, pas pour ce canal

Le §1 de `decision-5.md` (correctif scripts) est fait et prouvé. Le §2 (câblage workflow) et le §4 (répétition réelle post-câblage) restent hors de portée de ce canal, inchangé depuis les réveils précédents : pas de permission d'éditer `.github/workflows/*.yml`, aucun secret Test disponible ici. L'Orchestrator dispose maintenant de scripts alignés sur les trois fichiers pour appliquer et déclencher le patch `workflow_dispatch` documenté.

## Invariants respectés

Aucun changement `main`/`production`, aucune écriture ni migration Supabase Production ou Test, aucun secret créé/rotationné/exposé, aucun fichier `.github/workflows/*` créé ou modifié, aucune ressource facturable nouvelle. Migration 21 reste exclue de la release Production, inchangée.

Commits : `8f4832d` (correctif des trois scripts + nouveau test), `1e770ee` (consommation `decision-5.md`), branche `claude/issue-28-20260909-1735`.
