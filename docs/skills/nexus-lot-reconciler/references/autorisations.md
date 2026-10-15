# Autorisations

Une autorisation porte sur **une action, un objet, un environnement**. Elle est matérialisée sur le rail (décision de l'arbitre) ou donnée explicitement par Frédéric. Une autorisation de fermer une issue ne permet ni de supprimer sa branche ni de fusionner sa PR.

## Autorisé sans validation (mode audit)

Lire les sources, comparer, produire un rapport, identifier les doublons, proposer des clôtures, préparer des commentaires (sans les publier), construire un plan, écrire des fichiers de preuve locaux non publiés.

## Qui autorise quoi

| Action | Autorité |
| --- | --- |
| Fermer une issue | arbitre (décision sur le rail) |
| Fermer une PR | arbitre |
| Consommer ou archiver une demande Handoff | arbitre |
| Modifier `STATE.json` | arbitre |
| Déplacer un fichier | arbitre |
| Modifier un manifeste canonique (`CANAUX.json`, `CAPACITES-CANAL.json`, `AUTORITES-DE-BRANCHE.json`…) | Frédéric |
| Supprimer un fichier | Frédéric |
| Supprimer une branche | Frédéric |
| Fusionner une PR | Frédéric |
| Modifier une migration | Frédéric |
| Écrire dans Supabase | Frédéric |
| Modifier un workflow d'orchestration | Frédéric |
| Déployer | Frédéric |

Le script applique cette table (`AUTORITE_PAR_ACTION`, `autoriser`). Une action absente de la table est refusée.

## Interdictions permanentes

- Effacer l'historique des décisions (le rail est en ajout seul).
- Supprimer une migration appliquée sans procédure de réconciliation approuvée.
- Modifier Production sans autorisation dédiée.
- Contourner les Guardians.
- Supprimer un canal Handoff encore utilisé (issue #28, PR #30 tant que `CANAUX.json` les déclare).
- Traiter `CLOSES:true` comme une autorisation de fermeture GitHub.
- Modifier une branche protégée pour faire disparaître une anomalie documentaire.

## Avant toute écriture autorisée

Revérifier tête, état et dépendances de l'objet (`verifierAvantEcriture`). Au moindre écart avec l'audit, suspendre et redemander l'arbitrage.
