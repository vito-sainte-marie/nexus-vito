<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/decision-7.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 7
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-7.md
branch: config-par-environnement
---
# Poursuite déterministe : confirmer la recette réelle avant les re-mesures Production

Aucun arbitrage Frédéric supplémentaire n'est requis. `request-7.md` décrit un défaut de fixture/recette déjà isolé, sans choix métier nouveau, sans donnée personnelle Production, sans ressource facturable et sans extension de privilège.

## 1. Correctif recette accepté

Le correctif qui reconnaît explicitement le cas `pointage_actif=false` dans la recette employé est accepté. Il doit rester limité à la recette Test : aucune modification du comportement métier de Production n'est autorisée par cette décision.

Le HEAD canonique a déjà intégré ce correctif et la CI locale/non connectée est verte. Cette CI ne vaut toutefois pas preuve navigateur réelle lorsque les étapes Test connectées sont `skipped`.

## 2. Prochaine preuve obligatoire

Utiliser le mécanisme CI déjà présent, sans ajouter de nouvelle architecture, afin d'obtenir une exécution réelle de la recette navigateur sur `config-par-environnement` contre `nexus-test` avec les secrets Test déjà autorisés.

Le `workflow_dispatch` existant est le chemin préféré s'il permet d'exécuter les étapes Test connectées sur la branche canonique. Ne modifier `.github/workflows/tests.yml` que si une impossibilité matérielle du mécanisme existant est démontrée, et alors revenir avec le patch minimal requis avant de l'appliquer.

La preuve attendue est le verdict réel sur le parcours Employé A et l'invitation à l'inventaire après reconnaissance du pointage désactivé. Une étape `skipped` ne constitue pas une preuve.

## 3. Si la recette passe

Si la recette réelle est satisfaite et qu'aucune nouvelle régression n'apparaît, compléter le package de readiness et revenir par un nouveau `request-N.md` uniquement pour préparer les re-mesures Production strictement SELECT-only déjà autorisées avant la gate finale.

## 4. Si la recette échoue

Ne pas perfectionner l'outillage. Isoler la première cause réelle, la classer entre défaut de release, défaut de fixture/recette ou indisponibilité d'environnement, appliquer uniquement une correction déterministe minimale en Test lorsqu'elle est déjà couverte par la gouvernance, puis rejouer à partir de l'étape utile.

Si la correction implique un choix métier, une donnée Production non anonymisée, une nouvelle ressource facturable, une extension de privilège ou une contradiction canonique non résoluble, revenir sans agir pour arbitrage Frédéric.

## 5. Interdictions inchangées

Aucune écriture ou migration Supabase Production. Aucun push/merge vers `main` ou `production`. Aucun déploiement ni rollback Production. Aucune copie non anonymisée de Production. Aucun secret ou service_role exposé. Migration 21 reste exclue de cette release. `Prêt pour Production` ne vaut jamais autorisation Production.
