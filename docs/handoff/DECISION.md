<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-CHAINE-INITIALISATION-20261027/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-CHAINE-INITIALISATION-20261027
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6439877863
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40490253113), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6439877863. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-CHAINE-INITIALISATION-20261027`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `7c9e306995ee80d0853467d7ece991eb2e2920c1`, `HEAD` = `7c9e306995ee80d0853467d7ece991eb2e2920c1`, SHA du run `7c9e306995ee80d0853467d7ece991eb2e2920c1`, tête du rail `7c9e306995ee80d0853467d7ece991eb2e2920c1`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Mesurer sur Test le chemin critique avant toute correction puis après, avec le même compte et le même quart ; préserver strictement les calculs et comportements métier ; ne réaliser aucune lecture ou écriture Production, fusion, déploiement ou promotion ; traiter les défauts de boucle dans un lot d’outillage distinct après celui-ci, sans élargissement de permission. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le lot s’exécute maintenant. `STATE.json` le désigne comme seul lot actif. Les lots liés au jaugeage présents au registre sont tous `DECISION_CONSOMMEE`, notamment `FIX-CARBURANT-CHRONO-JAUGEAGE-20261020` ; l’antériorité imposée est donc satisfaite.

Le lot d’outillage vient après ce lot métier. Conformément à `OUTILLAGE_A_POSTERIORI`, son diagnostic et ses corrections peuvent être traités séparément sans autorisation préalable, tant qu’ils n’élargissent aucune permission. Un élargissement relèverait alors de `SECRET_PERMISSION_SURFACE_SECURITE`.

RAIL_LU: 7c9e306995ee80d0853467d7ece991eb2e2920c1
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-CHAINE-INITIALISATION-20261027
REQUEST: request-2.md
BRANCHE_DU_LOT: inventaire-chaine-initialisation-20261027
HEAD: 7c9e306995ee80d0853467d7ece991eb2e2920c1
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Mesurer sur Test le chemin critique avant toute correction puis après, avec le même compte et le même quart ; préserver strictement les calculs et comportements métier ; ne réaliser aucune lecture ou écriture Production, fusion, déploiement ou promotion ; traiter les défauts de boucle dans un lot d’outillage distinct après celui-ci, sans élargissement de permission.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: SUPABASE_TEST_LECTURE
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Mesurer sur Test la durée et la séquence des lectures de la chaîne d’initialisation avant toute modification.
