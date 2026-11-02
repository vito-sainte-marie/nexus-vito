<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6576569481
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41440643563), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6576569481. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `c2f7e93b142c55a9d1d669d2dc17f09fab8e1458`, `HEAD` = `c2f7e93b142c55a9d1d669d2dc17f09fab8e1458`, SHA du run `c2f7e93b142c55a9d1d669d2dc17f09fab8e1458`, tête du rail `c2f7e93b142c55a9d1d669d2dc17f09fab8e1458`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Traiter B et le libellé séparément avec une épreuve de mutation propre à chacun; pour B, prouver qu’une valeur vide ne produit aucun motif affiché ni enregistré; pour le libellé, prouver que le texte ne promet aucune quantité préremplie; limiter A au diagnostic et à la conception en lecture seule, sans migration, modification de policy, fonction, grant ou permission; soumettre toute implémentation de A à un arbitrage séparé sous SECURITE_RLS_SITE_ID; effectuer la recette uniquement sur nexus-station-test avec Guardian et Employé Test B; aucune lecture, écriture, migration, fusion ou promotion Production par l’exécutant. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Les trois points sont séparés :

- **Défaut A** : diagnostic en lecture seule autorisé, mais aucune modification de policy, fonction, grant, migration ou surface de permission. Une demande d’implémentation devra être arbitrée séparément au titre de `SECURITE_RLS_SITE_ID`. Il n’y a pas lieu de réveiller Frédéric tant qu’aucune mutation RLS ou de sécurité n’est proposée.
- **Défaut B** : correction autorisée avec une épreuve propre démontrant qu’une valeur vide n’est ni affichée comme motif ni enregistrée.
- **Libellé d’ouverture** : correction autorisée avec une épreuve propre vérifiant un texte compatible avec le comptage aveugle.

Les acquis `DELEGATION_ARBITRE`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent. Aucune autorité de fusion ou de promotion Production n’est accordée.

RAIL_LU: c2f7e93b142c55a9d1d669d2dc17f09fab8e1458

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-CYCLE-ALERTES-LIBELLE-20261102
REQUEST: request-1.md
BRANCHE_DU_LOT: handoff-continuite-20260920
HEAD: c2f7e93b142c55a9d1d669d2dc17f09fab8e1458
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Traiter B et le libellé séparément avec une épreuve de mutation propre à chacun; pour B, prouver qu’une valeur vide ne produit aucun motif affiché ni enregistré; pour le libellé, prouver que le texte ne promet aucune quantité préremplie; limiter A au diagnostic et à la conception en lecture seule, sans migration, modification de policy, fonction, grant ou permission; soumettre toute implémentation de A à un arbitrage séparé sous SECURITE_RLS_SITE_ID; effectuer la recette uniquement sur nexus-station-test avec Guardian et Employé Test B; aucune lecture, écriture, migration, fusion ou promotion Production par l’exécutant.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Créer une branche de travail distincte pour le seul correctif B, sans modifier le défaut A.
