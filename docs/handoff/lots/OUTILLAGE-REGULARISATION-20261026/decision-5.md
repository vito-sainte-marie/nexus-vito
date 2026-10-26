---
protocol: nexus-handoff/2
kind: decision
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 5
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-6.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6429247928
---
# Décision sur request-6.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40415608261), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6429247928. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `OUTILLAGE-REGULARISATION-20261026`, `REQUEST` = `request-6.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `663e9833f12de777238c15d34e7095a0da7b456b`, `HEAD` = `663e9833f12de777238c15d34e7095a0da7b456b`, SHA du run `663e9833f12de777238c15d34e7095a0da7b456b`, tête du rail `663e9833f12de777238c15d34e7095a0da7b456b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Inscrire dans RULES.json la convention réservant Test A à la recette automatique; ajouter une garde refusant toute recette manuelle documentée qui cite Test A et une mutation démontrant que la garde détecte cette violation; conserver un périmètre Test uniquement, sans nouveau compte Auth, secret, accès, réutilisation d’identifiants de Test A, modification de main ni action Production; fournir la preuve verte de la garde et de sa mutation avant clôture. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le changement de voie est approuvé : la recette automatique réserve Employé Test A, tandis que les recettes manuelles utilisent Employé Test B ou Manager Test, sans création ni réutilisation de compte, secret ou accès.

La décision humaine sur le motif `SECRET_PERMISSION_SURFACE_SECURITE` est acquise par refus de créer le secret. Les conditions « trois passages verts » et « épreuve d’isolation et sa mutation », propres au scénario abandonné Employé Test Auto, deviennent sans objet.

Conformément à `OUTILLAGE_A_POSTERIORI` et `PREAUTORISATIONS_CLAUDE`, la garde d’outillage peut être réalisée sans nouveau GO humain. Le lot reste ouvert jusqu’au dépôt et à la preuve de cette garde. `STATE.json` fait foi et désigne `decision-3.md` comme dernière décision enregistrée ; le verdict présent ne dépend donc pas de la matérialisation alléguée de `decision-4.md`.

RAIL_LU: 663e9833f12de777238c15d34e7095a0da7b456b

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: OUTILLAGE-REGULARISATION-20261026
BRANCHE_DU_LOT: handoff-continuite-20260920
REQUEST: request-6.md
HEAD: 663e9833f12de777238c15d34e7095a0da7b456b
LEASE: aucun
GATE_STATE: G1, CI à exécuter sur la garde
PROOF_STATE: PROOF_VALID
CONDITIONS: Inscrire dans RULES.json la convention réservant Test A à la recette automatique; ajouter une garde refusant toute recette manuelle documentée qui cite Test A et une mutation démontrant que la garde détecte cette violation; conserver un périmètre Test uniquement, sans nouveau compte Auth, secret, accès, réutilisation d’identifiants de Test A, modification de main ni action Production; fournir la preuve verte de la garde et de sa mutation avant clôture.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Déposer sur la branche du lot la convention RULES.json, sa garde et sa mutation, puis publier leur preuve CI.
