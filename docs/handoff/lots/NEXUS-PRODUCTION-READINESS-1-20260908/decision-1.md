---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 1
author: Frédéric Bragance
branch: config-par-environnement
decision: APPROVED
closes: false
---
# Autorisation de lancer la procédure de promotion sécurisée

Frédéric Bragance autorise le lancement de la procédure de promotion du travail validé vers le vrai NEXUS, sous contrôle du rail NEXUS Orchestrator.

## Périmètre autorisé maintenant

- figer une candidate à partir du HEAD canonique validé de `config-par-environnement` au démarrage du lot ;
- auditer Production en lecture seule pour mesurer l'impact réel ;
- inventorier les migrations non encore vues par Production et classifier leurs effets ;
- produire le Production Readiness Report ;
- concevoir et, si les contrôles de confidentialité sont prouvés, préparer un PREPROD anonymisé mais structurellement fidèle à Production ;
- exécuter les répétitions de migrations et recettes hors Production ;
- construire les preuves Guardians, CI, plan de réparation en avant, rollback code et dernier recours base ;
- déterminer une fenêtre de déploiement sûre à partir de l'activité métier réelle ;
- préparer NEXUS Live pour présenter une release précise, ses mesures horodatées et son impact réel.

## Arbitrages déjà tranchés

- PREPROD anonymisé par défaut. Une copie contenant des données personnelles réelles est interdite sans nouvel arbitrage explicite.
- Les impacts sont classés `supprimées`, `écrasées`, `complétées`, `corrigées`.
- Tout chiffre de readiness doit être mesuré, horodaté et rattaché à la candidate. Une mesure antérieure à la candidate ne peut pas autoriser l'affichage `Prêt pour Production`.
- Le rollback code et le rollback données sont distincts. Pour les données, privilégier une migration compensatrice ou une réparation ciblée ; une restauration globale n'est qu'un dernier recours car elle peut perdre des écritures métier postérieures au déploiement.
- Si l'activité métier en cours rend le rollback destructeur ou augmente fortement le risque, NEXUS doit refuser ou déconseiller la fenêtre de déploiement.
- En cas d'information manquante, le verdict est `INCONNU`, jamais `CONFORME`.

## Gate Production maintenue

Cette décision **n'autorise pas encore** :

- une écriture dans Supabase Production ;
- un merge ou push sur `production` ou `main` ;
- un déploiement du vrai NEXUS ;
- une migration Production ;
- un rollback Production.

Lorsque le rapport de readiness est complet et les preuves conformes, le rail doit revenir avec une proposition de release précise. Le passage effectif en Production restera soumis à une autorisation finale explicite de Frédéric pour cette release et cet impact.

## Continuité du rail

Avant d'ouvrir ce lot, le rail doit d'abord consommer proprement `decision-3.md` du lot `NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908` et réconcilier `STATE.json`, actuellement en retard sur ce fichier. Aucun deuxième lot actif ne doit être fabriqué silencieusement.
