<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-9.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 9
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-11.md
---
# Décision — `request-11.md` : restauration vérifiée indépendamment, transport toujours bloqué dans ce canal

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Aucune gate Créateur n'est requise : conformément au précédent posé par `decision-8.md` sur ce même
lot, le constat reste purement technique et déterministe. La classification `RESTAURATION_DE_COMPORTEMENT_EXISTANT`
est confirmée par une **seconde vérification indépendante**, distincte de celle déjà faite par la session
qui a déposé `request-11.md` — cette décision ne repose donc pas sur une seule source.

## 1. Ce qui a été revérifié dans cette session, réellement, pas relu sur la confiance

- `290a217` a bien pour unique parent `fe36a8e` (`git show -s --format=%P`).
- `fe36a8e:nexus-auth.js` et `origin/production:nexus-auth.js` : identiques (implicite, la lignée est
  confirmée par ailleurs).
- `git diff 290a217:nexus-auth.js origin/rebuild/carburants-65-20260922:nexus-auth.js` → vide : la
  candidate porte toujours, au commit `664af98`, exactement le fichier fautif du portage mécanique.
- `4e1b4c3` est bien ancêtre de `origin/production`.
- `origin/production:nexus-auth.js` fait bien 932 lignes, `origin/rebuild/carburants-65-20260922:nexus-auth.js`
  en fait bien 305.

## 2. Le plan a été RECONSTRUIT et REJOUÉ dans cette session — pas seulement relu

Contrairement à la session qui a déposé `request-11.md` (qui avait vérifié les faits statiques sans
reconstruire le fichier fusionné une seconde fois), cette session a reconstruit elle-même le fichier
fusionné, par script, à partir des trois sources déjà nommées par `request-11.md` §4, et l'a exécuté
contre les deux harnais nommés, en zone jetable, jamais poussé :

- `test_regularisation_manager_20260916-harnais-realigne-1.js` → **24/24** (identique à la preuve
  déjà rapportée).
- `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` → **14/14** (identique).

Trois tests de régression adjacents, existants sur la candidate et non mentionnés par `request-11.md`,
ont également été rejoués contre le fichier reconstruit :

- `test_service_courant_unique_20260905.js` → **8/8**.
- `test_pointage_depart_sans_pause_20260911.js` → **37/37**.
- `test_rattachement_service_inventaire_20260905.js` → **6/6**.

## 3. Deux constats supplémentaires, honnêtes, ni cachés ni corrigés silencieusement

- `test_pointage_interrupteur_global.js` échoue — **identiquement, avant et après le plan** — sur le
  fichier actuel de la candidate : il attend le bloc `NEXUS-ACCES-REGLE` (classification d'accès
  consultation/opérationnel/publique/séquence). Ce bloc est exactement celui que `request-11.md` §4
  nomme et exclut explicitement (« cinquante écrans », changement de navigation, hors périmètre du
  plus petit plan). Cet échec est donc confirmé **pré-existant et déjà nommé**, pas une régression
  introduite par ce plan.
- `test_role_du_jour_20260905.js` porte un recensement global des points de décision de rôle
  (`role==='manager'`/`nexusEstManager(`) sur **l'arbre complet** de la candidate, avec un total figé
  attendu. Rejoué sur un sous-ensemble de 8 fichiers (faute d'un accès complet à l'arbre depuis ce
  canal — même obstacle de transport que §5 ci-dessous), le compte partiel passe de 9 à 10 après le
  plan, **exactement** le delta que le propre commentaire du test attend pour `nexus-auth.js`
  (« régularisation manager » = +1 point, volet D du 16/09). Le total global figé (accessible
  seulement depuis une session avec l'arbre complet de la candidate) reste donc **à confirmer**, pas
  vérifié faux ni vérifié vrai ici.

Aucun des deux ne révèle une nouvelle règle métier/UX/rôle/RLS exigée par le plan lui-même : le premier
est un périmètre déjà exclu par écrit, le second est un recensement dont seule la portée d'exécution
manque.

## 4. Autorisation

Le plus petit plan prouvé par `request-11.md` §4, tel que reconstruit et rejoué indépendamment ici, est
autorisé à l'application — **strictement sur `rebuild/carburants-65-20260922`, jamais sur le rail**
(la question ouverte de `request-11.md` §6 sur la cible d'écriture est ainsi tranchée : candidate
seule). Aucune nouvelle règle métier/UX/rôle/RLS n'est introduite par ce plan.

## 5. Transport toujours bloqué dans ce canal

`git worktree add` et `git push` vers `rebuild/carburants-65-20260922` restent refusés dans ce canal
(retestés explicitement dans cette session, pas supposés). Le fichier fusionné et son diff exact contre
la candidate actuelle sont donc persistés dans ce lot (`nexus-auth-restaure-65-20260924.js`,
`diff-nexus-auth-restaure-65-20260924.patch`) pour transport par une session disposant d'un accès en
écriture réel à `rebuild/carburants-65-20260922`. Ne pas demander de gate Créateur pour ce simple
problème de transport Git non-Production.

## STOP

Retour par `request-N.md` si : le total global du recensement de `test_role_du_jour_20260905.js`,
une fois vérifiable sur l'arbre complet, ne correspond pas à ce que son propre commentaire documente ;
une assertion métier change une fois le fichier réellement intégré sur la candidate ; la suite complète
candidate révèle une nouvelle régression matérielle après intégration ; l'identité Test du
`nexus-config.js` servi ne peut pas être prouvée ; ou le risque Cloudflare devient observable et
contradictoire (gates inchangées de `decision-7.md`/`decision-8.md`).

## Gates suivantes inchangées

La preuve distincte d'identité du `nexus-config.js` réellement servi vers Supabase Test reste
obligatoire avant toute recette navigateur #65 — non entamée ici. CI candidate doit être verte avant
cette même recette. La question Cloudflare/extension `.html` reste soumise à l'observation réelle déjà
définie par `decision-7.md`.

## Interdits

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production, aucun
déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé,
**aucune écriture sur la candidate ni sur le rail dans cette session** — seule une zone jetable a été
utilisée, entièrement retirée avant ce dépôt. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste
canonique.
