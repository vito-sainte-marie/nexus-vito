<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6507555858
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40948806703), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6507555858. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `c794c01e66104595399f61bc66597c27a2f9e083`, `HEAD` = `c794c01e66104595399f61bc66597c27a2f9e083`, SHA du run `c794c01e66104595399f61bc66597c27a2f9e083`, tête du rail `c794c01e66104595399f61bc66597c27a2f9e083`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Livrer les points 1 et 2 atomiquement ; ne supprimer ni modifier les données existantes ; préserver l’étape 1 indépendamment du retrait de la carte et vérifier son saut lorsqu’un relevé du jour existe ; appliquer POSTE-006 exactement comme déjà confirmé, avec l’origine « manager », sans introduire de nouveau choix métier ; limiter l’analyse de JAUGEAGE_NOM et des drapeaux à la lecture du code ; exécuter les épreuves avec mutations et la recette sur Test ; n’effectuer aucune lecture, mutation, fusion, promotion, recette ou autre opération en Production sous cette décision. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

VERDICT: APPROVED_WITH_CONDITIONS

Le périmètre est approuvé. Le point 6 applique une règle métier déjà tranchée par Frédéric — POSTE-006 et l’origine « manager » — et ne constitue donc pas une `DECISION_METIER_NON_ARBITREE`.

Les points 1 et 2 doivent être livrés dans un même changement atomique afin qu’aucun état livrable ne supprime la seule porte « Je ne peux pas faire le jaugeage ». L’analyse de `JAUGEAGE_NOM` et des drapeaux reste une lecture de code sans mutation de base. Toute fusion, promotion, recette ou mutation en Production reste hors de cette décision et relève de `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` ou `SUPABASE_PRODUCTION_MUTATION`.

Les acquis `PALIER_HUMAIN_RESTREINT`, `DELEGATION_ARBITRE`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent.

RAIL_LU: c794c01e66104595399f61bc66597c27a2f9e083

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JAUGEAGE-CARBURANT-FIL-UNIQUE-20261029
REQUEST: request-1.md
BRANCHE_DU_LOT: jaugeage-carburant-fil-unique-20261029
HEAD: c794c01e66104595399f61bc66597c27a2f9e083
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Livrer les points 1 et 2 atomiquement ; ne supprimer ni modifier les données existantes ; préserver l’étape 1 indépendamment du retrait de la carte et vérifier son saut lorsqu’un relevé du jour existe ; appliquer POSTE-006 exactement comme déjà confirmé, avec l’origine « manager », sans introduire de nouveau choix métier ; limiter l’analyse de JAUGEAGE_NOM et des drapeaux à la lecture du code ; exécuter les épreuves avec mutations et la recette sur Test ; n’effectuer aucune lecture, mutation, fusion, promotion, recette ou autre opération en Production sous cette décision.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Implémenter sur la branche du lot le retrait atomique de la carte et le transfert du lien « impossible », avec POSTE-006 et l’origine « manager » conformes à la règle déjà tranchée.
