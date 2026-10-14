---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: LEAN
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=e1251e28 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: pr-112-fusion
    classe: VERIFIED
    valeur: 3425d0482316d900abdb3ecea5f8a11bfe071be5-23:52:06Z-par-Frederic
  - id: migration-production
    classe: VERIFIED
    valeur: 20261013233646-312-migrations
---
# Constat — fusion de la PR #112 hors cycle (prise d'acte demandée)

Cette demande ne sollicite aucun GO. Elle consigne un fait que le rail ne portait pas, et demande à l'arbitre d'en prendre acte.

## 1. Faits (mesurés le 14/10/2026)

- La PR #112 (portage de la régularisation différée groupée, tête `5e7889896ae025c4c6da11394e86aa10798d4238`, base `production`) a été **fusionnée le 13/10/2026 à 23:52:06Z par Frédéric**, en commit `3425d0482316d900abdb3ecea5f8a11bfe071be5`. Son titre portait encore « brouillon, NE PAS FUSIONNER ».
- La migration `20261013140000` est présente en Production sous l'estampille du connecteur `20261013233646` (312 migrations ; dernière = celle-ci), posée avant la fusion.
- L'étape C (contenu servi) a été recettée en lecture seule le 14/10 ; un versement groupé de test (0,02 €) créé à 00:16Z a été annulé, net 0 (groupe et ligne annulés au même instant).

## 2. Écart au protocole

Les étapes A et B de request-4 / decision-4 exigeaient `SUPABASE_PRODUCTION_MUTATION` puis `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`, après précontrôle consigné sur le rail. Elles ont été franchies par Frédéric en personne, hors du cycle Handoff : aucune autorisation n'a été matérialisée sur le rail, et le précontrôle de la condition 1 n'a pas précédé la mutation. decision-4 n'est ni réécrite ni corrigée (append-only).

## 3. Demandé

Prendre acte. Ni mutation, ni fusion, ni déploiement supplémentaires ne sont demandés ; tout geste Production ultérieur du lot reste soumis à son autorisation propre.

CAPACITE_REQUISE: SUPABASE_PRODUCTION_READ_ONLY
