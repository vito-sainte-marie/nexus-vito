---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-INCIDENTS-CI-1-20261014
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38608277528), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6174509499. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-INCIDENTS-CI-1-20261014`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `09a5ec5988073678e066e04e710c3aa7018b7ea4`, `HEAD` = `09a5ec5988073678e066e04e710c3aa7018b7ea4`, SHA du run `09a5ec5988073678e066e04e710c3aa7018b7ea4`, tête du rail `09a5ec5988073678e066e04e710c3aa7018b7ea4`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Implémentation limitée au rail; commit automatique uniquement sous lease; concurrence dédiée avec annulation désactivée; rejeu idempotent retournant DEJA_ENREGISTRE sans modification d’octets; preuve par mutation de l’absence de récursion et de relance; diff du bloc permissions de tests.yml strictement vide; arrêts de sécurité conservés en NON_ENREGISTRE; journal des répétitions en ajout seul sans réécriture de l’historique. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**DECISION : APPROVED_WITH_CONDITIONS**

Le périmètre d’outillage CI rail-only est autorisé par les acquis `OUTILLAGE_A_POSTERIORI`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO`. Il ne requiert aucun nouveau GO humain et n’accorde aucune autorité sur `main` ou Production.

L’implémentation devra fournir les preuves annoncées avant clôture du lot. Toute permission nouvelle ou élargie sort de cette approbation et relève alors de `SECRET_PERMISSION_SURFACE_SECURITE`.

RAIL_LU: 09a5ec5988073678e066e04e710c3aa7018b7ea4

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-INCIDENTS-CI-1-20261014
REQUEST: request-1.md
HEAD: 09a5ec5988073678e066e04e710c3aa7018b7ea4
LEASE: aucun
GATE_STATE: G0, CI success
PROOF_STATE: PROOF_REFRESH_REQUIRED
CONDITIONS: Implémentation limitée au rail; commit automatique uniquement sous lease; concurrence dédiée avec annulation désactivée; rejeu idempotent retournant DEJA_ENREGISTRE sans modification d’octets; preuve par mutation de l’absence de récursion et de relance; diff du bloc permissions de tests.yml strictement vide; arrêts de sécurité conservés en NON_ENREGISTRE; journal des répétitions en ajout seul sans réécriture de l’historique.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision avec outils/handoff.js decision --auteur ChatGPT sur le rail.
