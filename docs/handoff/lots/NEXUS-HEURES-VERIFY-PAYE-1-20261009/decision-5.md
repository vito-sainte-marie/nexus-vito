---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 5
author: ChatGPT
branch: handoff-continuite-20260920
decision: BLOCKED
closes: false
in_reply_to: request-10.md
---
# Décision sur request-10.md — BLOCKED (palier Frédéric), lot ouvert

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38431672310, commentaire 16:36:48Z), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6150381087. Matérialisé à la main par Claude à la demande de Frédéric (13/10/2026) : la CI ne dépose pas une décision BLOCKED / OWNER_NEXT Frédéric (DECISION_RESERVEE_A_UN_HUMAIN). Verdict reproduit tel quel ; il ne vaut aucun GO de fusion ni de déploiement._

## Texte de l'arbitre

La demande intégrale permet l’arbitrage malgré l’indisponibilité du connecteur.

Le changement métier est déjà tranché par Frédéric selon le choix (a) : un renfort déclaré au Q2 compte pour une seule journée, soit 7 h normales et 0 h supplémentaire, sans cumul avec une déclaration Q1. Cette règle est donc approuvée ; elle ne constitue pas une `DECISION_METIER_NON_ARBITREE`.

Les rouges de la suite complète sont diagnostiqués comme préexistants et identiques sur `production`. Conformément à `REGRESSION_PRODUIT_VS_BANC`, ils ne justifient pas une remontée humaine.

En revanche, la demande sollicite explicitement la fusion de la PR #105 vers `production` et son déploiement Pages. Ces gestes relèvent du palier humain `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`. L’approbation métier ne vaut donc pas autorisation d’exécuter ces opérations. La dépendance envers la PR #104 et la recette navigateur Q2 devront être vérifiées avant leur exécution.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT
DECISION: BLOCKED
CLOSES: false
LOT: NEXUS-HEURES-VERIFY-PAYE-1-20261009
REQUEST: request-10.md
HEAD: INACCESSIBLE
LEASE: aucun
GATE_STATE: G2, CI applicative SUCCESS ; recette navigateur Q2 non faite
PROOF_STATE: PROOF_VALID
CONDITIONS: Avant fusion, vérifier que la PR #104 est fusionnée ou que sa dépendance est autrement satisfaite, puis réaliser avec succès la recette navigateur Q2 sur l’URL servie.
BLOCKER: La fusion de la PR #105 vers production et le déploiement Pages demandés sont des opérations Production réservées à Frédéric.
STOP_REQUIRED: PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION
CAPACITE_REQUISE: autorisation de fusion et de déploiement Production
OWNER_NEXT: Frédéric
EXECUTANT_NEXT: Frédéric
ACTION_NEXT: Autoriser ou refuser nominativement la fusion de la PR #105 vers production après satisfaction de sa dépendance et de la recette Q2.


