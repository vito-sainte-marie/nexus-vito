---
protocol: nexus-handoff/2
kind: decision
lot_id: VIGIE-DECLENCHEURS-20261024
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6383815960
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40091058282), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6383815960. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `VIGIE-DECLENCHEURS-20261024`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `4efe5a34f09d7de6fa0d9cc2b841fa10b2b64339`, `HEAD` = `4efe5a34f09d7de6fa0d9cc2b841fa10b2b64339`, SHA du run `4efe5a34f09d7de6fa0d9cc2b841fa10b2b64339`, tête du rail `4efe5a34f09d7de6fa0d9cc2b841fa10b2b64339`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Limiter le changement à .github/workflows/vigie-cloture.yml; déclarer exactement schedule, workflow_dispatch et workflow_run; cibler le workflow « Tests » terminé sur handoff-continuite-20260920; conserver exactement contents: read et actions: read; ajouter l’épreuve et ses mutations décrites; ne pas fusionner sur main au titre de cette décision. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Verdict : **APPROVED_WITH_CONDITIONS**. Les trois déclencheurs et la limite documentée sont approuvés. Le changement reste un lot de garde/CI en lecture seule, sans secret ni élargissement de permissions.

Les acquis `DELEGATION_ARBITRE` et `COMMIT_PUSH_RAIL_SANS_GO` autorisent sa réalisation et son push sur le rail sans validation humaine supplémentaire. En revanche, cette décision n’autorise pas la fusion sur `main`, qui relèvera séparément du palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`. La preuve d’exécution réelle sera recueillie après cette éventuelle fusion et conditionnera la clôture.

RAIL_LU: 4efe5a34f09d7de6fa0d9cc2b841fa10b2b64339

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: VIGIE-DECLENCHEURS-20261024
REQUEST: request-1.md
HEAD: 4efe5a34f09d7de6fa0d9cc2b841fa10b2b64339
LEASE: aucun
GATE_STATE: G1, CI à exécuter sur le changement
PROOF_STATE: PROOF_VALID
CONDITIONS: Limiter le changement à `.github/workflows/vigie-cloture.yml`; déclarer exactement `schedule`, `workflow_dispatch` et `workflow_run`; cibler le workflow « Tests » terminé sur `handoff-continuite-20260920`; conserver exactement `contents: read` et `actions: read`; ajouter l’épreuve et ses mutations décrites; ne pas fusionner sur `main` au titre de cette décision.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Implémenter sur le rail les trois déclencheurs et leur épreuve dans le périmètre approuvé.
