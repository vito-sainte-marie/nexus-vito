<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-10.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 10
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-16.md
---
# Décision — `request-16.md` : attribution CI acceptée (GO Créateur)

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric valide l'attribution causale établie par `request-16.md` pour les 12 échecs de la suite
candidate (commit `1ba8b88`, run `35995316868`, job `non-regression` #107618732366) : aucun n'est
une régression nouvelle imputable au périmètre propre de `#65` (les deux harnais réalignés
transportés par `1ba8b88` et la restauration minimale autorisée par `decision-9.md` §1).

## 1. Réponse aux trois questions d'arbitrage de `request-16.md` §8

1. **Oui.** Le classement des 12 échecs est retenu : 7 dette QA préexistante du rail
   (`docs/qa/ECHECS-CONNUS.json`, causes déjà nommées, sans rapport avec `nexus-auth.js`) ; 4
   tracés au gap de classification d'accès/navigation, réel mais déjà nommé par `request-11.md`
   §4/§6 et explicitement exclu du périmètre de restauration par `decision-9.md` §2 — ce gap
   préexistait au portage `290a217`, le rail ne l'a jamais eu ; 1 (`test_gravite_ecart_source_
   unique_20260916.js`) réexécuté isolément avec ses dépendances exactes du candidat, 31/31, non
   attribué à `#65` en l'absence de preuve contraire.
2. **Oui.** La boucle d'attribution CI propre au périmètre `#65` (harnais transportés + restau-
   ration minimale) est considérée **close sur ce point précis** — sans que cela déclare la suite
   candidate globale verte, et sans que cela vaille `GO` Production. Le lot racine distinct pour la
   dette de classification d'accès (`proposition-lot-classification-acces-rail-1.md`) sera ouvert
   après clôture complète de `#65`, séquencé, pas immédiatement.
3. **Oui.** La recette navigateur authentifiée reste le seul geste bloquant restant avant tout
   `GO`, et reste réservée à une session disposant réellement des secrets Test — cette clôture
   d'attribution CI ne la remplace ni ne la contourne.

Aucune de ces dettes (QA, classification d'accès, réexécution isolée) n'est masquée, supprimée ou
rendue artificiellement verte par cette décision : elles restent inscrites, sourcées, et non
résolues par ce lot.

## 2. Ce que cette décision n'affirme PAS

Elle ne déclare pas la CI candidate verte au sens de `decision-9.md` §4 (le job `non-regression`
reste littéralement rouge sur `1ba8b88`, faute d'une liste `ECHECS-CONNUS` mise à jour côté
candidat — hors périmètre de ce lot). Elle ne clôt pas `#65` : les gates d'isolation Supabase Test
des candidats web, de preuve de création réelle de la migration `#65`, et de dérive de schéma
Supabase Test, recensées par `classement-gates-etat-git-62-65-1.md` §2, restent ouvertes et
inchangées par cette décision.

## 3. Suite autorisée

1. Poursuivre les preuves déterministes restantes de `#65` disponibles sans secret ni accès
   Production.
2. Rechercher une voie d'exécution déjà prévue par l'infrastructure pour la recette navigateur
   authentifiée (workflow/environnement Test avec secrets déjà protégés), sans lire, exposer,
   copier ni demander la valeur d'un PIN. Si une telle voie est atteignable depuis la session en
   cours, l'emprunter. Sinon, STOP et documenter précisément le geste minimal requis — pas de
   nouveau mécanisme, pas de nouvelle garde, pas de contournement de sécurité.
3. Si — et seulement si — toutes les gates de `#65` (attribution CI, recette navigateur, isolation
   Test, preuve de migration, dérive de schéma) deviennent closes dans une même session outillée,
   préparer le dossier de gate Production puis STOP pour `GO` explicite de Frédéric.
4. Une fois le verdict complet de `#65` rendu (pas avant), enchaîner sur le lot racine distinct déjà
   préparé pour la dette de classification d'accès/harnais.

## Interdits

Aucun merge ni déploiement Production, aucune écriture ni migration Supabase Production, aucun
changement métier/UX/rôle/RLS/sécurité, aucun secret exposé, aucune baisse de gate.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
