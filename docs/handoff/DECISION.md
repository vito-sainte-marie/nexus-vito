<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CAISSE-RENFORT-20261102/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6582331750
---
# Décision sur request-3.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41480909925), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6582331750. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-CAISSE-RENFORT-20261102`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `179c7ac681a39d1508934d1f42e9d44ab54b269b`, `HEAD` = `179c7ac681a39d1508934d1f42e9d44ab54b269b`, SHA du run `179c7ac681a39d1508934d1f42e9d44ab54b269b`, tête du rail `179c7ac681a39d1508934d1f42e9d44ab54b269b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Le contrôle côté page reste un mécanisme de déploiement pilote et non une autorisation de sécurité ; absence de clé, valeur mal formée, liste vide ou identifiant absent doivent conserver le fil actuel ; pilotesRenfort ne doit être lu par aucun écran avant L3 ; les épreuves sur Test doivent couvrir pilote caisse, non-pilote, refus par défaut et isolation intersite ; aucune migration, policy, grant, mutation Production, fusion ou déploiement Production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La conception est approuvée sous conditions. La clé additive et les deux listes sont compatibles avec le refus par défaut et l’isolation par site. `pilotesRenfort` peut être créée dès L1, mais doit rester sans lecteur fonctionnel jusqu’à L3.

Le contrôle côté page est suffisant uniquement comme mécanisme de déploiement pilote, pas comme frontière d’autorisation. Cette conclusion repose sur le fait établi qu’il n’accorde aucun droit de lecture ou d’écriture supplémentaire. Toute nouvelle capacité imposerait une nouvelle frontière serveur et un arbitrage `SECURITE_RLS_SITE_ID`.

Les étapes 3 et 4 sur Test sont autorisées conformément à `PREAUTORISATIONS_CLAUDE` et `PALIER_HUMAIN_RESTREINT`. Aucune autorité sur Production, `main`, une migration, une policy ou un grant n’en découle.

RAIL_LU: 179c7ac681a39d1508934d1f42e9d44ab54b269b

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-CAISSE-RENFORT-20261102
REQUEST: request-3.md
BRANCHE_DU_LOT: handoff-continuite-20260920
HEAD: 179c7ac681a39d1508934d1f42e9d44ab54b269b
LEASE: aucun
GATE_STATE: G1, CI non exécutée pour cette conception
PROOF_STATE: PROOF_VALID
CONDITIONS: Le contrôle côté page reste un mécanisme de déploiement pilote et non une autorisation de sécurité ; absence de clé, valeur mal formée, liste vide ou identifiant absent doivent conserver le fil actuel ; pilotesRenfort ne doit être lu par aucun écran avant L3 ; les épreuves sur Test doivent couvrir pilote caisse, non-pilote, refus par défaut et isolation intersite ; aucune migration, policy, grant, mutation Production, fusion ou déploiement Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Implémenter sur la branche du lot le contrôle fail-closed de pilotesCaisse et ses tests automatisés, sans activer pilotesRenfort.
