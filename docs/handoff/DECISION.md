<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 5
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
---
# Décision — arbitrage technique déterministe de request-6.md

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse à `request-6.md`.

## Motif

Le diagnostic de `request-6.md` est retenu tel quel : la CI rouge de la candidate
(`rebuild/carburants-65-20260922`, run `35805992451`, étape « Cohérence des épingles de cache »)
n'est pas une régression du portage des 7 fichiers, mais une incompatibilité structurelle entre le
workflow legacy de la candidate (`node outils/poser-build-id.js --verifier` appelé directement sur
l'arbre committé brut) et la version post-refonte de `outils/poser-build-id.js` que la candidate a
reçue par ce même portage (blob identique au rail, confirmé par `request-5.md`). Le fait que
`--verifier` échoue aussi sur l'arbre brut du rail lui-même confirme la cause structurelle plutôt
qu'un défaut propre à #65.

## Correctif autorisé

Le patch mécanique déposé au §4 de `request-6.md` est approuvé sans modification : remplacer, dans
`.github/workflows/tests.yml` de la candidate, l'étape `run: node outils/poser-build-id.js
--verifier` par l'exécution de la vraie chaîne (`env` Test explicite + `run: bash outils/build.sh`),
avec les identifiants déjà utilisés 49/49 fois par `test_build_tracabilite_20260905.js` sur le rail
(URL publique du projet Test `nexus-test`, clé anonyme fictive) — aucune valeur nouvelle, aucun
secret réel. Strictement limité à cette étape : aucune logique Carburants, aucun rôle/RLS, aucune
UX, aucune autre extension.

## Transport — condition non remplie, aucune escalade

`request-6.md` classe `transport-patch-canal` en `NOT_APPLICABLE` : écriture de
`.github/workflows/*.yml` hors de portée de cet agent quelle que soit la branche, et écriture Git
vers `rebuild/carburants-65-20260922` refusée par le harnais. Cette décision ne lève aucune de ces
deux limites techniques — elle autorise le contenu du patch, pas un moyen de le transporter que ce
canal n'a pas. Conformément à `decision-4.md`, aucune sollicitation de Frédéric n'est due pour ce
seul blocage de transport : le patch reste déposé dans le registre, prêt à être appliqué par une
session outillée (accès `.github/workflows/*` + écriture sur `rebuild/carburants-65-20260922`).

## Preuves exigées avant toute suite

Une fois le patch effectivement transporté et rejoué : (a) CI verte sur la candidate ; (b) preuve
distincte — pas seulement l'absence d'appel réseau dans `generer-config.js` — que le build
réellement servi cible exclusivement le projet Supabase Test (`udljdqxerrbbbajxubfn`), jamais
Production, avant toute recette navigateur. Les deux conditions restent cumulatives, comme posé par
`decision-3.md`/`decision-4.md`. La candidate n'est toujours pas déclarée prête.

## Interdits absolus

Aucun merge/push Production, aucune migration/écriture Supabase Production, aucun déploiement
Production, aucune promotion Production sans accord explicite de Frédéric, aucune nouvelle règle
métier/UX/RLS/rôle, aucun secret exposé. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le
rail de ce lot.

Retour Créateur uniquement si une vraie gate Production ou une décision métier/sécurité devient
nécessaire — pas pour ce seul obstacle technique de transport, déjà classé.
