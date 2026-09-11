---
protocol: nexus-handoff/2
kind: request
lot_id: CARBURANTS-PERFORMANCE-AUDIT-COMMANDE-20260906
seq: 1
author: ChatGPT
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=c434201 production=501c0c7
  - id: terrain-carburants
    classe: HUMAN
    valeur: Capture terrain du 06/09/2026 : recommandation 22000 L SP95 + 13000 L GO = 35000 L, action de commande samedi pour livraison lundi signalée impossible, préférence utilisateur pour simuler avant préparation
---

# Demande — Audit complet Carburants Performance et anomalie de commande

## Contexte
Le module Carburants Performance paraît stable en usage terrain depuis plusieurs jours. Une anomalie a toutefois été constatée sur la carte « Prochaine commande » : une recommandation de 35 000 L (22 000 L SP95 + 13 000 L GO), inférieure au volume opérationnel de 36 000 L attendu pour le camion, est proposée avec une action de préparation de commande. La capture terrain indique également qu'une commande le samedi pour livraison le lundi est opérationnellement impossible dans ce cas.

## Objectifs
1. Identifier la cause exacte de l'anomalie sans modifier prématurément le moteur.
2. Auditer de bout en bout Carburants Performance : données, calculs, règles de calendrier, capacité camion, stock/réserve, recommandations, fiabilité, livraison en cours/réalisée, UX, garde site, non-régression.
3. Vérifier que les comportements qui fonctionnent actuellement restent corrects.
4. Définir les corrections minimales nécessaires, avec critères de preuve avant implémentation.

## Points terrain obligatoires
- Ne jamais présenter une recommandation opérationnellement impossible comme action directe.
- Vérifier la règle de capacité/complétion à 36 000 L et distinguer minimum livrable de capacité camion.
- Vérifier les contraintes jour de commande / créneau de livraison, notamment samedi → lundi.
- Lorsque la quantité doit être arbitrée par le manager, privilégier « Simuler ma commande » avant « Préparer ma commande ».
- Éviter deux boutons de simulation redondants.

## Périmètre d'audit
- `NEXUS-Carburants-Pilotage-v1.html`
- `nexus-carburant-commande-moteur.js`
- `nexus-carburant-commande-donnees.js`
- moteurs/données carburant appelés par la chaîne de commande
- tests de commande, couverture, livraison, projections et non-régression associés
- aucune modification de `main`, `production`, Supabase Production ou NEXUS Production.

## Sortie attendue
Un diagnostic factuel avec :
- cause racine ;
- règles métier réellement codées ;
- écarts entre règles codées et règles terrain ;
- risques de régression ;
- plan de correction minimal ;
- matrice de tests avant/après.
