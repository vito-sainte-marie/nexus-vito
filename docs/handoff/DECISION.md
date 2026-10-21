<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6329006995
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39694587458), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6329006995. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `aae24e9e389e01f3adb1b0d0ca9fcb22cec874a0`, `HEAD` = `aae24e9e389e01f3adb1b0d0ca9fcb22cec874a0`, SHA du run `aae24e9e389e01f3adb1b0d0ca9fcb22cec874a0`, tête du rail `aae24e9e389e01f3adb1b0d0ca9fcb22cec874a0`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Acquérir le lease avant toute écriture; partir de l’état courant mesuré de origin/production et consigner son SHA; ne modifier que NEXUS-Releves-Piste-v1.html et, si nécessaire, nexus-releves-piste.js; garantir la sortie vers l’Accueil sur tous les écrans énumérés sans perte des brouillons; n’affirmer une sauvegarde qu’après une écriture locale réellement réussie; produire les deux épreuves rouges puis vertes avec mutation de contrôle; effectuer la recette Test au format téléphone avec le compte pompiste; ouvrir uniquement une PR en brouillon vers production, sans fusion, promotion ni déploiement. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

DECISION: APPROVED_WITH_CONDITIONS

Le périmètre est précis, réversible et limité à Test et à une branche de travail. Il ne comporte ni mutation Supabase Production, ni secret, ni changement de doctrine. La PR en brouillon est autorisée ; toute fusion, promotion ou tout déploiement vers Production demeure au palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

Selon `STATE.json`, le lot `JAUGEAGE-OCR-20261021` est désormais `DECISION_CONSOMMEE`, contrairement à la prose historique de la demande. Il ne bloque donc pas ce lot, conformément à `SUJET_ETRANGER_NE_BLOQUE_PAS`. L’exécution, les tests, la recette Test, les commits et le push ne nécessitent aucun autre GO humain (`PALIER_HUMAIN_RESTREINT`, `COMMIT_PUSH_RAIL_SANS_GO`, `PREAUTORISATIONS_CLAUDE`).

RAIL_LU: aae24e9e389e01f3adb1b0d0ca9fcb22cec874a0

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: PARCOURS-POMPISTE-LOT1-RELEVES-PISTE-20261021
REQUEST: request-1.md
HEAD: aae24e9e389e01f3adb1b0d0ca9fcb22cec874a0
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Acquérir le lease avant toute écriture; partir de l’état courant mesuré de origin/production et consigner son SHA; ne modifier que NEXUS-Releves-Piste-v1.html et, si nécessaire, nexus-releves-piste.js; garantir la sortie vers l’Accueil sur tous les écrans énumérés sans perte des brouillons; n’affirmer une sauvegarde qu’après une écriture locale réellement réussie; produire les deux épreuves rouges puis vertes avec mutation de contrôle; effectuer la recette Test au format téléphone avec le compte pompiste; ouvrir uniquement une PR en brouillon vers production, sans fusion, promotion ni déploiement.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
