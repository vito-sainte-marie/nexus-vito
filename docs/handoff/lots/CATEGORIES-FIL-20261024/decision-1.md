---
protocol: nexus-handoff/2
kind: decision
lot_id: CATEGORIES-FIL-20261024
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6384625575
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40096925328), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6384625575. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `CATEGORIES-FIL-20261024`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `34dc45e1582b2028517f15eedf5d91a6f0c618a5`, `HEAD` = `34dc45e1582b2028517f15eedf5d91a6f0c618a5`, SHA du run `34dc45e1582b2028517f15eedf5d91a6f0c618a5`, tête du rail `34dc45e1582b2028517f15eedf5d91a6f0c618a5`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Remplacer uniquement la liste codée en dur par le paramétrage du site courant, limité aux produits actifs de la zone piste; conserver Écailles comme produit de Glaçons; exécuter le script exclusivement sur Test après contrôle du rollback et de son bornage aux deux produits; faire passer les trois épreuves annoncées et démontrer l’absence de nouvel échec par rapport à origin/production; aucune opération sur Production. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

1. Le périmètre est approuvé : le seul changement applicatif autorisé consiste à remplacer la liste codée en dur par la lecture du paramétrage de la station, bornée au site courant, aux produits actifs et à la zone piste. « Écailles » reste un produit de la catégorie « Glaçons ».
2. L’exécution du script sur **Test uniquement** est approuvée. Elle relève de `PREAUTORISATIONS_CLAUDE`, sous réserve de contrôler d’abord son mode rollback, puis de vérifier que l’exécution ne touche que les deux produits annoncés.
3. L’ordre Inventaire puis audit du langage est confirmé après ce lot, sous réserve des priorités générales déjà fixées par `PRIORITES_PORTEFEUILLE`.
4. Les sept échecs identiques à `origin/production` sont diagnostiqués et ne constituent pas une escalade, conformément à `REGRESSION_PRODUIT_VS_BANC`.

Conditions de clôture : aucune liste métier équivalente ne doit être réintroduite ailleurs ; les trois épreuves annoncées doivent passer ; la suite complète ne doit présenter aucun nouvel échec par rapport à la base Production mesurée ; toute fusion, promotion, écriture ou mutation Production reste exclue de cette décision.

RAIL_LU: 34dc45e1582b2028517f15eedf5d91a6f0c618a5

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: CATEGORIES-FIL-20261024
REQUEST: request-1.md
HEAD: 34dc45e1582b2028517f15eedf5d91a6f0c618a5
LEASE: aucun
GATE_STATE: G1, CI rouge diagnostiquée avec 7 échecs identiques à origin/production et aucun nouvel échec
PROOF_STATE: PROOF_REFRESH_REQUIRED
CONDITIONS: Remplacer uniquement la liste codée en dur par le paramétrage du site courant, limité aux produits actifs de la zone piste; conserver Écailles comme produit de Glaçons; exécuter le script exclusivement sur Test après contrôle du rollback et de son bornage aux deux produits; faire passer les trois épreuves annoncées et démontrer l’absence de nouvel échec par rapport à origin/production; aucune opération sur Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Implémenter sur la branche de travail le remplacement de CATEGORIES_FIL par la lecture bornée du paramétrage de la station.
