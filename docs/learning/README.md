# NEXUS Learning — mémoire opérationnelle légère

Objectif : faire en sorte que chaque intervention rende les suivantes plus rapides sans charger tous les agents avec tout l'historique.

## Couches

1. **Bible / gouvernance / ADR** : principes et décisions durables.
2. **RULES.json** : règles actives courtes, filtrables par scope/trigger/module/severity.
3. **EXPERIENCE.jsonl** : journal append-only des incidents et apprentissages ; il n'est jamais chargé intégralement dans un prompt normal.
4. **Handoff** : mémoire temporaire du travail en cours.

## Retrieval

Un agent ne lit que ce qui correspond au lot courant. Exemples :
- Carburants : `module=carburants-performance` + security + architecture + qa ;
- Supabase : security + data + environment ;
- UX employé : bible/ux + module concerné.

L'historique brut n'est consulté que pour rechercher une récurrence ou une preuve.

## Promotion de l'expérience

Après chaque lot, Orchestrator vérifie :
- règle durable nouvelle -> `RULES.json` ;
- décision structurante -> ADR ;
- principe produit -> Bible/gouvernance ;
- incident ou apprentissage -> `EXPERIENCE.jsonl` ;
- contexte éphémère -> Handoff uniquement.

Un problème résolu deux fois déclenche une tentative de transformation en règle, test, garde automatique ou runbook avant qu'une troisième analyse humaine identique soit acceptée.

## Coût et dépendances

Version 1 : GitHub + texte versionné uniquement. Pas de base vectorielle, pas d'embeddings, pas de service payant. Une couche d'indexation sémantique ne sera ajoutée que si la taille du corpus rend les filtres structurés insuffisants et si son bénéfice est mesuré.
