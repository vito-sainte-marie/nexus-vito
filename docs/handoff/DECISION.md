<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 5
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-5.md
branch: config-par-environnement
---
# Poursuite déterministe : rendre la répétition clean-slate réellement déclenchable

Aucun arbitrage Frédéric supplémentaire n'est requis. Le besoin décrit par `request-5.md` est une conséquence directe de `decision-4.md` déjà consommée : la répétition PREPROD-équivalente doit être réellement exécutée sur `nexus-test`, et un workflow vert dont les étapes Test sont `skipped` n'est pas une preuve de répétition.

Le retour Claude a été canonisé sans fusion globale de sa branche, car `config-par-environnement` a avancé depuis son HEAD de départ. Les constats doivent donc être rejoués sur le HEAD canonique courant avant intégration sélective.

## 1. Correctif scripts autorisé

Claude doit repartir du HEAD canonique courant de `config-par-environnement` et vérifier sur les fichiers actuels le défaut suivant : une URL `NEXUS_TEST_DB_URL` déjà fournie ne doit jamais être précédée d'une dépendance obligatoire au trousseau macOS. Si le défaut existe encore, intégrer le correctif minimal dans :

- `outils/reconstruire-base-test.sh` ;
- `outils/repeter-lot-production-readiness-test.sh` si le même défaut y subsiste ;
- le test de non-régression/mutation correspondant.

La référence Production doit toujours être refusée avant toute tentative de connexion. Aucun secret ne doit être créé, lu en clair, journalisé ou commité.

## 2. Câblage workflow retenu

Le principe du patch proposé est approuvé : la répétition destructive doit être exclusivement manuelle et explicite via `workflow_dispatch`, avec input `repetition_test` vide par défaut et valeur exacte `oui` pour l'activer. Elle doit rester bornée à `refs/heads/config-par-environnement`, au projet Test `udljdqxerrbbbajxubfn`, à une connexion Test en écriture déjà préparée par le job, et au refus interne codé en dur du projet Production.

Un `push`, une `pull_request`, un dispatch sans input ou toute autre branche ne doit jamais lancer la reconstruction clean-slate.

Le canal Claude ayant déclaré ne pas pouvoir éditer `.github/workflows/*.yml`, il ne doit pas contourner cette restriction. Une fois le correctif scripts intégré et prouvé sur le HEAD canonique, l'Orchestrator appliquera le patch minimal au workflow de Test, sans toucher `main`, `production` ni aucun environnement Production.

## 3. Preuves avant exécution réelle

Exiger avant le dispatch réel :

1. tests ciblés du correctif scripts, avec mutation négative ;
2. suite complète sans nouvelle régression ;
3. Handoff conforme ;
4. Guardians sans nouveau finding imputable ;
5. preuve statique que la garde workflow ne peut viser que `config-par-environnement` et `nexus-test` ;
6. aucun secret exposé.

## 4. Après câblage workflow

La répétition réelle doit ensuite vérifier : reconstruction bornée puis migrations de promotion dans l'ordre, réensemencement déterministe, retour final en `TEST_NORMAL`, 4 comptes de recette et rattachements, journal Live, suite complète, Guardians et recette navigateur réelle. Toute preuve manquante reste `INCONNU` et bloque `Prêt pour Production`.

Les re-mesures Production restent strictement SELECT-only et seront rafraîchies au plus près de la gate finale. Aucune écriture ou migration Production, aucun push/merge `main` ou `production`, aucun déploiement réel et aucun rollback Production ne sont autorisés par cette décision.
