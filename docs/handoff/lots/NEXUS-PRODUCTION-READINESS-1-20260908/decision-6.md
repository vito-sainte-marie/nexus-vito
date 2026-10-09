---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 6
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-6.md
branch: config-par-environnement
---
# Poursuite déterministe : intégrer le correctif portable et aller directement à la répétition réelle

Aucun arbitrage Frédéric supplémentaire n'est requis. `request-6.md` ne soulève aucun choix métier, aucune donnée personnelle Production, aucune ressource facturable et aucune extension de privilège. Il confirme un défaut d'outillage Test déjà couvert par `decision-5.md`.

## 1. Correctif scripts accepté, sans élargissement

Repartir du HEAD canonique courant de `config-par-environnement`. Intégrer uniquement le correctif qui garantit que `security find-generic-password` n'est jamais invoqué lorsque `NEXUS_TEST_DB_URL` est déjà fournie, dans les scripts où le défaut subsiste réellement :

- `outils/reconstruire-base-test.sh` ;
- `outils/repeter-lot-production-readiness-test.sh` ;
- `outils/repetition-release-complete.sh` si la même condition y est encore présente.

Conserver impérativement le refus de la référence Production avant toute tentative de connexion. Aucun secret ne doit être créé, affiché, journalisé ou commité.

## 2. Ne plus perfectionner PREPROD avant le prochain résultat réel

Après ce correctif et ses tests, ne pas ajouter de nouvelle architecture, de nouvelle garde ou de nouveau mécanisme sauf si un défaut observé pendant la répétition réelle le rend indispensable.

La priorité est désormais la preuve de la release : atteindre l'étape où les migrations de promotion rencontrent les données du jeu PREPROD, puis exécuter les étapes restantes. Un arrêt sur une migration confrontée à des données existantes est un résultat utile et doit être rapporté comme tel, avec la migration exacte, la forme de donnée rencontrée, l'impact Production potentiel et la correction minimale proposée.

## 3. Workflow et répétition

Le câblage déjà approuvé par `decision-5.md` reste inchangé : répétition destructive exclusivement via `workflow_dispatch`, input explicite `repetition_test=oui`, branche `config-par-environnement`, projet Test `udljdqxerrbbbajxubfn`, connexion Test déjà préparée, refus interne du projet Production.

Si le canal Claude ne peut toujours pas éditer `.github/workflows/*.yml`, il ne doit pas contourner cette restriction. Il doit terminer la partie qui lui appartient sur le HEAD canonique, puis revenir uniquement avec le geste Orchestrator matériellement requis. L'Orchestrator appliquera le patch workflow minimal depuis un rail autorisé.

## 4. Critère du prochain retour

Ne revenir par un nouveau `request-N.md` que dans l'un des cas suivants :

1. le correctif scripts est intégré au HEAD canonique et le workflow doit être câblé par l'Orchestrator ;
2. la répétition réelle a rencontré un défaut de migration ou de données nécessitant une correction ;
3. la répétition réelle et les étapes 5 à 8 sont terminées et le package est prêt pour les re-mesures Production SELECT-only ;
4. une vraie décision Frédéric devient nécessaire.

Aucune écriture ou migration Supabase Production, aucun push/merge `main` ou `production`, aucun déploiement ou rollback Production n'est autorisé par cette décision. `Prêt pour Production` ne vaut jamais autorisation Production.
