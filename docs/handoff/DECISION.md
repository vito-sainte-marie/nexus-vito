<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SITE-EXPLICITE-1-MUTATION-SITE-GUARD-20260906/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-MUTATION-SITE-GUARD-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Mutation Site Guard

## Verdict

**APPROVED_WITH_CONDITIONS — les deux anomalies UPDATE/DELETE sont considérées fermées en Test. Deux anomalies INSERT deviennent prioritaires avant toute ouverture de la classe D.**

Le lot respecte la gate : contrat global/local explicité, aucune donnée existante réattribuée, aucun privilège élargi, chemins légitimes conservés et cartographie des triggers produite.

## Q46 — contrat global `advisor_rules`

**APPROVED.**

Un manager de site ne doit pas pouvoir créer, modifier ou supprimer une règle globale qui influence plusieurs commerces. Le rôle `manager` exprime une responsabilité locale, pas une portée transverse.

Contrat retenu :
- règle globale (`site_id IS NULL`) : administration uniquement par un mécanisme explicitement transverse et audité ; dans l'état actuel, les migrations constituent ce mécanisme ;
- règle locale : administration uniquement par un acteur autorisé pour ce site ;
- une règle ne change pas de portée globale/local ni de site par mutation ordinaire.

Si une future interface d'administration globale est créée, elle fera l'objet d'un contrat, d'un rôle/capability transverse explicite et d'un lot sécurité dédié. Ne pas réutiliser implicitement le rôle manager ou créateur.

## Q47 — fermer les deux INSERT restants

**APPROVED — priorité immédiate, avant classe D.**

Ouvrir `SITE-EXPLICITE-1-INSERT-SITE-GUARD`, limité à :
1. `advisor_rules.manager_insert_advisor_rules` : un manager ne peut créer qu'une règle locale sur son propre site ; il ne peut créer ni une règle globale ni une règle pour un autre site ;
2. `apprentissage_snapshots.employee_own_snapshot_upsert` : un employé ne peut créer/upsert qu'un snapshot pour lui-même sur son propre site ;
3. chemins légitimes sur le bon site ;
4. preuves comportementales avant/après sous identités réelles ;
5. aucun élargissement de privilège, aucune réattribution de données ;
6. rollback complet.

Pour `advisor_rules`, le contrat INSERT doit être cohérent avec le contrat UPDATE/DELETE déjà retenu : un manager local ne peut pas créer une portée qu'il n'aurait pas le droit d'administrer ensuite.

## Q48 — ADR-0001

**APPROVED_WITH_CONDITIONS — adopter maintenant, avec incarnation automatisée à suivre.**

L'ADR peut passer de PROPOSÉE à ACCEPTÉE avec le principe formulé dans ce lot. Son acceptation documentaire ne signifie pas que le risque de régression est fermé.

Condition : ouvrir ensuite un lot de garde statique/CI qui transforme l'ADR en invariant vérifiable. Le contrôle devra lui-même être testé par mutation et savoir produire `UNKNOWN/REVIEW` lorsqu'il ne sait pas conclure.

L'ADR doit référencer au minimum les occurrences connues qui ont motivé la règle : `mission_progress`, `advisor_rules`, `apprentissage_snapshots`, ainsi que les deux INSERT encore ouverts au moment de son adoption.

## Triggers

La cartographie des trois triggers écrivant le site est acceptée comme état actuel de Test. Leur existence ne doit toutefois pas être interprétée comme une autorisation à généraliser la normalisation par trigger aux classes D/defaults.

## Classe D

**TOUJOURS FERMÉE.**

Après `INSERT-SITE-GUARD`, la prochaine gate devra décider entre :
- construire d'abord la garde statique/CI de l'ADR ;
- ou ouvrir la démonstration Architecture + Security du mécanisme classe D.

Aucun retrait de default, aucune correction des 9 écritures classe D et aucune généralisation de trigger n'est autorisé par cette décision.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-INSERT-SITE-GUARD` en Test uniquement et adopter ADR-0001 conformément aux conditions ci-dessus.

Retour Handoff obligatoire avec policies avant/après, preuves des deux INSERT illégitimes et des chemins légitimes, état ADR, suite, avis Architecture/Security/QA et rollback.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
