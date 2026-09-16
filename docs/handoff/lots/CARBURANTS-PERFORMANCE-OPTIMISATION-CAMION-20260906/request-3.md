---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 3
author: Claude
branch: config-par-environnement
in_reply_to: decision-2.md
---

# Request-3 — delta réappliqué et prouvé sur le HEAD canonique, intégration non faite (obstacle d'écriture)

## 0) HEAD de départ

`origin/config-par-environnement` = `08bf3bfa28e7558e855f112a43187fc46d41747b`, identique au HEAD canonique attendu cité dans le réveil. Ce checkout d'exécution (`claude/issue-28-20260907-1232`) reste raciné sur `main` (`645116b`), mais la branche `config-par-environnement` est disponible localement à ce même commit, ce qui a permis pour la première fois une lecture directe (`git show`) et une exécution réelle contre le contenu canonique, sans passer par la branche divergente `claude/issue-28-20260907-1128`.

## 1) Diff réel confirmé — limité au correctif + nouveau test

Diff fichier par fichier entre `config-par-environnement` et `claude/issue-28-20260907-1128` :
- `nexus-carburant-commande-moteur.js` : **exactement** le correctif de 2 lignes utiles (+ commentaire) déjà décrit par `decision-2.md` — lecture de `ev.scenarioMaintenant.stockPrevuLivraisonL` avec repli sur `ev.stockPrevuLivraisonL`, dans la phase de récupération du reliquat.
- `test_carburant_commande_p0_traversee_reliquat_20260907.js` : absent de `config-par-environnement`, nouveau fichier, 232 lignes, repris tel quel.
- `nexus-carburants-p0-fixes.js`, `nexus-carburant-commande-donnees-core.js` : **aucun diff** avec `config-par-environnement` (confirmé) — rien d'autre n'a été recopié depuis la branche divergente.
- `NEXUS-Carburants-Pilotage-v1.html` : diffère (74 lignes) — **non repris**, conformément à l'interdiction explicite de `decision-2.md` (§3).

## 2) Preuve négative puis positive (mutation réelle)

Sur un banc de test isolé reconstitué à partir du contenu réel de `config-par-environnement` (moteur, données-core, P0, moteur carburant de base — tous identiques au blob canonique, vérifié par diff) :

- **Sans le correctif** : `node test_carburant_commande_p0_traversee_reliquat_20260907.js` → **échec réel**, `AssertionError: 36 000 L attendus à travers P0, obtenu 35000`.
- **Correctif appliqué** (les 2 lignes exactes validées par `decision-2.md`) : **2/2** — `36 000 L` atteints (sp95 28 000 à sa capacité, go 7 000→8 000 récupéré), refus motivé sur sp95 explicite, et confirmation par lecture de source que `nexus-carburants-p0-fixes.js` ne contient jamais le mot « reliquat » (aucun recalcul parallèle).

## 3) Suite Carburants — régression réelle, exécutée contre l'arbre canonique fixé

7 fichiers de test exécutés réellement (`node`, pas de trace manuelle), tous verts :

| Fichier | Résultat |
|---|---|
| `test_carburant_commande_p0_traversee_reliquat_20260907.js` | 2/2 |
| `test_carburant_commande_ancre_jaugeage_v2255.js` (double-comptage/double-intégration stock) | 2/2 |
| `test_carburant_commande_correction_decision2_20260906.js` (calendrier, CTA, aucune heure inventée) | 14/14 |
| `test_carburant_commande_moteur_v2238.js` (moteur cœur) | 18/18 |
| `test_carburant_commande_camion_complet_v2245.js` (complétion camion, garde-fou autonomie) | 6/6 |
| `test_carburant_commande_reliquat_arrondi_20260906.js` (test isolé pré-existant, rétrocompatibilité) | 9/9 |
| `test_carburant_commande_regle_frederic_v2253.js` (règles métier prévision/priorité) | 5/5 |

**56/56 assertions passées, 0 échec, 0 régression imputable au lot.** Portée non exhaustive : les ~17 autres fichiers `test_carburant_commande_*`/`test_carburant_diagnostic_*`/`test_carburant_p0_*` restants n'ont pas été rejoués individuellement dans cette session (limite de temps d'exécution, un `git show` par fichier) — aucun n'a de dépendance connue vers la phase de récupération du reliquat modifiée.

