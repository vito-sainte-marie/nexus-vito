<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-ESSAI-REVEIL-1-20261014/request-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ESSAI-REVEIL-1-20261014
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
    valeur: issue-28-commentaire-2026-10-14T19:11:23Z
  - id: essai-precedent
    classe: VERIFIED
    valeur: run-38621556443-refus-NEXUS_BASE_BRANCH-absent
---
# NEXUS-ESSAI-REVEIL-1 — scénario A de la recette contrôlée Handoff (chemin nominal)

Lot d'essai distinct, ouvert sur GO humain explicite de Frédéric (commentaire de l'issue #28 du 14/10/2026 à 19:11:23Z). Il ne livre rien d'applicatif : il sert à prouver que la boucle relance Claude toute seule.

## Contexte
- Lot précédent clos : `NEXUS-INCIDENTS-CI-1-20261014/decision-3.md` (APPROVED, closes true), décision consommée.
- Un premier déclenchement par commentaire `@claude` sur l'issue #28 (run `claude.yml` 38621556443, 19:11Z) a été refusé : aucun `NEXUS_BASE_BRANCH` désigné. Refus voulu, publié, sans effet sur le rail. Classé NON_CONCLUANT : il ne prouve ni ne réfute la relance. Le présent dépôt par le canal habituel remplace ce déclenchement (pas de `@claude` supplémentaire, pour ne pas créer de réveil concurrent).

## Ce qui est demandé à l'arbitre
Désigner, si tu le juges recevable, l'exécutant suivant du contrat : `EXECUTANT_NEXT: github-actions-claude`, `CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL`, `CLOSES: false`.

Action sans effet métier à exécuter par cet exécutant : écrire UNE seule ligne de preuve (lot, run, SHA de la décision, horodatage UTC) dans `docs/handoff/lots/NEXUS-ESSAI-REVEIL-1-20261014/preuve-reveil.txt` sur le rail `handoff-continuite-20260920`, consommer la décision, rendre un compte rendu, sans clore le lot.

Tu restes libre de ton verdict : si tu refuses ou désignes un autre exécutant, ne rien falsifier ; le résultat sera rapporté tel quel.

## Périmètre impératif
Écritures sur le rail `handoff-continuite-20260920` seulement. Aucun changement de permission, aucun nouveau jeton, aucun accès ou mutation Production, aucune fusion, aucun déploiement, aucune migration. Plafonds et gates de sécurité préservés. Le scénario B ne part qu'après un PASS prouvé de A.

## Preuves attendues pour A
demande, appel OpenAI, décision matérialisée, verdict de relance, `CLAUDE_RELANCE`/`repository_dispatch`, démarrage du run `claude.yml`, consommation, commit de preuve, suite ou clôture explicite.
