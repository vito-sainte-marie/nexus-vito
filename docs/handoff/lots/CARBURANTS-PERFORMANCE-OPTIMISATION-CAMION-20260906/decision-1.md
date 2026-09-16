---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---

# Décision — moteur CARB-004 accepté, clôture conditionnée aux preuves de traversée P0 et UI Test

Le diagnostic et la correction décrits dans `request-1.md` sont acceptés pour ce qu'ils prouvent : l'optimiseur atteignait bien 36 000 L avant arrondi, 1 000 L était perdu par l'arrondi séparé des carburants, et la récupération du reliquat corrige ce cas sans relâcher les gardes de capacité ni d'absorption.

Le lot reste ouvert : deux preuves explicitement manquantes sont nécessaires avant de déclarer CARB-004 terminé.

## Q64 — preuve UI/navigateur

**Oui, exigée avant clôture.**

CARB-004 est une anomalie terrain portant sur une recommandation visible et actionnable. Le Backlog n'autorise le passage à `TERMINE` qu'après intégration sur le rail autorisé, tests/recettes, preuve enregistrée, invariants préservés et, lorsqu'une validation terrain est nécessaire, confirmation humaine. Une preuve moteur seule ne démontre pas que la carte « Prochaine commande » affiche et transmet la vérité corrigée.

Preuve attendue sur NEXUS Test uniquement :
- cas sûr et absorbable : recommandation visible à 36 000 L ;
- cas réellement limité : volume inférieur conservé avec motif cohérent ;
- CTA cohérent avec le résultat du moteur ;
- aucune heure de livraison inventée ;
- aucune double intégration d'une livraison ;
- aucun accès Production.

Cette preuve peut nécessiter une session navigateur/PIN et reste de classe `HUMAN` tant qu'elle n'est pas apportée.

## Q65 — traversée `nexus-carburants-p0-fixes.js`

**Oui, obligatoire avant clôture.**

La couche P0 enveloppe le moteur. Il faut vérifier explicitement que la nouvelle sortie `reliquatArrondi` et les informations nécessaires à son explication traversent cette couche sans être avalées, renommées ou recalculées silencieusement.

Règle d'architecture : le moteur reste propriétaire unique de la recommandation. La couche P0 et l'UI consomment sa vérité ; elles ne recréent pas un calcul parallèle.

Preuve minimale : test ciblé de contrat sur la traversée P0, couvrant au moins le cas 35 000 → 36 000 L et un refus motivé.

## Q66 — borne `optim.total` non indépendamment observable

**Oui, la conserver comme garde par construction, mais ne pas fabriquer de preuve.**

L'absence d'observabilité indépendante n'est pas une raison pour supprimer une borne défensive cohérente avec le contrat. En revanche, aucun test ne doit être présenté comme détectant cette borne si les plafonds capacité/autonomie rendent sa mutation indiscernable dans les scénarios mesurables actuels.

La documentation doit donc distinguer clairement :
- garantie par construction ;
- comportement effectivement observé par test.

Si une future évolution rend cette borne observable, un test spécifique pourra alors être ajouté.

## Guardians

- **Architecture & Cohérence** : PASS sous condition de preuve P0 ; une vérité métier unique dans le moteur, aucune duplication UI/P0.
- **Business Rules** : PASS ; 36 000 L est une cible lorsque sûr et absorbable, jamais une obligation.
- **QA / Regression** : PASS sur les preuves moteur déclarées, mais clôture bloquée jusqu'au contrat P0 et à la recette UI Test.
- **Security & Isolation** : aucun besoin de `service_role`; aucune opération Production autorisée ; Test uniquement.
- **Bible / Philosophie** : conforme à « preuves terrain avant hypothèses » et à l'obligation de ne pas masquer une limite réelle.

## Travail restant autorisé

1. Vérifier et, seulement si nécessaire, corriger la traversée de `reliquatArrondi` dans `nexus-carburants-p0-fixes.js` sur `config-par-environnement`.
2. Ajouter le test de contrat P0 minimal.
3. Exécuter les tests Carburants et la régression pertinente.
4. Produire la preuve UI/navigateur sur NEXUS Test si l'environnement de session le permet ; sinon la laisser explicitement `HUMAN` et non satisfaite.
5. Déposer un nouveau `request-2.md` avec résultats, commits, tests, preuves et éventuel reliquat humain.

## Interdictions absolues

- Aucun changement `main`.
- Aucun changement `production`.
- Aucun Supabase Production ni NEXUS Production.
- Aucun secret `service_role` dans dépôt, navigateur ou logs.
- Aucun refactor large hors périmètre.
- Aucun contournement du moteur par un calcul parallèle dans P0 ou l'UI.
- Aucune déclaration de lot terminé sans les preuves ci-dessus.

Verdict : **CORRECTION MOTEUR CARB-004 ACCEPTÉE — LOT OUVERT JUSQU'À PREUVE DE TRAVERSÉE P0 ET RECETTE UI TEST.**
