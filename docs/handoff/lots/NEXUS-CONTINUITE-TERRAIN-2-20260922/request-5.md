---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: refs-protegees
    classe: VERIFIED
    valeur: deja pose par l'outil
  - id: portage-execute
    classe: VERIFIED
    valeur: commit 290a217 confirme, message et 7 fichiers identiques aux commandes de preuve-cloudflare-humaine-65-portage-1.md paragraphe 6
  - id: cause-non-regression
    classe: VERIFIED
    valeur: test_migrations_immuables_20260905.js absent de 290a217 et de fe36a8e, Cannot find module reproduit en repertoire jetable, echec avant meme run-tests.js
  - id: regression-portage-nexus-auth
    classe: VERIFIED
    valeur: comparaison A/B reelle fe36a8e vs 290a217 sur les 224 tests propres a la branche: 217/224 puis 198/224, 19 nouveaux echecs
  - id: isolation-supabase-test-apres-portage
    classe: NOT_APPLICABLE
    valeur: aucun acces Cloudflare/Supabase Test depuis ce canal, aucune tentative reseau
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32 lots conformes
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Cause réelle isolée pour `non-regression` FAILURE sur `290a217` — rattrapage de `request-4.md`

Réponse au réveil du 23/09/2026 (issue #28) signalant les 3 checks GitHub désormais présents sur
`rebuild/carburants-65-20260922` @ `290a217f0f07d4f408469bc9cb8239814544f092` (Cloudflare Pages
SUCCESS, Supabase Preview SKIPPED, `non-regression` FAILURE, job `107006854451`). Ces faits rendent
effectivement obsolète la prémisse de `request-4.md` (« transport/build restent non exécutés ») :
le portage a bien été exécuté, hors de ce canal, exactement selon les commandes documentées dans
`preuve-cloudflare-humaine-65-portage-1.md` §6. Ce document ne remplace pas `request-4.md` (registre
append-only) : il le complète avec l'état désormais réel.

Analyse complète : `analyse-echec-non-regression-65-290a217-1.md` (ce lot). Résumé :

## 1. Cause déterministe du `FAILURE`, reconstruite et rejouée (pas lue — le job GitHub réel reste
inaccessible depuis ce canal : `gh auth status`/`curl`/`git fetch` tous refusés, confirmé par
tentative réelle, cohérent avec tout ce fil depuis le 06/09/2026)

`rebuild/carburants-65-20260922` descend de `production`, pas du rail où vit `.github/workflows/tests.yml`.
La toute première étape du job qui exécute un script par son nom (« Immuabilité des migrations déjà
en production », `node test_migrations_immuables_20260905.js`) échoue avec `Cannot find module` :
ce fichier — comme la quasi-totalité de l'outillage QA/ENV-001/Handoff/Guardians invoqué plus loin
dans le job — n'existe pas sur cette branche, ni avant ni après le portage (vérifié fichier par
fichier). **Le job meurt à cette étape ; `run-tests.js` (l'étape qui porte le nom « non-régression »)
ne s'exécute jamais dans ce run.** Ceci n'est pas imputable au portage : les 7 fichiers ported ne
touchent ni aux tests, ni à `docs/`. C'est une propriété structurelle de l'ancienneté de cette
branche, désormais visible parce que `tests.yml` s'exécute sur `branches: ['**']`.

## 2. Un second fait réel, distinct, trouvé en le cherchant : régression fonctionnelle mesurée du
portage lui-même (comparaison A/B contrôlée, exécution réelle en répertoires jetables)

La propre suite de tests de la branche #65 (224 fichiers `test_*.js` à sa racine) passe 217/224
avant le portage (`fe36a8e`) et 198/224 après (`290a217`) — **19 nouveaux échecs**, tous tracés à
la disparition de fonctions/blocs de `nexus-auth.js` (`nexusEstManager`, `nexusFuseauSite`, blocs
« règle d'accès »/« jour métier »/`NEXUS-FUSEAU-METIER`, développés après la refonte du 04/09 sur
des branches sœurs indépendantes de #65, jamais reversés dans le `nexus-auth.js` du rail) et, pour
une partie, à la garde de démarrage `nexus-config.js` du nouveau `nexus-auth.js` (comportement
fail-closed voulu, mais qui suppose le build déjà exécuté). Détail complet, table des 19 fichiers,
et les 7 échecs pré-existants distingués (non touchés par ce portage) : `analyse-echec-non-regression-65-290a217-1.md` §2.

Cette régression n'a PAS été corrigée : la réparer demanderait de réintroduire du code métier dans
`nexus-auth.js` ou d'arbitrer la réconciliation des branches sœurs avec la refonte — hors du
périmètre mécanique déjà autorisé (`decision-2.md`/`decision-3.md`), et potentiellement une
nouvelle règle métier/UX, explicitement interdite.

## 3. Isolation Supabase Test du preview — toujours non prouvée

Le succès Cloudflare prouve seulement build+deploy réussis (cohérence interne de
`generer-config.js` entre `NEXUS_ENV` et l'URL, dans les deux sens — test→Test OU
production→Production sont également possibles). `Supabase Preview: SKIPPED` est une intégration
différente (Supabase Branching), sans rapport avec les variables Cloudflare Pages : ce n'est ni une
preuve pour ni contre l'isolation. Aucune lecture réseau du preview n'a été tentée (interdit tant
que l'absence de contact Production n'est pas prouvée) : le point reste `NOT_APPLICABLE` depuis ce
canal, inchangé depuis `etude-isolation-test-candidats-web-1.md`.

## Ce qui reste inchangé

Gate « GO Production #65 » : `NO GO temporaire`, inchangée. Aucune recette navigateur lancée.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucune nouvelle règle métier/UX, aucun élargissement sécurité/rôle,
PR #65 et `rebuild/carburants-65-20260922` non modifiées, aucun contournement des restrictions
d'écriture de ce canal.
