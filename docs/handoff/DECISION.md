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
# Décision — diagnostic CI candidate accepté, patch mécanique hors de portée du canal

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Le diagnostic de `request-6.md` est accepté comme mécanique. Il ne porte aucun choix métier,
UX, RLS ou de rôle : le workflow legacy de la candidate (`rebuild/carburants-65-20260922`)
appelle `outils/poser-build-id.js --verifier` directement sur l'arbre committé, sans jamais
lancer `outils/build.sh` avant. Cette version de `poser-build-id.js`, portée par le portage des
7 fichiers, exige un `nexus-build.js` fraîchement recalculé ; la candidate en porte encore un
committé et périmé (`id: '20260904-0104'`). L'échec est donc déterministe, reproductible sur le
rail lui-même sur arbre non construit, et n'est pas une régression introduite par le portage.
Aucun arbitrage Créateur n'est requis pour ce correctif CI Test-only.

## Ce qui est confirmé, sans nouvelle mesure

Les trois faits de `request-6.md` §2 (workflow legacy, `poser-build-id.js` post-refonte
blob-identique au rail, `nexus-build.js` périmé committé sur la candidate) sont tenus pour
acquis. Aucune nouvelle preuve n'est exigée pour ce point précis : la même conclusion vaut que
l'échec porte sur « absent » (rail) ou sur « id périmé » (candidate), les deux branches menant à
la même cause racine et au même `process.exit(1)`.

## Patch mécanique — transport confirmé hors de portée de ce canal

Le patch minimal exposé par `request-6.md` §4 (remplacer l'étape « Cohérence des épingles de
cache » par un `bash outils/build.sh` ciblant le vrai projet Supabase Test avec une clé anonyme
fictive déjà éprouvée 49/49) est retenu tel quel, sans modification de fond. Deux obstacles de
transport, distincts et déjà documentés, sont confirmés inchangés dans ce canal :

1. `.github/workflows/*.yml` n'est modifiable par aucun agent Claude sur ce canal, quelle que
   soit la branche — restriction d'outillage, pas un choix de portée.
2. L'écriture Git vers `rebuild/carburants-65-20260922` reste hors d'atteinte de cette session,
   qui ne peut pousser que sur sa propre branche de travail.

Conformément à `decision-4.md`, ce blocage de transport est consigné sans nouvelle sollicitation
de Frédéric : c'est un obstacle technique de canal, pas une question qui appelle un arbitrage.
Le patch reste déposé, prêt à être appliqué par une session outillée disposant d'un accès direct
à `rebuild/carburants-65-20260922` et du droit d'édition sur `.github/workflows/*.yml`.

## Ce que ceci n'autorise toujours pas

`Prêt pour Production` ne se déduit jamais d'une CI verte seule. Même une fois ce patch appliqué
et le run rejoué au vert, deux preuves restent dues avant toute recette navigateur de #65 :
le `nexus-config.js` réellement servi par la candidate déployée, et son ciblage exclusif du
projet Supabase Test (`etude-isolation-test-candidats-web-1.md` §4, faits n°2 et n°3, toujours
non mesurés). La candidate #65 n'est pas déclarée prête par cette décision.

## Invariants

Aucun changement `main`/`production`, aucune opération Supabase Production, aucune migration ou
écriture Supabase Production, aucun déploiement ni promotion Production, aucun secret créé ou
exposé, aucune nouvelle règle métier/UX/RLS/rôle, PR #65 non modifiée.

Le lot reste ouvert : le patch de transport et les deux preuves de ciblage Supabase Test restent
dus avant toute clôture.
