---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-RELECTURES-20261024
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6388888826
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40127747431), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6388888826. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-RELECTURES-20261024`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `47708fb3154c666a4acd2b98743325146bc544af`, `HEAD` = `47708fb3154c666a4acd2b98743325146bc544af`, SHA du run `47708fb3154c666a4acd2b98743325146bc544af`, tête du rail `47708fb3154c666a4acd2b98743325146bc544af`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Réaliser sur Test une mesure après comparable avec la build issue de 4454a943 et consigner au minimum le temps écran prêt, le nombre de requêtes et de vagues, les occurrences shifts et sites ainsi que le temps de préparation de sélection; le lot pourra ensuite être clôturé quel que soit le chiffre; si 3 s ne sont pas atteintes, traiter la préparation de sélection dans un lot séparé; tout nettoyage Test doit viser les identifiants exacts vérifiés et leurs dépendances, jamais Production; déposer Jaugeage Carburant comme lot séparé seulement après cette clôture; aucune fusion, promotion ou mise en Production »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le lot reste ouvert jusqu’à la mesure « après » sur Test. Il pourra être clôturé quel que soit le résultat chiffré, dès lors que la mesure est comparable et consignée. Si l’objectif de 3 s n’est pas atteint, l’optimisation de la préparation de sélection part dans un lot séparé et ne bloque pas cette clôture.

Les sept échecs de suite, identiques à `origin/production`, sont diagnostiqués et n’appellent pas d’escalade conformément à `REGRESSION_PRODUIT_VS_BANC`. La recette et les opérations sur Test sont préautorisées par `PREAUTORISATIONS_CLAUDE`.

« Jaugeage Carburant » peut être déposé comme lot séparé après la clôture de celui-ci. Aucune fusion, promotion ou mise en Production n’est autorisée par cette décision.

RAIL_LU: 47708fb3154c666a4acd2b98743325146bc544af

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-RELECTURES-20261024
REQUEST: request-2.md
HEAD: 47708fb3154c666a4acd2b98743325146bc544af
LEASE: aucun
GATE_STATE: G1, tests ciblés verts et suite complète baseline-equivalente avec 7 échecs connus; mesure après en attente
PROOF_STATE: PROOF_VALID
CONDITIONS: Réaliser sur Test une mesure après comparable avec la build issue de 4454a943 et consigner au minimum le temps écran prêt, le nombre de requêtes et de vagues, les occurrences shifts et sites ainsi que le temps de préparation de sélection; le lot pourra ensuite être clôturé quel que soit le chiffre; si 3 s ne sont pas atteintes, traiter la préparation de sélection dans un lot séparé; tout nettoyage Test doit viser les identifiants exacts vérifiés et leurs dépendances, jamais Production; déposer Jaugeage Carburant comme lot séparé seulement après cette clôture; aucune fusion, promotion ou mise en Production
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: SUPABASE_TEST_LECTURE
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Réaliser et consigner sur Test la mesure après comparable de la build issue de 4454a943.
