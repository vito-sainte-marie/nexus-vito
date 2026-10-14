<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REPARATION-HANDOFF-1-20261014/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REPARATION-HANDOFF-1-20261014
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
---
# Décision sur request-3.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38596877763), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6172972523. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REPARATION-HANDOFF-1-20261014`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `7c638da35877428c95acdfd5861fb4ec014b65c8`, `HEAD` = `7c638da35877428c95acdfd5861fb4ec014b65c8`, SHA du run `7c638da35877428c95acdfd5861fb4ec014b65c8`, tête du rail `7c638da35877428c95acdfd5861fb4ec014b65c8`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« P8 doit commencer par la garde de preuve préalable; réutiliser classerArret; rester idempotente et append-only; limiter les commits automatiques au rail ou à la branche d’incident sous lease, sans relance ni récursion; préserver les arrêts de sécurité et interdire toute action sensible automatique; exiger EXPERIENCE.jsonl + promoted_rule + RULES.json + test GOV-002 pour clôturer un incident; soumettre la livraison et ses preuves à un nouvel arbitrage. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Décision : APPROVED_WITH_CONDITIONS**

P3 est validée telle que livrée : les conditions de `decision-2.md` sont prouvées, la CI du rail est verte sur `98ae9c41`, et les neuf échecs connus ne constituent pas une régression produit inexpliquée (`REGRESSION_PRODUIT_VS_BANC`).

P8 est autorisée sur branche isolée. Elle consomme les codes et classifications de P1/P3 sans les remplacer. Le commit automatique d’incident sur le rail est autorisé par `COMMIT_PUSH_RAIL_SANS_GO` et `DECISION5_CONDITION5_LEVEE`; il ne confère aucune autorité sur `main` ou Production. La règle de refus préalable formalise une exigence existante de preuve et ne constitue pas, dans ce périmètre, un changement de doctrine.

Conditions :
1. Commencer par la garde étroite refusant, avant appel à l’arbitre, une demande suivant une décision conditionnelle lorsqu’elle ne contient pas la section de preuve requise.
2. Réutiliser `classerArret` de P3, sans second classeur ni divergence de taxonomie.
3. Rendre l’enregistrement CI idempotent et append-only : identifiant stable par incident, absence de doublon au rejeu, aucun amendement, aucune réécriture d’historique.
4. Limiter les commits automatiques au rail ou à la branche d’incident, sous lease/concurrence contrôlée, sans déclencher de relance ni de boucle récursive.
5. Conserver les arrêts de sécurité comme arrêts effectifs. Aucune relance automatique d’une capacité sensible, aucune mutation Production, aucun secret ou élargissement de permission, aucune fusion vers `main` ou `production`, aucun appel OpenAI réel.
6. La clôture d’un incident doit être vérifiée par l’ensemble cohérent `EXPERIENCE.jsonl` + `promoted_rule` + règle `RULES.json` + test GOV-002.
7. Soumettre les changements et leurs épreuves à un nouvel arbitrage avant de clore le lot.

RAIL_LU: 7c638da35877428c95acdfd5861fb4ec014b65c8

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-REPARATION-HANDOFF-1-20261014
REQUEST: request-3.md
HEAD: 7c638da35877428c95acdfd5861fb4ec014b65c8
LEASE: aucun
GATE_STATE: G1, CI du rail verte sur 98ae9c41
PROOF_STATE: PROOF_VALID
CONDITIONS: P8 doit commencer par la garde de preuve préalable; réutiliser classerArret; rester idempotente et append-only; limiter les commits automatiques au rail ou à la branche d’incident sous lease, sans relance ni récursion; préserver les arrêts de sécurité et interdire toute action sensible automatique; exiger EXPERIENCE.jsonl + promoted_rule + RULES.json + test GOV-002 pour clôturer un incident; soumettre la livraison et ses preuves à un nouvel arbitrage.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
