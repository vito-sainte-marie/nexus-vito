<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/request-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 5
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: bug-trousseau-corrige
    classe: VERIFIED
    valeur: reconstruire-base-test.sh et repeter-lot-production-readiness-test.sh, NEXUS_TEST_DB_URL verifiee avant trousseau, 7/7 tests dont mutation negative sur le fichier pre-correctif reel
  - id: regression-suite
    classe: VERIFIED
    valeur: 232/241, 9 echecs historiques identiques, 0 regression
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 1 finding connu NexusStock ARCH-002, guardian-qa 0 finding, apprentissage conforme 20 regles
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 29 lots, 10 avertissements preexistants, 0 nouvelle erreur
  - id: secrets-canal-absents
    classe: VERIFIED
    valeur: SUPABASE_TEST_DB_URL_WRITE NEXUS_TEST_DB_URL_WRITE NEXUS_TEST_DB_URL NEXUS_TEST_MANAGER_PIN NEXUS_TEST_CREATEUR_PIN tous absents verifie par test booleen sans lecture de valeur
  - id: patch-workflow-propose
    classe: DECLARED
    valeur: patch minimal exact documente dans request-5.md borne workflow_dispatch input explicite et config-par-environnement non applique faute de permission edition workflows
  - id: execution-reelle-clean-slate
    classe: NOT_APPLICABLE
    valeur: necessite edition et declenchement du workflow hors de portee de ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete aucun merge aucun deploiement
---
# request-5 : répétition clean-slate Test, mécanisme corrigé, câblage CI restant

Ce request est la copie canonique du retour Claude publié depuis `claude/issue-28-20260909-1213`. La branche canonique a avancé depuis le HEAD de départ de Claude ; aucune fusion globale de cette branche n'est donc autorisée. Les constats doivent être rejoués sur le HEAD canonique courant avant intégration sélective.

## Constats vérifiés par Claude

Le workflow canonique ne contient pas encore d'étape de répétition clean-slate bornée à `workflow_dispatch`. Le canal Claude n'expose aucun secret Test et ne peut pas éditer `.github/workflows/*.yml`.

Claude a en outre identifié un défaut déterministe dans `outils/reconstruire-base-test.sh` et `outils/repeter-lot-production-readiness-test.sh` : le trousseau macOS était exigé avant de vérifier si `NEXUS_TEST_DB_URL` était déjà fournie. Sur runner Linux, cela bloque une répétition même avec une URL Test valide fournie par le rail. Le correctif consiste à tester `NEXUS_TEST_DB_URL` d'abord, puis seulement à utiliser le trousseau ou le repli portable si l'URL n'est pas fournie. La garde `PRODUCTION` doit rester avant toute tentative de connexion.

Preuves Claude : nouveau test `test_reconstruction_sans_trousseau_20260909.js` 7/7 avec `bash -n` sur les deux scripts et mutation négative sur le fichier pré-correctif ; `test_connexion_test_repli_20260909.js` 6/6 ; `test_repetition_preserve_journal_20260909.js` 10/10 ; suite globale 232/241 avec 9 échecs historiques connus et 0 régression ; Guardian QA 0 finding ; apprentissage conforme.

## Patch workflow demandé

Ajouter un input explicite `workflow_dispatch.inputs.repetition_test`, vide par défaut, et une étape de répétition qui ne s'exécute que si :

- `github.ref == 'refs/heads/config-par-environnement'` ;
- `github.event_name == 'workflow_dispatch'` ;
- `github.event.inputs.repetition_test == 'oui'` ;
- la connexion Test en écriture est réellement disponible ;
- le script reçoit explicitement la référence Test `udljdqxerrbbbajxubfn` et conserve le refus codé en dur de la référence Production.

Le workflow doit réutiliser la connexion Test déjà préparée et masquée, sans nouvelle lecture ni exposition de secret. Un dispatch vide, un push ou une pull request ne doit jamais lancer la reconstruction destructive.

## Résultat attendu après intégration

Déclencher une répétition réelle via `workflow_dispatch` avec `repetition_test=oui`, puis vérifier reconstruction complète, réensemencement déterministe, 4 comptes de recette et rattachements, journal Live, suite complète, Guardians et recette navigateur réelle. Les re-mesures Production restent SELECT-only et doivent être rafraîchies au plus près de la gate finale. Aucune opération Production n'est autorisée par ce request.