## 4) Vérifications ciblées (decision-2 §5)

- **P0 ne recalcule jamais `reliquatArrondi`** : confirmé par grep direct sur `nexus-carburants-p0-fixes.js` canonique (aucune occurrence de « reliquat ») + assertion dédiée du nouveau test.
- **Aucune heure de livraison inventée** : `test_carburant_commande_correction_decision2_20260906.js` — assertion explicite « livraisonISO reste une date pure ».
- **Aucune double intégration d'une livraison** : `test_carburant_commande_ancre_jaugeage_v2255.js` — assertion explicite que l'ancrage jaugeage ne reproduit plus le double compte de l'ancienne ancre "stock maintenant".

## 5) Intégration canonique — NON FAITE (obstacle structurel confirmé, pas contourné)

Cette session ne dispose d'aucun mécanisme de push vers `config-par-environnement` : `git push --dry-run origin config-par-environnement:config-par-environnement` requiert une approbation qu'aucun humain ne peut donner dans ce run automatisé, et le seul mécanisme d'écriture fourni par l'outillage (`git-push.sh`) est explicitement scopé à `claude/issue-28-20260907-1232`. `git worktree`, `git archive` et `git apply` sont également bloqués par approbation — seule la lecture (`git show`, `git diff` contre un ref) fonctionne. Le delta validé (§1-4 ci-dessus) est donc déposé, testé et prouvé, mais **reste non intégré sur `config-par-environnement`**.

Le correctif + le nouveau test sont commités sur `claude/issue-28-20260907-1232` (fichiers `nexus-carburant-commande-moteur.js`, `nexus-carburant-commande-donnees-core.js`, `nexus-carburants-p0-fixes.js` ramenés à l'identique du blob canonique + correctif de 2 lignes ; `test_carburant_commande_p0_traversee_reliquat_20260907.js` nouveau), pour transport par une session/humain avec droit d'écriture sur `config-par-environnement`.

## 6) Preuve UI/navigateur NEXUS Test — NON SATISFAITE, explicitement

Conformément à `decision-2.md` §D, l'ordre est : intégrer d'abord sur `config-par-environnement`, déployer/servir sur NEXUS Test, **puis seulement** exécuter la recette navigateur. L'intégration (§5) n'a pas eu lieu — exécuter une recette navigateur maintenant testerait la version non corrigée déjà déployée sur `nexus-test`, ce que `decision-2.md` interdit explicitement. Ce point reste **`HUMAN`/non satisfait**, le lot reste ouvert.

## 7) Guardians

- **Architecture & Cohérence** : PASS — correctif limité à la lecture d'un champ déjà aplati ailleurs dans le même fichier (`pourOptimisation`), aucune duplication, moteur seul propriétaire.
- **Security & Isolation** : PASS — aucun secret, aucune opération Supabase, aucune écriture `main`/`production`.
- **Business Rules** : PASS — `maximum_camion_litres` reste une cible ; refus motivé et récupération coexistent dans la même réponse.
- **QA/Regression** : PASS — 56/56 sur le sous-ensemble exécuté, mutation négative confirmée, 0 régression.
- **Bible/Philosophie** : PASS — preuve réelle avant déclaration de réussite ; le lot n'est pas déclaré terminé malgré le code validé, faute d'intégration/preuve UI réelles.

## 8) Production

`NOT_APPLICABLE` — aucune requête, aucun merge, aucun déploiement.

## Limites résiduelles honnêtes

1. Intégration canonique non faite (§5) — obstacle d'écriture confirmé, pas contourné par une fabrication.
2. Preuve UI/navigateur non faite (§6) — conditionnée à l'intégration, non satisfaite par construction.
3. Régression Carburants exécutée sur 7/24 fichiers `test_carburant_commande_*` (les plus directement liés au reliquat/complétion/calendrier) plutôt que l'intégralité des ~90 fichiers `test_carburant*` du dépôt — limite de temps d'exécution dans cette session, pas un choix de dissimulation.

Verdict : **correctif prouvé, non intégré, lot toujours ouvert.**
