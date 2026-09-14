---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-20260905
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Phase 1

## Verdict

**APPROVED_WITH_CONDITIONS — cartographie Phase 1 acceptée et close.**

La cartographie apporte des preuves suffisamment fortes pour autoriser une Phase 2 contrôlée. Les deux comportements observés sous identité employé réelle sont prioritaires : une écriture peut soit échouer hors Sainte-Marie, soit être acceptée sur le mauvais site et devenir invisible au manager légitime. Ce chantier sert directement la fiabilité et la capacité multi-site de NEXUS.

## Q31 — unifier le nom de colonne

**APPROVED : ne pas lancer de renommage transversal des 54 tables.**

Règle retenue : lorsqu'une table ne porte qu'une seule notion de site, son nom historique peut rester `site` ou `site_id`. Lorsqu'une table porte les deux, une source de vérité unique doit être explicitement définie et l'autre valeur doit être dérivée/contrainte.

Condition : cette liberté de nommage ne doit jamais devenir une liberté sémantique. Le contrat de chaque table doit préciser quelle colonne porte l'identité de site et comment elle est validée.

## Q32 — démarrage Phase 2

**APPROVED_WITH_CONDITIONS : commencer par les préconditions de preuve, pas par les corrections.**

Ordre autorisé :

1. Créer uniquement dans **Supabase Test** les comptes/profils de test nécessaires : créateur, pompiste et renfort. Aucun compte Production.
2. Écrire les 7 familles de tests négatifs multi-site et prouver l'état AVANT correction.
3. Éprouver par mutation les détecteurs utilisés pour compter/classer les écritures sans site.
4. Revenir au Handoff avec les résultats avant d'exécuter les corrections structurelles des classes E/D ou le retrait des defaults.

La Phase 2 est donc scindée : **Phase 2A = harnais de preuve**, puis nouvel arbitrage ; **Phase 2B = corrections** seulement après décision.

Les tests doivent distinguer explicitement :
- écriture sans site ;
- écriture avec site erroné ;
- lecture inter-site ;
- créateur autorisé sur un site ;
- créateur refusé sur un site non autorisé ;
- profils ordinaires confinés à leur site ;
- configuration/site absent ou incohérent en fail-closed.

Les tests doivent conserver la preuve du comportement avant correction. Ils ne doivent pas être conçus uniquement pour devenir verts après modification.

## Q33 — écart 58 / 54

**APPROVED : ne pas bloquer Phase 2A sur cet écart.**

La mesure reproductible de Test, **54 colonnes**, est la référence opérationnelle de ce chantier. L'ancien chiffre 58 reste tracé comme valeur historique non reproduite.

Interdiction de consulter ou modifier la Production uniquement pour réconcilier ce chiffre. La différence sera réévaluée lors du futur différentiel Production ↔ Test, sous gate dédiée.

## Priorité de risque

Le cas `pointages` est prioritaire dans la future Phase 2B : une écriture acceptée sur le mauvais site est plus dangereuse qu'une écriture refusée, car elle peut créer une donnée fausse tout en donnant l'apparence d'un fonctionnement normal.

La règle de correction reste : **ne jamais affaiblir la RLS pour faire passer une écriture**. L'identité de site doit être rendue explicite ou normalisée selon un contrat contrôlé.

## Trigger / normalisation

L'orientation « étendre le mécanisme commun plutôt que créer 54 logiques locales » est acceptée comme hypothèse d'architecture, **pas encore comme autorisation d'implémentation générale**.

Avant Phase 2B, Architecture + Security doivent démontrer que le mécanisme commun :
- ne peut pas transformer un site absent en rattachement implicite dangereux ;
- utilise l'identité authentifiée / le contexte autorisé approprié ;
- reste fail-closed en cas d'ambiguïté ;
- ne contourne aucune policy RLS ;
- ne crée pas une dépendance à Sainte-Marie.

## Profil créateur

La branche créateur doit être testée comme une capacité transverse explicite, pas comme un super-utilisateur implicite. Les trois sites actuellement `acces_createur_autorise=true` en Test ne constituent pas une preuve que ce réglage est souhaité métier.

Phase 2A doit tester au minimum un site autorisé et un site refusé. Si les données Test ne permettent pas ce contraste sans modifier une configuration structurante, Claude doit proposer le fixture isolé nécessaire et l'expliquer dans la prochaine demande.

## Edge Functions

L'absence des Edge Functions en Test reste un **angle mort déclaré**. Elle ne bloque pas Phase 2A sur les chemins applicatifs disponibles, mais elle interdit de déclarer le contrat site « exhaustivement sécurisé » tant que les écritures serveur n'ont pas été auditées/testées.

## Gate suivante

Après Phase 2A, déposer une nouvelle demande Handoff contenant :
- identité exacte des fixtures/comptes Test créés, sans secret ni PIN ;
- résultats avant correction des 7 familles de tests ;
- preuves de mutation des détecteurs ;
- matrice table/écriture/risque mise à jour ;
- avis séparés Architecture, Security & Isolation, QA / Regression ;
- proposition précise de Phase 2B, table par table ou groupe cohérent ;
- stratégie de rollback ;
- liste explicite de ce qui reste non couvert, notamment Edge Functions.

**Aucune suppression de default, aucune modification RLS, aucune correction applicative des classes D/E et aucune migration structurelle ne sont autorisées avant ce nouvel arbitrage.**

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** `main` et `production` restent gelées. Aucun compte, aucune donnée, aucune migration, aucune policy et aucun déploiement Production ne sont autorisés par cette décision.
