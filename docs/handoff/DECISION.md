<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38983098303), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6226840716. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `33348d3c6b06dadf6267eba0fce78e0f9bb1b42c`, `HEAD` = `33348d3c6b06dadf6267eba0fce78e0f9bb1b42c`, SHA du run `33348d3c6b06dadf6267eba0fce78e0f9bb1b42c`, tête du rail `33348d3c6b06dadf6267eba0fce78e0f9bb1b42c`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Développement, migration, déploiement et recette limités à la branche et à l’environnement Test ; aucune PR vers main ou production, aucune mutation Production et aucune donnée réelle ; les six valeurs métier provisoires doivent rester identifiées comme telles, configurables ou réversibles, sans constituer une décision Production ; la migration Test doit conserver site_id, l’isolation multisite et les RLS, avec script et vérifications consignés avant son application. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La condition 3 de `decision-1.md` est levée : le brief intégral est désormais déposé et référencé sur le rail. Le développement sur Test est autorisé conformément aux acquis `PALIER_HUMAIN_RESTREINT`, `DELEGATION_ARBITRE`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO`.

Les six arbitrages métier restent provisoires : ils ne bloquent pas un prototype Test réversible, mais ne doivent pas être transformés en règles Production définitives. Toute migration demeure strictement Test-only et doit préserver `site_id`, l’isolation multisite et les RLS. Aucune autorité n’est accordée sur `main`, Production, les données réelles ou un service OCR payant.

RAIL_LU: 33348d3c6b06dadf6267eba0fce78e0f9bb1b42c

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
REQUEST: request-4.md
HEAD: 33348d3c6b06dadf6267eba0fce78e0f9bb1b42c
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Développement, migration, déploiement et recette limités à la branche et à l’environnement Test ; aucune PR vers main ou production, aucune mutation Production et aucune donnée réelle ; les six valeurs métier provisoires doivent rester identifiées comme telles, configurables ou réversibles, sans constituer une décision Production ; la migration Test doit conserver site_id, l’isolation multisite et les RLS, avec script et vérifications consignés avant son application.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Acquérir le lease du lot pour commencer l’incrément Test autorisé.
