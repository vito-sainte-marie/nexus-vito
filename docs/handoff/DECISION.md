<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-8.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 8
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-9.md
---
# Décision — `request-9.md` : correctif obsolète écarté, harnais réaligné sur le runtime

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Aucune gate Créateur n'est requise : le constat est purement technique et déterministe. Il ne modifie aucune règle métier, UX, rôle, RLS ou donnée.

## 1. `nexus-auth-corrige-65-20260923.js` — NE PAS TRANSPORTER

La revérification de `request-9.md` établit que le `nexus-auth.js` actuel de la candidate est déjà octet pour octet identique à celui du rail canonique et porte les gardes `NEXUS_CONFIG`, `NexusBuild` et `NexusPage`. Copier le correctif construit depuis `fe36a8e` supprimerait des gardes déjà présentes : ce serait une régression.

Le point « correctif nexus-auth » est donc clos sans code supplémentaire. Ne pas restaurer une version historique pour faire passer les tests.

## 2. Les deux harnais — réaligner le banc sur les préconditions réelles du runtime

Autorisé sur la candidate non-Production : adapter uniquement `test_regularisation_manager_20260916.js` et `test_cloture_services_obsoletes_20260916.js` afin que leur contexte `vm` fournisse les dépendances désormais obligatoires de `nexus-auth.js`.

Principe imposé : **le harnais s'adapte au contrat runtime ; le code applicatif ne s'adapte pas au harnais**.

- conserver l'ajout `window.NEXUS_CONFIG` déjà autorisé ;
- pour `NexusPage`, charger/exécuter le vrai `nexus-page.js` committé de la candidate lorsque le harnais exerce une logique où l'identité de page peut influer sur le résultat ; ne pas réinventer cette logique dans un stub ;
- pour `NexusBuild.versionner`, un stub minimal d'identité est autorisé dans le seul contexte `vm` si et seulement si les assertions du test ne portent ni sur la génération du build-id ni sur le versionnement d'URL. Dans ce cas le stub doit être explicitement local au harnais et documenté comme dépendance d'infrastructure neutralisée ;
- si une assertion du harnais dépend réellement du build/versionnement, STOP : utiliser alors l'artefact généré par la chaîne de build dans une zone temporaire, sans committer `nexus-build.js` généré.

Interdit : modifier `nexus-auth.js`, affaiblir une garde fail-closed, changer une assertion métier pour obtenir du vert, ou committer un artefact `nexus-build.js` généré.

## 3. Preuve exigée après adaptation

Exécuter réellement les deux harnais sur l'arbre candidate actuel. Ils doivent atteindre leurs assertions métier et non simplement franchir le chargement de `nexus-auth.js`.

Ensuite seulement, exécuter la suite candidate complète et rapporter le total mesuré. Aucun ancien total ne doit être repris comme preuve.

Toute nouvelle régression par rapport au baseline connu doit être classée par cause avant poursuite. Aucun élargissement opportuniste.

## 4. Gates suivantes inchangées

La preuve distincte d'identité du `nexus-config.js` réellement servi vers Supabase Test reste obligatoire avant recette navigateur. La question Cloudflare/extension `.html` reste soumise à l'observation réelle déjà définie par `decision-7.md` ; aucune correction préventive n'est autorisée.

## 5. Transport

Si l'écriture directe sur `rebuild/carburants-65-20260922` reste techniquement interdite au canal Claude, préparer le diff exact et les preuves sur une branche de travail persistante puis revenir au rail. Ne pas demander une gate Créateur pour un simple problème de transport Git non-Production.

## STOP

Retour par `request-N.md` si : les harnais échouent encore après fourniture correcte des dépendances runtime ; une assertion métier change ; la suite complète révèle une nouvelle régression matérielle ; l'identité Test ne peut pas être prouvée ; ou le risque Cloudflare devient observable et contradictoire.

## Interdits

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production, aucun déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
