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

Le diagnostic mécanique de `request-6.md` est accepté comme cause réelle, pas comme hypothèse :
trois faits vérifiés indépendamment (workflow legacy de la candidate appelant `--verifier` sans
construire au préalable ; `outils/poser-build-id.js` blob-identique au rail post-refonte, donc
exigeant `nexus-build.js` ; `nexus-build.js` périmé toujours committé sur la candidate) convergent
sur la même conclusion, confirmée par un contre-essai sur le rail lui-même (même échec structurel
sur tout arbre non construit). Ce n'est pas une régression du portage des 7 fichiers de `request-5`,
c'est une incompatibilité pré-existante que ce portage a rendue visible. Le patch mécanique proposé
(`bash outils/build.sh` avec `NEXUS_ENV=test`, l'URL publique déjà citée du projet Test et la clé
anonyme fictive déjà utilisée 49/49 fois par `test_build_tracabilite_20260905.js`) reste dans le
périmètre Test/readiness déjà autorisé par `decision-3.md`/`decision-4.md` : aucune règle métier/UX,
aucune écriture Supabase, aucune promotion Production.

## Poursuite autorisée, sans gate Créateur

Matérialise cette décision via l'outil Handoff canonique, consomme-la, puis applique le patch
**uniquement si ce canal dispose réellement d'un transport sûr** vers les deux surfaces concernées :
l'écriture de `.github/workflows/tests.yml` de la candidate, et l'écriture Git vers la branche
`rebuild/carburants-65-20260922` elle-même. Si l'une ou l'autre reste hors de portée — comme documenté
à plusieurs reprises dans ce lot —, ne contourne pas : consigne précisément le blocage (quelle
surface, pourquoi) et poursuis uniquement les preuves read-only encore disponibles pour #65/#62.

Après un éventuel patch : exiger la CI verte sur la candidate, **puis** une preuve séparée du
`nexus-config.js` réellement servi et du ciblage exclusif Supabase Test avant toute navigation. La
CI verte seule ne suffit jamais à déclarer #65 prête — les deux conditions de `decision-4.md`
(CI verte ET identité/environnement Test-only prouvés) restent cumulatives, pas alternatives.

## Priorité

Continuité terrain et autonomie manager. Pas de refonte générale, pas de gros merge de l'ancien
rail (`rebuild/carburants-65-20260922`) dans le rail canonique, architecture progressive
uniquement — principe inchangé depuis `decision-2.md`/`decision-3.md`/`decision-4.md`.

## Interdits absolus

Aucun merge/push Production, aucune migration/écriture Supabase Production, aucun déploiement
Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun secret exposé, aucune acceptation d'un
risque résiduel matériel. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail de ce lot.
Refs protégées vérifiées avant arbitrage : `main=5b047e0`, `production=2bc7b39`, inchangées.

Retour Créateur uniquement si une vraie gate Production ou une décision métier/sécurité devient
nécessaire — pas pour un obstacle technique déterministe déjà classé.
