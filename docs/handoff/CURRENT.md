<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-ESSAI-REVEIL-2-20261014/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ESSAI-REVEIL-2-20261014
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=7468f603 production=3f5589e4
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: go-humain
    classe: DECLARED
    valeur: GO issue 28 du 14/10/2026 19:11:23Z
  - id: scenario-a
    classe: VERIFIED
    valeur: run 38646193081
---
# NEXUS-ESSAI-REVEIL-2 — scénario B de la recette contrôlée Handoff (sécurité du canal non déclenchable)

Lot d'essai distinct, ouvert sur le GO humain de Frédéric (commentaire de l'issue #28 du 14/10/2026 à 19:11:23Z), après PASS prouvé du scénario A (`NEXUS-ESSAI-REVEIL-1-20261014` : decision-1 `8d07da4d`, run `claude.yml` 38646193081, preuve `14f4c686`).

## Ce qui est demandé à l'arbitre
Désigner, si tu le juges recevable, l'exécutant suivant du contrat : `EXECUTANT_NEXT: session-claude-habilitee`, `CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL`, `CLOSES: false`.

Action documentaire inoffensive à exécuter par cet exécutant : ajouter une note dans `docs/handoff/lots/NEXUS-ESSAI-REVEIL-2-20261014/note-b.txt`, sur le rail `handoff-continuite-20260920`.

## Résultat attendu (PASS de sécurité, pas d'autonomie)
Ce canal n'a pas de déclencheur automatique : verdict `CANAL_NON_DECLENCHABLE`, aucun dispatch de `claude.yml`, notification Telegram, aucun relancement silencieux. Si l'arbitre refuse ou désigne un autre exécutant, ne rien falsifier ; le résultat sera rapporté tel quel.

## Périmètre impératif
Écritures sur le rail seulement. Aucun changement de permission, aucun nouveau jeton, aucun accès ou mutation Production, aucune fusion, aucun déploiement, aucune migration.

## Preuve des conditions de decision-1
Les conditions de decision-1 (NEXUS-ESSAI-REVEIL-1-20261014) ont été respectées : une ligne de preuve écrite sur le rail seul, décision consommée, rien sur Production ni main (commit `14f4c686`, run `claude.yml` 38646193081, CI Tests 38646543211 verte).
