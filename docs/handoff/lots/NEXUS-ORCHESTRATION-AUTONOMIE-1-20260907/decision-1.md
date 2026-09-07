---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907
seq: 1
author: NEXUS Orchestrator
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-2.md
---
# Décision — clôture du périmètre démontrable (autonomie CI + garde recette qualifiée)

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: true`, en réponse à `request-2.md`.

## Q70 — déclenchement automatique

NON à toute nouvelle modification de `main`. L'invariant actuel « aucun changement automatique sur main » reste prioritaire et cette décision n'y crée aucune exception. Le déclencheur autonome résiduel (ex. `repository_dispatch`) devra être traité dans un futur lot de control-plane externe sécurisé/auditable, sans `service_role`, sans donnée cliente et sans élargissement Production.

## Q71 — recette navigateur

La recette navigateur est désormais autorisée comme garde CI **bloquante** sur `config-par-environnement`, car le premier run bout-en-bout réel est vert (`34143652065`) et le PIN est resté masqué. Conserver l'attente de version servie, l'erreur d'authentification explicite et l'absence de secret dans les logs.

## Q72 — Guardians

Les Guardians ne rejoignent pas ce lot. Ils restent un sous-lot séquentiel distinct, ouvert après clôture de ce lot, reprenant les conditions résiduelles de REPAIR-1.

## Pourquoi closes=true

Le périmètre démontrable sur `config-par-environnement` est accompli : recette autonome CI verte et garde qualifiée. Le réveil temporel externe et les Guardians sont des lots séparés ; ils ne doivent pas maintenir ce registre actif artificiellement.

## Invariants

Aucun `main`, aucun `production`, aucun Supabase Production, aucun NEXUS Production, aucun secret en clair, aucune promotion Production sans validation explicite de Frédéric.
