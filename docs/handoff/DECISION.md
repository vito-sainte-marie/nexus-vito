<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 3
author: NEXUS Orchestrator
decision: APPROVED
closes: false
in_reply_to: request-3.md
branch: config-par-environnement
---
# Poursuite déterministe vers un package de readiness complet

Aucun arbitrage Frédéric supplémentaire n'est requis à ce stade. Le retour `request-3.md`, les preuves canoniques et l'autorisation initiale permettent de poursuivre hors Production.

## 1. Référentiel Advisor : inconnu fermé par mesure Production

Le comparateur en lecture seule préparé dans ce lot a été exécuté par l'Orchestrator via le connecteur Supabase déjà autorisé. Aucun rôle, secret, jeton ou accès supplémentaire n'a été créé et aucune écriture Production n'a été faite.

Résultat rattaché à la candidate `ba1eed0e833c354f556128dc0ee4b0619725ed1a` :

- `nexus_language_templates` : 0 complétée, 0 écrasée, 6 identiques sur 6 ;
- `advisor_rules` : 0 complétée, 0 écrasée, 31 identiques sur 31.

La migration `20260905161500_seed_referentiel_advisor.sql` est donc un no-op matériel sur l'état Production mesuré. La preuve est enregistrée dans `mesures-advisor-production-lecture-seule-1.md` et devra être rafraîchie avant la gate finale si nécessaire.

## 2. Manifeste des migrations

La fermeture de dépendances de `request-3.md` est retenue :

- migrations 16, 18, 19 et 20 : exclues de la release Production par défaut car explicitement Test/CI et sans dépendance Production démontrée ;
- migration 21 : exclue et bloquée tant qu'aucune table `nexus_live_events` de portée Production n'existe. Ne pas promouvoir la migration Test 18 uniquement pour rendre la 21 applicable.

Vérifier maintenant si le code applicatif de la candidate exige réellement `nexus_live_events` en Production. S'il n'existe aucune dépendance fonctionnelle Production, matérialiser l'exclusion permanente de 21 pour cette release. Si une dépendance Production est démontrée, proposer une migration Production dédiée et minimale, sans l'appliquer.

## 3. PREPROD anonymisé

Poursuivre sans données personnelles réelles. Vérifier d'abord si les ressources Test déjà existantes permettent une répétition équivalente sans créer de projet ou branche payante.

Ne pas créer une nouvelle ressource facturable sans la gate de coût prévue par l'outil. Si aucune ressource existante ne peut fournir la preuve nécessaire, retourner uniquement avec le besoin exact de ressource et son coût vérifiable.

La preuve PREPROD doit rester fail-closed : `INCONNU` tant que construction, anti-fuite et répétition ne sont pas réellement exécutées.

## 4. Suite de la préparation

Dans le périmètre hors Production :

1. finaliser le manifeste de release en tenant compte de la mesure Advisor ;
2. produire les scripts ou procédures exécutables de construction/anonymisation PREPROD sans données personnelles ;
3. répéter les migrations retenues et la recette sur une ressource autorisée dès qu'elle existe ;
4. vérifier les critères `Prêt pour Production` avec preuves réelles, pas déclaratives ;
5. préparer les requêtes de re-mesure finale des impacts DML et de l'activité métier ;
6. conserver le rollback code séparé de la réparation en avant des données ;
7. revenir par Handoff uniquement si une vraie décision non déterministe apparaît ou lorsque le package est complet pour la gate finale Frédéric.

## 5. Gate inchangée

Toujours interdit : toute écriture Supabase Production, migration Production, push ou merge vers `main` ou `production`, déploiement du vrai NEXUS, rollback Production, ou PREPROD contenant des données personnelles réelles.

`Prêt pour Production` reste un verdict de préparation. Il ne vaut jamais autorisation de Production.