---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 2
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-2.md
branch: config-par-environnement
---
# Poursuite autonome de la readiness hors Production

Aucun arbitrage Frédéric supplémentaire n'est requis à ce stade. La décision initiale et les invariants existants suffisent pour poursuivre la préparation sans écriture Production.

## 1. Lecture Production : obstacle levé sans nouvelle surface de sécurité

Le NEXUS Orchestrator a utilisé le connecteur Supabase déjà autorisé, sans créer de rôle, secret, jeton ou accès supplémentaire. Une lecture agrégée, strictement non destructive, a mesuré Production et a été enregistrée dans `mesures-production-lecture-seule-1.md`.

Mesures rattachées à la candidate `ba1eed0e833c354f556128dc0ee4b0619725ed1a` :

- 2 sites Production ;
- 0 site qui resterait sans fuseau résoluble après la migration 4 ;
- 17 lignes `shifts` dont `site_id` diverge de `site` ;
- 89 lignes `mission_catalog` dont `site` diverge de `site_id` ;
- 13 services correspondant exactement à la reprise de la migration 6 ;
- 16 services actuellement `en_cours` au moment de la mesure.

Conséquence : la fenêtre mesurée n'est pas une fenêtre sûre de déploiement. Cela ne bloque pas la préparation de la release.

## 2. Rail Handoff

Le correctif de branche `claude/issue-28-20260909-0019` n'est pas livré tant qu'il n'est pas intégré au canon. Repartir du HEAD courant de `config-par-environnement`, comparer fichier par fichier, puis intégrer uniquement les garanties encore nécessaires :

- `outils/handoff.js` : commande `enregistrer-lot` et correctif associé ;
- `test_handoff_enregistrer_lot_20260909.js` ;
- réconciliation de `STATE.json` et des miroirs via l'outil canonique.

Ne pas faire de merge/cherry-pick global aveugle : `config-par-environnement` a reçu depuis le retour Claude les mesures Production et ce cycle Handoff.

## 3. Référentiel Advisor

Le point `seed_referentiel_advisor` reste `INCONNU`. Produire un comparateur SQL strictement en lecture seule qui compare, pour chaque `code` versionné dans la migration, les champs que l'upsert modifierait réellement. Le résultat attendu doit distinguer :

- code absent : `complétée` ;
- code présent et identique : aucun changement matériel ;
- code présent avec au moins un champ différent : `écrasée`, avec uniquement les noms des champs divergents dans le rapport, sans contenu sensible inutile.

Le comparateur doit être exécutable par Orchestrator via l'accès Production existant, sans fournir de secret à Claude.

## 4. Migrations Test/CI

Ne pas ouvrir une gate fondateur maintenant. Pour les migrations 16, 18, 19 et 20, établir d'abord la fermeture de dépendances : qui les consomme, quelles migrations ultérieures en dépendent, et si leur absence de Production ferait échouer ou changer le comportement de la candidate.

Principe de décision déjà canonique : un artefact explicitement Test/CI ne doit pas être promu par défaut en Production. Il n'est retenu que si une dépendance Production démontrée l'exige. Si plusieurs architectures conformes restent réellement possibles après cette analyse, alors seulement remonter l'arbitrage.

## 5. PREPROD anonymisé

Poursuivre la conception sans copier de données personnelles réelles. Produire :

- cartographie table par table des données à conserver structurellement ;
- stratégie d'anonymisation/pseudonymisation ;
- champs à supprimer ou neutraliser ;
- preuve automatique qu'aucune identité, email, téléphone, photo, pièce jointe ou contenu libre sensible non nécessaire ne subsiste ;
- durée de vie et destruction après release ;
- moindre privilège des accès.

Ne pas créer de PREPROD contenant des données personnelles réelles. Ne pas engager de coût ou créer un nouveau projet payant sans la gate requise par l'outil concerné.

## 6. Rollback et réparation en avant

Rédiger le plan formel : rollback code indépendant, migration compensatrice/réparation ciblée pour les données, snapshot global uniquement en dernier recours. Pour chaque migration DML, identifier avant/après, clé de ligne, stratégie de compensation et risque sur les écritures concurrentes.

## 7. Critères `Prêt pour Production` dans NEXUS Live

Ils sont suffisamment déterminables maintenant. L'état ne peut apparaître que si :

1. candidate immuable identifiée ;
2. CI et Guardians requis conformes ;
3. inventaire des migrations complet ;
4. impacts Production mesurés et horodatés après fixation de la candidate ;
5. aucun impact DML restant `INCONNU` ;
6. PREPROD anonymisé ou répétition équivalente conforme avec preuve de confidentialité ;
7. répétition des migrations et recette réussies ;
8. plan de réparation/rollback documenté ;
9. fenêtre de déploiement sûre mesurée au moment de la future gate ;
10. aucun blocage sécurité/architecture/données non résolu.

`Prêt pour Production` signifie seulement que la release peut être soumise à Frédéric. Cela n'autorise jamais Production.

## 8. Gate inchangée

Toujours interdit : écriture Supabase Production, migration Production, push/merge `main` ou `production`, déploiement réel, rollback Production.

Retour Handoff uniquement si un vrai arbitrage non déterministe apparaît ou lorsque le package de readiness est complet pour la gate finale.
