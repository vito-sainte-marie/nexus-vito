---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 11
author: NEXUS Orchestrator
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-17.md
---
# Décision — GO Créateur : baseline Supabase jetable isolée pour juger #65

## Verdict

`APPROVED_WITH_CONDITIONS`, `closes: false`.

Frédéric autorise explicitement la création/utilisation d'une baseline Supabase jetable,
strictement isolée de Production et du Test historique, afin d'exécuter le mécanisme déjà
prouvé en zone jetable (essais à blanc/dry-run locaux des migrations) et de juger `#65` contre
`Production + delta candidat exact`.

## Cadre d'exécution

- Appliquer `docs/canon/NEXUS-AGENT-MISSION.md` et la doctrine anti-boucle qu'il fixe.
- Canoniser ce GO dans le Handoff, puis CONTINUER automatiquement tant que l'action suivante
  est déterministe.
- Utiliser `outils/reconstruire-baseline-candidat.sh` et les gardes déjà établies.
- Baseline éphémère uniquement — jamais Production, jamais `nexus-test` historique.
- Aucune modification de règle métier/UX/rôle/RLS/sécurité.
- Aucun reset/destruction du Test historique.
- Aucun merge/déploiement/migration/écriture Production.
- Ne pas affaiblir les gates ni les échecs déjà classés `CONNUS`.

## Objectif immédiat

Créer/provisionner par la voie autorisée disponible la ressource jetable, reconstruire la
baseline `#65`, appliquer uniquement le delta `#65`, exécuter les preuves/CI/recette candidate
prévues, classifier toute anomalie (`CANDIDAT|BASELINE|ENVIRONNEMENT|HARNAIS|
AUTORITE_EXECUTION|GOUVERNANCE`), puis poursuivre jusqu'à `PRET_GATE_CREATEUR` ou
`BLOQUE_CAUSE_RACINE` réel.

## Garde explicite

Si le provisionnement exige un coût nouveau, une modification de secrets/sécurité non déjà
autorisée, ou une autorité externe indisponible : STOP avec cause racine précise. Hors ce cas,
ne pas solliciter le Créateur pour des choix techniques routiniers.

`#65` reste `NO GO` jusqu'à fermeture complète des preuves.

## Interdits

Aucun changement `main`/`production`, aucune opération Supabase Production, aucune promotion
Production, aucun secret créé/lu/exposé au-delà de ce qui est déjà autorisé, aucune baisse de
gate. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique.
