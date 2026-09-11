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

Périmètre réellement touché :
- `outils/reconstruire-base-test.sh` ;
- `outils/repeter-lot-production-readiness-test.sh` ;
- `outils/repetition-release-complete.sh`, découvert par le test existant `test_credential_seulement_si_necessaire_20260909.js`.

## 2. Correctif appliqué

`security` n'est tenté que si `NEXUS_TEST_DB_URL` est absente. Le refus de la référence Production reste avant toute tentative de connexion. Aucun secret n'est créé, lu en clair ou journalisé.

## 3. Preuves

- nouveau test mutationnel `test_connexion_test_url_avant_trousseau_20260909.js` : 3/3 ;
- test comportemental existant couvrant les trois scripts : 10/10 ;
- suite complète : 241/250, 9 échecs historiques identiques, 0 régression ;
- Handoff : conforme, 0 nouvelle erreur ;
- Guardians : aucun nouveau finding imputable ;
- aucun changement Production.

## 4. Ce qui reste

Le correctif scripts est fait et prouvé dans la branche Claude. Le câblage `workflow_dispatch` borné à `config-par-environnement` et `nexus-test`, puis la répétition réelle, restent à faire par le rail Orchestrator disposant du droit d'éditer le workflow. Aucune écriture Production n'est autorisée.
