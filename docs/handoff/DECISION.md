<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SITE-EXPLICITE-1-INSERT-SITE-GUARD-20260906/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SITE-EXPLICITE-1-INSERT-SITE-GUARD-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---

# Décision — SITE-EXPLICITE-1 Insert Site Guard

## Verdict

**APPROVED_WITH_CONDITIONS — les deux anomalies INSERT sont considérées fermées en Test. ADR-0001 acceptée. La garde statique devient la prochaine étape obligatoire avant la classe D.**

Le contrat est désormais cohérent sur les trois faces INSERT / UPDATE / DELETE pour les occurrences traitées : un acteur local ne peut créer ni administrer une portée qu'il n'est pas autorisé à gouverner.

## Q49 — garde statique ou classe D

**GARDE STATIQUE D'ABORD. APPROVED.**

Ouvrir un lot `SITE-EXPLICITE-1-STATIC-SITE-GUARD` avant toute ouverture de la classe D.

L'objectif n'est pas de créer un nouveau scanner spectaculaire. Il est de transformer ADR-0001 en invariant automatisé suffisamment fiable pour empêcher la réintroduction du motif « acteur contrôlé, portée oubliée » pendant les futurs changements.

## Contrat minimal de la garde

La garde doit couvrir au minimum les policies `INSERT`, `UPDATE` et `DELETE` sur les tables portant une portée `site`/`site_id` et :

1. raisonner sur le contrôle effectif de la nouvelle ligne, notamment `coalesce(with_check, using)` pour UPDATE ;
2. reconnaître les formes de contrôle de portée déjà observées sans se limiter à une recherche naïve de chaîne ;
3. distinguer explicitement les données globales (`site_id IS NULL`) des données locales ;
4. distinguer tables sans portée site, archives et cas réellement `NOT_APPLICABLE` ;
5. produire `UNKNOWN/REVIEW` quand l'analyse ne permet pas une conclusion fiable ;
6. ne jamais classer `SAFE` uniquement parce qu'une policy refuse tout ;
7. vérifier la cohérence des faces INSERT/UPDATE/DELETE lorsqu'elles portent le même contrat métier ;
8. détecter le motif rôle/auteur contrôlé mais site/portée non contrôlé ;
9. inclure les exceptions dans un registre explicite, justifié et révisable plutôt que dans des exclusions silencieuses.

## Test du contrôleur

**Obligatoire avant promotion CI.**

Le classificateur doit être testé par mutation avec au minimum des fixtures représentant :
- policy sûre par fonction de site ;
- policy sûre par sous-requête employé/site ;
- policy vulnérable rôle seul ;
- policy vulnérable auteur seul ;
- UPDATE avec `USING` sans `WITH CHECK` mais garde effective ;
- donnée globale légitime ;
- archive / NOT_APPLICABLE ;
- cas volontairement ambigu devant retourner `UNKNOWN/REVIEW`.

Les six occurrences historiques d'ADR-0001 doivent servir de corpus de régression lorsque possible.

## CI

La garde peut devenir bloquante dans la CI uniquement lorsque ses tests propres sont verts et que ses résultats sur l'état actuel ont été revus par Architecture, Security & Isolation et QA.

Elle ne doit nécessiter aucun secret Production. Si une interrogation de schéma vivant est nécessaire, le lot doit proposer séparément le mode d'exécution reproductible/éphémère ou Test et son modèle de secrets avant de l'activer dans GitHub Actions.

Une première version statique basée sur les migrations/schema versionnés est préférable si elle permet une preuve suffisante et reproductible.

## Limite importante

La garde statique n'a pas vocation à « prouver toute la sécurité RLS ». Elle protège un invariant précis issu d'ADR-0001. Les preuves comportementales adversariales restent nécessaires pour les chemins à risque et les changements sensibles.

## Classe D

**TOUJOURS FERMÉE.**

Elle ne pourra revenir à l'arbitrage qu'après :
- garde statique testée ;
- résultats sur l'état actuel expliqués, faux positifs/UNKNOWN traités explicitement ;
- avis séparés Architecture/Security/QA ;
- proposition du contrat de normalisation/fail-closed pour les 9 écritures classe D et les defaults concernés.

Aucun retrait de default, aucune correction classe D et aucune généralisation de trigger n'est autorisé par cette décision.

## Gate suivante

Claude peut exécuter `SITE-EXPLICITE-1-STATIC-SITE-GUARD` en Test / code de gouvernance uniquement.

Retour Handoff attendu avec : conception de la garde, corpus de mutation, résultats exacts SAFE/VULNERABLE/UNKNOWN/NOT_APPLICABLE, traitement des exceptions, mode CI proposé ou activé selon preuves, avis Architecture/Security/QA, impact sur temps de CI et rollback/désactivation.

## Gate Production

**AUCUNE AUTORISATION PRODUCTION.** Aucun merge `main`/`production`, aucune migration, policy, donnée ou configuration Production n'est autorisé.
