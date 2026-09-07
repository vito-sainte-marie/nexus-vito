<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-ORCHESTRATION-AUTONOMIE-1-20260907/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
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

# Décision — autonomie Test validée, réveil externe et Guardians séparés

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: true`.

Les preuves de `request-2.md` suffisent pour clore le présent lot sur son périmètre effectivement démontré : la recette navigateur NEXUS Test a tourné de bout en bout en CI sur `config-par-environnement`, a attendu la version servie correcte, a validé le mécanisme Carburants attendu et n'a nécessité aucune saisie humaine. La suite reste à 198/207 avec les 9 échecs historiques connus. Aucun accès Production n'est déclaré.

Cette clôture ne signifie pas que l'autonomie complète 24/7 est acquise : le déclencheur temporel externe et les Guardians exécutables restent des travaux distincts.

## Q70 — réveil automatique

Aucune nouvelle modification de `main` n'est autorisée.

Le `schedule` GitHub Actions proposé sur la branche par défaut est donc refusé dans l'architecture courante, même s'il ne porte que quelques lignes. L'invariant de reprise et l'instruction humaine actuelle sont plus stricts que l'ancienne exception de control-plane : `main` reste fermée à l'Orchestrator.

Le futur réveil automatique doit utiliser un control-plane externe ou un mécanisme équivalent qui :

- n'exige aucune modification de `main` ;
- lit l'état canonique de `config-par-environnement` ;
- ne réveille Claude que pour une décision canonique non consommée et fraîche ;
- respecte GOV-001/GOV-004 et empêche les doublons ;
- n'embarque aucun `service_role`, PIN ou secret client dans le dépôt ou les logs ;
- reste auditable et révocable ;
- ne consomme ni ne modifie le Handoff à la place de Claude/Orchestrator.

`repository_dispatch` peut être étudié comme moyen technique, mais aucun token dédié ni nouvelle capacité d'écriture n'est autorisé par cette décision. Le choix du transport du réveil appartient au futur lot de control-plane.

## Q71 — recette navigateur

La recette peut désormais être bloquante en CI sur `config-par-environnement`.

Le premier run réel est vert et a déjà permis de détecter puis corriger deux défauts d'outillage : mauvaise attente d'authentification et identifiant technique inutilisable par l'écran. La preuve n'est donc plus hypothétique.

Conditions permanentes :

- attendre explicitement la version NEXUS Test correspondant au commit testé ;
- ne jamais journaliser le PIN ;
- échouer fermé sur une preuve métier fausse ;
- distinguer une indisponibilité d'outillage d'un résultat métier négatif conformément à ENV-003 ;
- aucune utilisation de `service_role` dans le navigateur ou le workflow.

Le défaut historique des variables `*_USERNAME` encore présentes sur `main` est documenté mais n'est pas corrigé ici, puisque `main` est hors périmètre.

## Q72 — Guardians

Le rapatriement et l'activation des Guardians restent dans un lot P0 séparé.

Ce futur lot reprend les critères non satisfaits de REPAIR-1 : présence canonique des outils Guardians/apprentissage sur `config-par-environnement`, tests ciblés, mutation négative, câblage réel dans la CI, régression complète, absence de secrets et absence d'accès Production.

Séparer ce travail évite de transformer une clôture de recette navigateur déjà prouvée en chantier transversal non borné.

## Frontière données / secrets

La doctrine reste inchangée : le créateur administre NEXUS mais l'entreprise cliente contrôle l'usage et le partage de ses données. Aucun mécanisme d'orchestration ne crée un droit supplémentaire sur les données clientes.

Tout accès privilégié futur doit rester derrière un composant serveur/NEXUS Connector de confiance, avec contexte entreprise/site explicite et moindre privilège. `service_role` reste interdit dans dépôt, navigateur et logs.

## Suite

Aucun nouveau code n'est requis dans ce lot après consommation de la présente décision.

Les travaux futurs à matérialiser séparément sont :

1. control-plane de réveil externe sans modification de `main` ;
2. Guardians backend + vérification d'apprentissage intégrés canoniquement ;
3. dette Carburants `CARB-006`, déjà séparée au Backlog.

## Interdictions

- aucun changement `main` ;
- aucun changement `production` ;
- aucune opération Supabase Production ;
- aucun NEXUS Production ;
- aucune promotion Production sans validation explicite de Frédéric ;
- aucun secret/PIN/service_role dans dépôt, navigateur ou logs.
