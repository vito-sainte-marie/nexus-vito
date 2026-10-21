<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-OCR-20261021/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-OCR-20261021
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6327852170
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39685765870), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6327852170. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-OCR-20261021`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `3120b2c7a52cd5da4aed0daa773513bd5fb94088`, `HEAD` = `3120b2c7a52cd5da4aed0daa773513bd5fb94088`, SHA du run `3120b2c7a52cd5da4aed0daa773513bd5fb94088`, tête du rail `3120b2c7a52cd5da4aed0daa773513bd5fb94088`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Ne créer aucun canal Broadcast ou Realtime ; limiter le changement au polling toutes les secondes et au lecteur Vision résident avec relance et fallback ponctuel ; versionner la source mais aucun binaire ni secret ; conserver l’absence de préremplissage et le bouton « Utiliser » ; mesurer sur environ quinze vraies photos en Test la latence de bout en bout et le taux de lecture exacte par volume ; recalibrer et consigner le seuil provisoire de 0,5 ; si le délai dépasse 3 s, rapporter la mesure sans ouvrir d’autre canal ; ne réaliser aucun SQL, migration, changement RLS, fusion vers main ou production, ni déploiement Production dans ce périmètre. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La modification de périmètre est **APPROVED_WITH_CONDITIONS**. Elle réduit la surface de sécurité en abandonnant Broadcast/Realtime et n’introduit ni migration, ni RLS, ni opération Production. Le polling à une seconde et le lecteur Vision résident peuvent être réalisés sur Test.

Le seuil de confiance 0,5 est accepté comme seuil expérimental provisoire, à condition qu’il ne provoque aucun préremplissage automatique et qu’il soit recalibré sur la quinzaine de photos. L’objectif de trois secondes est un critère de mesure, non une autorisation d’ouvrir un autre canal s’il n’est pas atteint.

Les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent. Aucun motif de STOP_REQUIRED n’est constitué.

RAIL_LU: 3120b2c7a52cd5da4aed0daa773513bd5fb94088

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-OCR-20261021
REQUEST: request-4.md
HEAD: 3120b2c7a52cd5da4aed0daa773513bd5fb94088
LEASE: aucun
GATE_STATE: G0, CI non exécutée pour cette modification
PROOF_STATE: PROOF_VALID
CONDITIONS: Ne créer aucun canal Broadcast ou Realtime ; limiter le changement au polling toutes les secondes et au lecteur Vision résident avec relance et fallback ponctuel ; versionner la source mais aucun binaire ni secret ; conserver l’absence de préremplissage et le bouton « Utiliser » ; mesurer sur environ quinze vraies photos en Test la latence de bout en bout et le taux de lecture exacte par volume ; recalibrer et consigner le seuil provisoire de 0,5 ; si le délai dépasse 3 s, rapporter la mesure sans ouvrir d’autre canal ; ne réaliser aucun SQL, migration, changement RLS, fusion vers main ou production, ni déploiement Production dans ce périmètre.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
