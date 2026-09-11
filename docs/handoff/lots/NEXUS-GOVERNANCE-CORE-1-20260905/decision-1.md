---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-GOVERNANCE-CORE-1-20260905
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — NEXUS Governance Core v1

## Verdict

**APPROVED_WITH_CONDITIONS — constitution Governance Core v1 acceptée et lot documentaire clos.**

La proposition est suffisamment simple, directement reliée aux défauts réellement observés et cohérente avec l'objectif premier : rendre du temps à Frédéric tout en augmentant la fiabilité de NEXUS.

## Q28 — nombre de Guardians

**APPROVED : cinq Guardians maximum pour le Core initial.**

Architecture, Security & Isolation, Business Rules, QA / Regression et NEXUS Bible sont retenus. Aucun Guardian supplémentaire ne doit être créé sans défaut concret non couvert par ces cinq rôles et sans gain mesurable.

Le retrait d'un Guardian devenu stérile est explicitement autorisé après arbitrage. L'organisation n'est pas un organigramme à préserver : c'est un outil au service du produit.

## Q29 — premier chantier

**APPROVED_WITH_CONDITIONS.**

Le premier chantier réel sera la racine commune : **« le site doit être exigé, jamais déduit implicitement »**.

Il regroupe dans une même mission de sécurisation :
1. les defaults de site encore présents ;
2. les insertions applicatives sans `site_id` ;
3. la branche créateur non éprouvée.

Condition essentielle : ne pas corriger les 58 defaults en masse par recherche/remplacement. Le lot doit d'abord cartographier les contrats, usages réels, tables concernées, écritures applicatives, RLS et dépendances. Toute modification doit être précédée d'une preuve de comportement attendu et suivie de tests négatifs multi-site.

Ce premier chantier servira aussi de **preuve grandeur nature du Governance Core** : Claude Builder propose/implémente ; les Guardians requis produisent des avis séparés ; la CI apporte les preuves mécaniques ; ChatGPT arbitre. Aucun acteur ne valide son propre travail.

## Q30 — contrat anti-dérive

**APPROVED avec règle de proportionnalité.**

Les six champs sont obligatoires pour tous les lots :
- `objectif_metier`
- `gain_attendu`
- `contrats_touches`
- `guardians_requis`
- `preuves_exigees`
- `definition_de_termine`

Mais ils peuvent tenir sur six lignes pour un changement simple. La qualité du contrôle ne doit jamais être confondue avec la longueur de la documentation.

Un lot purement technique peut déclarer qu'il ne contribue directement à aucun segment de l'Horizon, mais il doit alors expliquer quelle dette, quel risque ou quelle condition de fiabilité il réduit.

## Ajustement de gouvernance important

La phrase « Security Guardian bloque seul ; seul Frédéric lève » est retenue avec une précision : **Frédéric peut autoriser la poursuite après avoir reçu explicitement le risque et ses conséquences, mais aucun agent ne doit techniquement affaiblir une protection de sécurité uniquement pour satisfaire cette décision sans un lot dédié, traçable et une preuve de mitigation.**

Une gate humaine n'efface pas le risque ; elle en accepte explicitement la responsabilité.

## ADR

Architecture ADR acceptée en principe. Les premières ADR doivent documenter des décisions déjà établies avant d'introduire de nouvelles conventions.

Condition : ne pas imposer artificiellement « un test ou une migration » lorsqu'une ADR est purement organisationnelle. Une ADR acceptée doit avoir **au moins une preuve d'incarnation pertinente** : test, migration, contrôle CI, outil, invariant vérifiable ou procédure de gate selon sa nature. L'objectif est la vérifiabilité, pas une catégorie de fichier particulière.

## Horizon

APPROVED. La promesse persistante reste :

**La nuit NEXUS travaille. Le matin NEXUS explique. La journée NEXUS accompagne. Frédéric manage.**

Le signal prioritaire de dérive reste l'augmentation de la charge cognitive ou du temps consacré par Frédéric à la construction de NEXUS.

## Démontabilité

APPROVED. Le Governance Core ne doit jamais devenir une dépendance runtime du produit NEXUS en station. L'indisponibilité de l'Orchestrator, d'un Guardian ou de ChatGPT ne doit pas empêcher l'application métier de fonctionner.

## Orchestrator

Architecture cible APPROVED, mais aucune capacité de réveil automatique ne doit être déclarée avant preuve réelle d'un runner externe événementiel.

La première implémentation doit viser le **minimum utile** : supprimer progressivement le rôle de messager de Frédéric, journaliser les transitions, supporter explicitement `session unavailable`, rester idempotente et ne jamais posséder de droit de décision ou de Production.

## Étape suivante autorisée

Le prochain lot peut être ouvert pour le premier chantier réel du Governance Core : **SITE-EXPLICITE-1** (nom libre mais périmètre équivalent).

Avant toute modification applicative, sa première demande doit fournir :
- la cartographie factuelle des defaults de site et des écritures sans `site_id` ;
- les contrats/RLS concernés ;
- le comportement du profil créateur ;
- les tests négatifs multi-site prévus ;
- les avis distincts Architecture, Security & Isolation et QA ;
- le plan de modification par étapes avec rollback ;
- l'impact attendu sur la fiabilité et la future généralisation multi-site.

**Ne pas corriger dans la phase de cartographie.** L'arbitrage doit précéder la modification.

En parallèle, un lot distinct et léger pourra ensuite implémenter le gabarit Handoff pré-rempli et préparer l'Orchestrator, mais il ne doit pas concurrencer le lot « Maintenant » : un seul chantier Maintenant à la fois.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration Production, aucun déploiement Production et aucune modification des données Production ne sont autorisés par cette décision.
