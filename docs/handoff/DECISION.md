<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-PHOTO-20261021/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-PHOTO-20261021
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: NEEDS_EVIDENCE
closes: false
in_reply_to: request-3.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6322288208
---
# Décision sur request-3.md — NEEDS_EVIDENCE

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39643743121), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6322288208. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-PHOTO-20261021`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `e30257c350154bbe056dafff4ce154de6a38295b`, `HEAD` = `e30257c350154bbe056dafff4ce154de6a38295b`, SHA du run `e30257c350154bbe056dafff4ce154de6a38295b`, tête du rail `e30257c350154bbe056dafff4ce154de6a38295b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict. Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : HOLD.** Les preuves existantes restent valides, mais elles ne suffisent pas à clore le lot :

- le lien profond n’est pas vérifié jusqu’à l’arrivée sur l’écran visé après authentification ;
- la résolution 1080 × 1920 est démontrée, mais pas la lisibilité d’un écran Veeder-Root dans ces conditions ;
- la correction de résolution n’est pas encore en Production. Son éventuelle promotion relèvera ultérieurement du palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`, après validation complète sur Test.

Aucun nouveau GO humain n’est requis pour compléter la recette Test, conformément à `PALIER_HUMAIN_RESTREINT`. Les preuves déjà établies ne sont pas à refaire.

RAIL_LU: e30257c350154bbe056dafff4ce154de6a38295b

NEXT_ACTION_CONTRACT
DECISION: NEEDS_EVIDENCE
CLOSES: false
LOT: JAUGEAGE-PHOTO-20261021
REQUEST: request-3.md
HEAD: e30257c350154bbe056dafff4ce154de6a38295b
LEASE: aucun
GATE_STATE: G2, CI verte
PROOF_STATE: PROOF_VALID
CONDITIONS: aucune
BLOCKER: Il manque une recette iPhone sur l’aperçu Test établissant que le lien profond atteint l’écran visé après connexion et qu’une photo 1080 × 1920 de l’écran Veeder-Root est effectivement lisible.
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Consigner dans une nouvelle demande les résultats des deux contrôles iPhone Test manquants.
