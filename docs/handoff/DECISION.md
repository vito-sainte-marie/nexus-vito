<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 3
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---

# Décision — preuve technique acceptée, intégration bloquée par le rail d'écriture

Le `request-3.md` est accepté comme preuve technique de la correction : mutation négative puis positive, 56/56 assertions sur le sous-ensemble ciblé, moteur propriétaire unique, aucune duplication P0/UI, aucune heure de livraison inventée, aucune double intégration, aucune opération Production.

Le lot ne peut pas être clos : le delta applicatif n'est toujours pas présent sur `config-par-environnement` et la preuve UI NEXUS Test de la version corrigée n'existe donc pas.

## Classification du blocage

Ce n'est pas un échec métier ni un nouveau bug applicatif. C'est un **incident de rail d'intégration** : le workflow `issue_comment` exécute Claude sur une branche dérivée de `main` et le mécanisme de push fourni à Claude est limité à sa branche `claude/issue-28-*`. Claude peut lire et tester le HEAD canonique, mais ne peut pas écrire le delta prouvé sur `config-par-environnement`.

## Règle de réveil

**Ne pas réveiller Claude une nouvelle fois pour `decision-2.md` ni pour refaire les mêmes tests.** Le run correspondant a terminé avec succès et a produit `request-3.md`. GOV-001 s'applique : une nouvelle relance identique masquerait le défaut structurel du rail au lieu de le résoudre. GOV-004 ne s'applique pas car le run n'a pas échoué.

## Plus petite correction sûre attendue

1. Transporter mécaniquement sur `config-par-environnement` uniquement le delta déjà écrit et prouvé par Claude :
   - le correctif local `stockPrevuLivraisonL` dans `nexus-carburant-commande-moteur.js` ;
   - `test_carburant_commande_p0_traversee_reliquat_20260907.js`.
2. Ne reprendre aucun autre fichier de la branche Claude divergente.
3. Rejouer le test de contrat et la régression Carburants sur le HEAD canonique après transport.
4. Déployer/servir ensuite cette version sur NEXUS Test.
5. Produire alors seulement la preuve navigateur exigée par `decision-2.md`.
6. Revenir par un nouveau `request-4.md` avec commit canonique, tests, preuve UI et Production=`NOT_APPLICABLE`.

Le transport doit rester une intégration exacte du code Claude déjà validé, sans nouvelle logique applicative ajoutée par Orchestrator.

## Guardians / invariants

- Architecture & Cohérence : PASS sur le delta prouvé ; moteur seul propriétaire.
- Security & Isolation : PASS ; Test uniquement, aucun secret/service_role côté navigateur/logs.
- Business Rules : PASS ; 36 000 L reste une cible seulement si sûr et absorbable.
- QA/Regression : preuve ciblée recevable mais clôture impossible avant exécution sur le HEAD effectivement intégré.
- Continuité : l'incident de rail est maintenant matérialisé dans Handoff ; aucune branche Claude isolée ne vaut intégration canonique.

## Interdictions

- aucun changement `main` ;
- aucun changement `production` ;
- aucun Supabase Production ni NEXUS Production ;
- aucun merge/cherry-pick global de `claude/issue-28-20260907-1232` ;
- aucune nouvelle relance Claude pour répéter `decision-2.md` ;
- aucune preuve UI sur une version qui ne contient pas le correctif ;
- aucune promotion Production sans validation explicite de Frédéric.

Verdict : **CORRECTIF TECHNIQUEMENT PROUVÉ — LOT OUVERT, BLOQUÉ UNIQUEMENT PAR L'INTÉGRATION CANONIQUE ET LA PREUVE NEXUS TEST.**
