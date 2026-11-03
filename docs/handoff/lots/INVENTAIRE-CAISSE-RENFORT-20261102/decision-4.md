---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6592098055
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41552904481), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6592098055. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-CAISSE-RENFORT-20261102`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `388f05c5a85a02c4d4748c28f2625b6b9e6f2027`, `HEAD` = `388f05c5a85a02c4d4748c28f2625b6b9e6f2027`, SHA du run `388f05c5a85a02c4d4748c28f2625b6b9e6f2027`, tête du rail `388f05c5a85a02c4d4748c28f2625b6b9e6f2027`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Le fil caisse L1 doit conserver le refus par défaut, l’isolation par site et la RLS existante ; pilotesRenfort reste sans lecteur ni activation ; aucune migration, policy, grant, mutation, fusion ou déploiement Production n’est autorisé par cette décision ; toute modification de la frontière d’autorisation relève d’un arbitrage séparé SECURITE_RLS_SITE_ID. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS, closes: false.**

L’audit « clé absente = défaut » est suffisant pour ce périmètre : les lecteurs recensés conservent le comportement existant, les nouvelles listes sont refusées par défaut et les épreuves couvrent les valeurs absentes, mal formées et intersites. Les sept échecs connus n’introduisent pas de blocage supplémentaire selon l’acquis `REGRESSION_PRODUIT_VS_BANC`.

La PR #173 est recevable comme base du fil caisse L1. Son approbation n’autorise toutefois ni sa fusion dans `production`, ni un déploiement ou une mutation Production. Ces gestes restent hors du prochain geste autorisé. Le chaînage L1 peut continuer hors Production conformément à `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO`.

RAIL_LU: 388f05c5a85a02c4d4748c28f2625b6b9e6f2027

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-CAISSE-RENFORT-20261102
REQUEST: request-4.md
BRANCHE_DU_LOT: handoff-continuite-20260920
HEAD: 388f05c5a85a02c4d4748c28f2625b6b9e6f2027
LEASE: aucun
GATE_STATE: G2, CI conforme au diagnostic — 7 échecs connus et aucun nouveau
PROOF_STATE: PROOF_VALID
CONDITIONS: Le fil caisse L1 doit conserver le refus par défaut, l’isolation par site et la RLS existante ; pilotesRenfort reste sans lecteur ni activation ; aucune migration, policy, grant, mutation, fusion ou déploiement Production n’est autorisé par cette décision ; toute modification de la frontière d’autorisation relève d’un arbitrage séparé SECURITE_RLS_SITE_ID.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Implémenter sur la base validée le fil caisse L1 consommant piloteCaisseCourant, avec ses épreuves pilote, non-pilote et isolation intersite, sans geste Production.
