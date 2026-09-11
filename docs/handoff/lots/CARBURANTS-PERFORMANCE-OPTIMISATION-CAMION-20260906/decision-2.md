---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 2
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---

# Décision — accepter le correctif déterministe, réintégrer sur le HEAD canonique et prouver sur NEXUS Test

Le `request-2.md` produit par Claude sur `claude/issue-28-20260907-1128` a été recopié à l'identique dans le Handoff canonique avant cet arbitrage. La branche Claude est divergente de `config-par-environnement` et ne constitue donc pas, à elle seule, une intégration.

## A — Correctif moteur hors fichier littéralement nommé par decision-1

**Accepté dans le même lot.**

Le changement de deux lignes dans `nexus-carburant-commande-moteur.js` est un correctif déterministe découvert en exécutant exactement la preuve de traversée P0 demandée par `decision-1.md`. Il ne crée aucune nouvelle règle métier, n'élargit pas le domaine fonctionnel et ne déplace pas la vérité hors du moteur. Au contraire, sans ce correctif, la sortie `reliquatArrondi` demandée par la décision ne peut pas être produite avec la structure réelle des évaluations.

Cette situation relève de `QA-001` : Claude corrige et reteste un défaut local dans l'objectif autorisé sans ouvrir un nouveau lot. L'écart de fichier est matériellement signalé et reste limité à la lecture de `stockPrevuLivraisonL` depuis `scenarioMaintenant` avec repli rétrocompatible ; aucun autre changement moteur n'est autorisé par cette décision.

## B — Intégration canonique

La branche `claude/issue-28-20260907-1128` est issue de `main` et diverge fortement du HEAD canonique. **Aucun merge, cherry-pick ou copie globale de cette branche n'est autorisé.**

À partir du HEAD courant de `config-par-environnement`, réappliquer uniquement le delta utile déjà écrit et prouvé par Claude :

1. dans `nexus-carburant-commande-moteur.js`, le correctif minimal de la phase `reliquatArrondi` qui utilise `ev.scenarioMaintenant.stockPrevuLivraisonL` avec le repli `ev.stockPrevuLivraisonL` ;
2. ajouter `test_carburant_commande_p0_traversee_reliquat_20260907.js` ;
3. ne recopier aucun autre fichier applicatif ou workflow depuis la branche Claude, sauf preuve qu'il diffère réellement du HEAD canonique et qu'une nouvelle décision l'autorise.

Le moteur reste propriétaire unique de la recommandation. `nexus-carburants-p0-fixes.js` et l'UI relaient la vérité sans recalcul parallèle.

## C — Preuves exigées sur le HEAD canonique

Avant toute recette UI :

- confirmer le HEAD de départ de `config-par-environnement` ;
- montrer le diff réel : uniquement le correctif moteur minimal + le nouveau test + artefacts Handoff nécessaires ;
- exécuter le test de contrat P0 : 35 000 → 36 000 L quand sûr et absorbable, et au moins un refus motivé ;
- démontrer que le nouveau test échoue lorsque le correctif est retiré puis repasse au vert après restauration ;
- exécuter la suite Carburants et la régression pertinente ; aucun nouvel échec imputable au lot ;
- confirmer que `nexus-carburants-p0-fixes.js` ne reconstruit pas `reliquatArrondi` ;
- confirmer aucune heure de livraison inventée et aucune double intégration d'une livraison.

## D — Preuve UI / navigateur

La preuve UI reste obligatoire avant clôture, conformément à `decision-1.md`. Elle doit être déléguée à Claude / une session outillée NEXUS Test, pas à Frédéric tant qu'une preuve automatisable peut être produite.

Ordre obligatoire :

1. intégrer d'abord le correctif sur `config-par-environnement` ;
2. déployer/servir cette version sur NEXUS Test par le rail Test autorisé ;
3. seulement ensuite exécuter la recette navigateur avec les identifiants Test fournis de manière sûre.

Preuves UI attendues :

- cas sûr et absorbable : recommandation visible à 36 000 L ;
- cas réellement limité : volume inférieur conservé avec motif cohérent ;
- CTA cohérent avec la recommandation moteur ;
- aucune heure de livraison inventée ;
- aucune double intégration d'une livraison ;
- aucun accès Production.

Si le déploiement Test ou le navigateur est réellement indisponible, le point reste explicitement `HUMAN`/non satisfait et le lot reste ouvert. Ne jamais fabriquer une preuve sur une version qui ne contient pas le correctif.

## Guardians / invariants

- Architecture & Cohérence : le correctif est recevable car il restaure la traversée d'une vérité déjà détenue par le moteur ; aucune duplication P0/UI.
- Business Rules : `maximum_camion_litres` reste une cible d'optimisation, jamais une obligation ; capacité et absorption restent des gardes.
- QA / Regression : intégration seulement après preuve ciblée et non-régression sur le HEAD canonique.
- Security & Isolation : Test uniquement ; aucun besoin de `service_role` côté navigateur ; aucun secret dans dépôt/logs.
- Philosophie NEXUS : preuve réelle avant déclaration de réussite ; une branche Claude isolée ne compte pas comme intégrée.

## Retour attendu

Après intégration, tests et recette Test, déposer `request-3.md` avec : commit(s) canonique(s), fichiers réellement modifiés, tests, preuve négative, résultat UI, éventuel reliquat, et état Production explicitement `NOT_APPLICABLE`.

## Interdictions absolues

- Aucun changement `main`.
- Aucun changement `production`.
- Aucun Supabase Production ni NEXUS Production.
- Aucun secret/PIN/service_role dans dépôt, navigateur ou logs.
- Aucun merge/cherry-pick aveugle de `claude/issue-28-20260907-1128`.
- Aucun refactor large.
- Aucun calcul métier parallèle dans P0/UI.
- Aucune clôture sans preuve UI Test de la version intégrée.

Verdict : **CORRECTIF LOCAL ACCEPTÉ — RÉINTÉGRATION CANONIQUE + PREUVE NEXUS TEST OBLIGATOIRES AVANT CLÔTURE.**
