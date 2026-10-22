<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-PRISE-EN-CHARGE-20261022/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: OUTILLAGE-PRISE-EN-CHARGE-20261022
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6352411625
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39862613939), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6352411625. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `OUTILLAGE-PRISE-EN-CHARGE-20261022`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `26d5d7d604e8da71594e769c267d9e24246c6065`, `HEAD` = `26d5d7d604e8da71594e769c267d9e24246c6065`, SHA du run `26d5d7d604e8da71594e769c267d9e24246c6065`, tête du rail `26d5d7d604e8da71594e769c267d9e24246c6065`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Identité de prise en charge explicite et durable; refus nommé d’un exécutant différent avec identité, date et commit; cas voisins conservés; épreuve rouge/verte et mutation obligatoires; suite rejouée après build; faits historiques consignés sans supposition; règle provisoire sans GO humain obligatoire; périmètre strictement limité à l’outillage, aux épreuves et à docs/learning. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le refus outillé est approuvé. Il relève de l’outillage et des gardes, sans Production, secret, choix métier ni modification du protocole. Les acquis `OUTILLAGE_A_POSTERIORI`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent.

Exécutant désigné pour l’implémentation : `github-actions-claude`.

La règle provisoire ne doit toutefois pas créer un nouveau GO obligatoire de Frédéric. Elle doit imposer le respect de `EXECUTANT_NEXT` : après actualisation du rail, un exécutant différent s’arrête; une réattribution passe par une nouvelle décision de l’arbitre compétent, sauf apparition d’un des dix motifs réservés à Frédéric.

Conditions :
1. Enregistrer une identité de prise en charge explicite et durable, avec date et référence de commit exploitable; ne pas prendre l’auteur Git ou `Co-Authored-By` comme identité canonique.
2. Refuser avec un code nommé toute seconde prise en charge par un exécutant différent et afficher l’exécutant initial, la date et le commit disponibles.
3. Conserver les cas voisins demandés : reprise par le même exécutant, `closes:true` et absence d’exécutant désigné.
4. Fournir l’épreuve rouge puis verte et une mutation neutralisant la comparaison d’exécutant.
5. Rejouer la suite après `bash outils/build.sh`.
6. Consigner dans `EXPERIENCE.jsonl` uniquement les commits effectivement retrouvés dans l’historique, sans compléter les faits par supposition.
7. Limiter les changements à `outils/handoff.js`, ses épreuves et `docs/learning/`, sans modification de `nexus-handoff/2`, de `main`, de Production ou d’une surface de sécurité.

RAIL_LU: 26d5d7d604e8da71594e769c267d9e24246c6065

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: OUTILLAGE-PRISE-EN-CHARGE-20261022
REQUEST: request-1.md
HEAD: 26d5d7d604e8da71594e769c267d9e24246c6065
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Identité de prise en charge explicite et durable; refus nommé d’un exécutant différent avec identité, date et commit; cas voisins conservés; épreuve rouge/verte et mutation obligatoires; suite rejouée après build; faits historiques consignés sans supposition; règle provisoire sans GO humain obligatoire; périmètre strictement limité à l’outillage, aux épreuves et à docs/learning.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
