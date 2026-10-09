---
protocol: nexus-handoff/2
kind: decision
lot_id: CARBURANTS-PERFORMANCE-OPTIMISATION-CAMION-20260906
seq: 4
author: ChatGPT
branch: config-par-environnement
decision: APPROVED
closes: true
in_reply_to: request-4.md
---

# Décision 4 — CARB-004 optimisation camion

## Verdict

`APPROVED`, `closes: true`.

Les conditions de `decision-3.md` sont satisfaites par les preuves canoniques disponibles : le delta utile est intégré sur `config-par-environnement`, la mutation négative démontre le défaut 35 000 → 36 000, la suite conserve uniquement les 9 échecs historiques connus, NEXUS Test sert l'actif corrigé, et la recette navigateur de bout en bout montre 36 000 L avec récupération de 1 000 L sur GO et refus SP95 motivé par la capacité.

Le lot CARB-004 peut donc être clos. Cette décision n'autorise aucune promotion Production.

## Q67 — clôture du lot

Oui. Le mécanisme demandé est prouvé sur le moteur propriétaire et sur NEXUS Test. La différence de géométrie entre les cuves Test et ViTO ne remet pas en cause la preuve du mécanisme ; elle interdit seulement de présenter les volumes Test comme une reproduction des volumes terrain.

## Q68 — dette capacité avec stock projeté négatif

Oui, ouvrir un lot distinct. Le comportement observé est préexistant et hors périmètre CARB-004 : lorsque `stockPrevuLivraisonL < 0`, `capaciteDisponibleLivraison(limite, stockPrevu) = limite - stockPrevu` peut dépasser la limite physique de remplissage et produire une recommandation non livrable. Il ne doit pas être corrigé opportunément dans CARB-004.

Critères minimaux du futur lot :
- capacité réceptionnable toujours bornée par la limite physique de la cuve ;
- cas stock projeté négatif explicitement testé ;
- aucune régression sur réserve, rotation, arrondi, GNR et double intégration de livraison ;
- moteur seul propriétaire de la vérité ;
- preuve Test avant toute promotion.

## Q69 — automatisation de la recette Carburants Test

Oui comme objectif de gouvernance/QA, mais pas dans CARB-004. Elle doit rejoindre le futur lot d'orchestration qui reprendra proprement la dette de REPAIR-1 (Guardians/CI et recette navigateur), depuis le HEAD canonique courant. Une recette dépendant d'un PIN humain ne doit jamais conduire à exposer ce PIN, un secret ou un `service_role` dans le dépôt, le navigateur ou les logs.

## Point de gouvernance constaté

`request-4.md` documente qu'une modification du workflow sur `main` a été effectuée antérieurement avec autorisation humaine pour réparer le rail. L'invariant opérationnel courant donné à l'Orchestrator est désormais plus strict : aucune nouvelle modification de `main`. Cette décision ne crée donc aucun précédent d'écriture sur `main`.

## Apprentissage

La dette de capacité découverte par la recette doit être matérialisée au Backlog avant ouverture de son lot. La dette d'automatisation de recette reste rattachée au futur lot d'orchestration/QA. La commande `handoff.js decision` ajoutée au rail doit devenir le chemin normal de dépôt des décisions afin d'empêcher une nouvelle enveloppe hors vocabulaire.

## Interdictions

- aucun `main` ;
- aucun `production` ;
- aucune opération Supabase Production ;
- aucun NEXUS Production ;
- aucune promotion Production sans validation explicite de Frédéric ;
- aucun secret/PIN/service_role dans dépôt, navigateur ou logs.
