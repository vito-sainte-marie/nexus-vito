<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/decision-4.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-20261021
seq: 4
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-6.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6328965310
---
# Décision sur request-6.md — APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39694195184), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6328965310. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-20261021`, `REQUEST` = `request-6.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `9bd04f6d643b1b893d3c1e3a7ff292e76a8a9ac7`, `HEAD` = `9bd04f6d643b1b893d3c1e3a7ff292e76a8a9ac7`, SHA du run `9bd04f6d643b1b893d3c1e3a7ff292e76a8a9ac7`, tête du rail `9bd04f6d643b1b893d3c1e3a7ff292e76a8a9ac7`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« La clôture ne livre ni ne valide aucun candidat OCR; la suspension et les empreintes consignées restent la seule trace du travail; toute reprise se fait sous un nouveau lot JAUGEAGE-OCR-2 et exige avant livraison environ quinze photos réelles Test avec provenance et sans données personnelles, l’identification de la copie canonique, la calibration du seuil de confiance et la mesure de latence de bout en bout; la photo Test signalée avec données personnelles reste exclue. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

La clôture sans livraison est autorisée. Elle ne valide ni le candidat OCR, ni le seuil de confiance, ni les performances, et n’autorise aucune fusion, promotion ou livraison. La reprise devra se faire dans un nouveau lot avec les preuves terrain manquantes. La photo Test signalée comme contenant des données personnelles demeure exclue de toute preuve et de tout traitement OCR.

Les acquis `DELEGATION_ARBITRE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : aucun GO humain supplémentaire n’est requis pour matérialiser et consommer cette décision sur le rail.

RAIL_LU: 9bd04f6d643b1b893d3c1e3a7ff292e76a8a9ac7
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: JAUGEAGE-OCR-20261021
REQUEST: request-6.md
HEAD: 9bd04f6d643b1b893d3c1e3a7ff292e76a8a9ac7
LEASE: aucun
GATE_STATE: G0, CI non requise pour une clôture sans livraison
PROOF_STATE: PROOF_VALID
CONDITIONS: La clôture ne livre ni ne valide aucun candidat OCR; la suspension et les empreintes consignées restent la seule trace du travail; toute reprise se fait sous un nouveau lot JAUGEAGE-OCR-2 et exige avant livraison environ quinze photos réelles Test avec provenance et sans données personnelles, l’identification de la copie canonique, la calibration du seuil de confiance et la mesure de latence de bout en bout; la photo Test signalée avec données personnelles reste exclue.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision de clôture sur le rail avec outils/handoff.js decision --auteur ChatGPT.
