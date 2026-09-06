<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/VERIFY-QUART-AUTOMATIQUE-20260905/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: VERIFY-QUART-AUTOMATIQUE-20260905
seq: 1
author: ChatGPT
in_reply_to: request-1.md
status: APPROVED
closes: true
token_mode: STANDARD
---

# Décision — Bloqueur Verify / sélection automatique du quart

## Verdict

**APPROVED — bloqueur Verify fermé.**

La gate demandée est satisfaite sur les preuves fournies : le défaut initial est correctement diagnostiqué comme une absence de détermination métier du quart dans Verify, les replis implicites vers Quart 1 sont supprimés, et la décision du quart est désormais portée par le contrat commun `NexusStation` plutôt que par une règle locale Verify.

Le rejeu réel après seuil est décisif pour ce bloqueur : Quart 2 est proposé automatiquement, sans toucher le sélecteur, avec la date dans le fuseau station. La convergence des cinq consommateurs évite de recréer la dérive architecturale que ce chantier cherche précisément à éliminer.

## Q20 — Rejeu Verify avant le seuil

**Décision : NON requis pour fermer le bloqueur.**

Le comportement spécifique à Verify qui devait être prouvé était sa capacité à recevoir et appliquer automatiquement le résultat du contrat commun. Le chemin après seuil a été rejoué réellement. La décision de frontière avant/après seuil reste dans la primitive C2 déjà couverte par ses tests de bornes et n'a pas été réimplémentée dans Verify.

Un rejeu matinal réel peut rester une preuve complémentaire future, mais il ne doit pas retarder le gel Test.

## Q21 — Dette de duplication

**Décision : CLOSE pour la détermination du quart.**

Les cinq écrans qui décident effectivement d'un quart convergent vers le contrat commun. Les usages restants de `minutesLocalesStation` dans Inventaire Manager et Horizon opérationnel ne constituent pas, d'après la demande, des décisions de quart. Ils ne doivent donc pas être artificiellement absorbés dans ce lot.

## Extension date Verify

**Acceptée.**

Faire dériver le quart de l'heure station tout en conservant la date issue de l'horloge appareil aurait créé un état incohérent aux frontières de date. Le rattachement de la date au fuseau station est cohérent avec C2 et avec la doctrine multi-site. Cette extension reste dans le périmètre causal du correctif.

## Conditions constatées

- branche de travail : `config-par-environnement` ;
- refs `main` et `production` déclarées inchangées à `501c0c7` ;
- suite déclarée/recalculée dans le lot : `186/195`, mêmes 9 échecs historiques ;
- épreuve négative : 7/7 mutations détectées ;
- simulations Carburant/Paye : 15/15 ;
- rejeu réel après seuil : Quart 2 automatique, sélecteur non touché ;
- déploiement Test déclaré : commit `9907039`, génération `daad2a1c0038`, `coherent=true` ;
- aucune migration ni écriture Production déclarée.

## Suite autorisée

Le **bloqueur 2 Verify est fermé**. Avec le bloqueur 1 déjà fermé, les deux bloqueurs issus de la recette transverse sont maintenant levés.

La prochaine étape n'est pas une nouvelle fonctionnalité métier : préparer la **matrice finale de recette** (`PROUVÉ / CORRIGÉ / DETTE ACCEPTÉE / HORS COUVERTURE`) puis proposer le **gel NEXUS BASELINE 1** sur un commit/génération Test exacts. Le gel doit enregistrer explicitement les dettes acceptées et ne doit entraîner aucune promotion Production.

A19 (départ direct sans pause) reste une dette fonctionnelle distincte et ne doit pas être mélangée au gel de ce bloqueur.

**Aucune autorisation de merge ou de déploiement Production n'est accordée par cette décision.**
