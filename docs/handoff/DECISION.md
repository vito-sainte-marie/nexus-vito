<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/decision-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 4
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-4.md
branch: config-par-environnement
---
# Poursuite déterministe : exécuter la répétition Test et préparer la gate finale

Aucun arbitrage Frédéric supplémentaire n'est requis. `request-4.md` est conforme aux décisions déjà prises et son travail a été intégré canoniquement par la PR #32, sans divergence (`ahead 2`, `behind 0` avant fusion). La CI du HEAD intégré `2ddd01f56c3df8edc07db51cac8bbcbdf278fc9f` est verte : job `non-regression` terminé en succès, y compris Handoff, Guardians, Bible, Philosophie, règles métier, architecture et simulations. Les étapes nécessitant une connexion Test ont été explicitement `skipped`, donc elles ne constituent pas encore une preuve de répétition.

## 1. Migration 21

L'exclusion est retenue pour cette release. Aucune dépendance fonctionnelle Production à `nexus_live_events` n'est démontrée. Ne pas créer de table ou migration Production pour satisfaire artificiellement une migration Test-only.

## 2. Répétition PREPROD-équivalente

La ressource existante `nexus-test` est retenue comme support de répétition équivalente pour cette release, sous les conditions suivantes :

- aucune donnée personnelle Production n'y est copiée ;
- aucune nouvelle ressource facturable n'est créée ;
- aucune extension de privilège durable n'est accordée pour faciliter la répétition ;
- les comptes et données de recette Test nécessaires sont restaurés ou ressemés de façon déterministe après reconstruction ;
- l'absence de `auth.users` après reconstruction doit être traitée explicitement avant la recette navigateur ;
- la répétition doit exécuter les migrations retenues dans leur ordre réel, puis les tests et la recette sur l'état reconstruit ;
- un échec Test se corrige et se rejoue dans ce lot sans nouvelle gate humaine tant que le périmètre ne change pas.

Utilise en priorité les moyens Test déjà autorisés : outillage du dépôt, secrets Test existants côté CI si accessibles dans un contexte sûr, ou mécanisme équivalent à moindre privilège. Si le canal Claude ne peut matériellement pas exécuter la répétition, ne fabrique pas une preuve : produis le mécanisme exécutable minimal qui permet au rail autorisé de la lancer, sans exposer de secret et sans élargir Production.

## 3. Re-mesures Production

Les requêtes `SELECT` de `re-mesure-finale-gate-1.md` sont validées comme préparation. Ne pas les considérer fraîches avant exécution réelle. L'Orchestrator dispose de l'autorisation de lecture seule Production et les exécutera au plus près de la gate finale.

La mesure de fenêtre doit distinguer :
- services réellement actifs au moment de la gate ;
- services historiques `en_cours` que la migration reprendrait ;
- écritures métier concurrentes récentes pouvant rendre un rollback données destructeur.

## 4. Package de readiness attendu

Poursuis jusqu'à obtenir, avec preuve réelle :

1. répétition des migrations retenues sur `nexus-test` ou preuve technique explicite qu'elle est impossible sans nouvelle ressource ;
2. comptes/données de recette Test disponibles après reconstruction ;
3. suite complète et Guardians sans nouvelle régression ;
4. recette navigateur réelle ;
5. manifeste final de migrations ;
6. plan de réparation en avant et rollback code ;
7. critères `Prêt pour Production` calculés fail-closed ;
8. liste exacte des seules re-mesures Production restant à rafraîchir juste avant la gate.

Ne sollicite Frédéric que si une vraie décision de fondateur apparaît, si une ressource facturable nouvelle devient indispensable, si des données personnelles réelles deviennent nécessaires pour PREPROD, si une contradiction canonique non résoluble apparaît, ou lorsque le package est complet pour la gate finale d'une release précise.

## 5. Gate inchangée

Toujours interdit : écriture ou migration Supabase Production, push/merge `main` ou `production`, déploiement du vrai NEXUS, rollback Production, copie non anonymisée de données Production, ou élargissement de droits Production.

`Prêt pour Production` reste un verdict de préparation et ne vaut jamais autorisation de Production.
