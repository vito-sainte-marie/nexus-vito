---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ORCHESTRATION-REPAIR-1-20260907
seq: 1
author: Frederic Bragance / NEXUS Orchestrator
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
---

# Réparer la chaîne automatique NEXUS Orchestrator / Guardians

## Autorisation

Frédéric demande explicitement : « répare tout ça proprement ».

Ce lot est un **lot de gouvernance/CI/outillage purement démontable**, autorisé en parallèle du lot produit Carburants par la Gouvernance Autonome v2 §8. Il ne doit modifier aucun fichier applicatif/métier et ne doit pas changer le contrat fonctionnel du lot Carburants actif.

## Problème confirmé

La gouvernance canonique exige que les Guardians s'exécutent en backend et en parallèle sur les changements pertinents. Or, les outils `outils/guardians-router.js` et `outils/verifier-apprentissage.js` existent uniquement sur la branche Claude `claude/issue-28-20260907-0028` (commit `4ecccc85...`) et sont absents de `config-par-environnement`.

Le workflow canonique `.github/workflows/tests.yml` sur `config-par-environnement` s'exécute déjà à chaque push/PR et constitue le point d'ancrage naturel pour ces contrôles. Il n'a aucun droit d'écriture et ne déploie rien.

Un second défaut distinct demeure : les exécutions Claude déclenchées par `issue_comment` créent encore leurs branches depuis `main`, ce qui produit des branches divergentes. Ce lot **ne modifie pas `main`** et ne prétend donc pas éliminer ce défaut par magie. Il doit au minimum empêcher qu'un travail issu d'une branche stale soit considéré comme intégré sans réapplication sur le HEAD canonique.

## Périmètre exact autorisé

1. Repartir du HEAD courant de `config-par-environnement`.
2. Comparer `4ecccc85` au HEAD canonique et rapatrier **sélectivement** seulement les outils/tests encore utiles :
   - `outils/guardians-router.js` ;
   - `outils/verifier-apprentissage.js` ;
   - tests unitaires associés ;
   - éventuellement `outils/recette-navigateur-test.js` uniquement si toujours cohérent et sans secret.
3. Câbler les contrôles dans `.github/workflows/tests.yml` de `config-par-environnement` :
   - Guardians backend après checkout/setup-node ;
   - vérification apprentissage ;
   - aucun secret ;
   - aucun accès réseau requis ;
   - aucun droit d'écriture ;
   - aucun déploiement.
4. Le routeur doit être **silencieux sans finding** et bloquant uniquement sur finding déterministe correspondant à une règle canonique réellement mécanisable.
5. Le préflight `ENV-001` doit empêcher de considérer une branche Claude stale comme base d'intégration. La CI sur `config-par-environnement` peut évidemment s'exécuter sur son propre HEAD.
6. Ne jamais recopier les anciennes copies stale de Bible, ADR, Rules, Handoff ou gouvernance depuis `4ecccc85` si les versions canoniques sont plus récentes.
7. Ajouter une preuve automatique qu'aucun fichier applicatif n'est modifié par ce lot.
8. Exécuter les tests ciblés puis la régression existante.
9. Produire un rapport distinguant : `réparé automatiquement maintenant` / `reste structurel lié au issue_comment/main`.

## Chaîne cible immédiatement après ce lot

`push/PR sur config-par-environnement`
→ suite de tests
→ Guardians backend par scopes touchés
→ vérification de l'apprentissage
→ silence si propre / échec explicite si finding
→ aucune intervention humaine nominale.

Cette chaîne doit fonctionner indépendamment de NEXUS Live. Live pourra ensuite consommer ses états sans devenir le moteur du workflow.

## Non-objectifs / interdictions

- aucun fichier applicatif ou métier ;
- aucun changement `main` ;
- aucun changement `production` ;
- aucune opération Supabase Production ou NEXUS Production ;
- aucune migration ;
- aucun secret, PIN, token ou `service_role` ;
- aucun cherry-pick/merge aveugle de branche Claude ;
- ne pas mélanger avec la correction Carburants ;
- ne pas déclarer résolu le défaut `issue_comment -> branche depuis main` si ce défaut existe toujours.

## Preuves exigées

- HEAD de départ canonique identifié ;
- diff limité à `.github/workflows/tests.yml`, `outils/`, tests de gouvernance et documentation du lot ;
- tests unitaires Guardians verts ;
- tests intégrité apprentissage verts ;
- démonstration mutationnelle : au moins un finding déterministe fait échouer le contrôle, puis retour au vert après restauration ;
- suite de non-régression sans nouvel échec ;
- aucune valeur de secret journalisée ;
- aucun accès Production ;
- nouveau `request-2.md` canonique avec commits et limites résiduelles.

## Définition de terminé

Le lot est terminé lorsque la branche canonique exécute automatiquement les Guardians backend et la vérification d'apprentissage sur chaque push/PR via son workflow Tests, que les contrôles ont été éprouvés positivement et négativement, et que le défaut structurel des branches Claude issues de `main` est explicitement borné et non confondu avec la chaîne de contrôle réparée.
