---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-QUART-QUALIF-20261016
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38842213500), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6206922152. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-QUART-QUALIF-20261016`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `0eaaa981f8efae90504fe0c2fc1ce3c67636ae4c`, `HEAD` = `0eaaa981f8efae90504fe0c2fc1ce3c67636ae4c`, SHA du run `0eaaa981f8efae90504fe0c2fc1ce3c67636ae4c`, tête du rail `0eaaa981f8efae90504fe0c2fc1ce3c67636ae4c`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Qualification limitée au SHA a06c2c15ae27a13681ad5a2c1cb3ffed6b11540b et au blob d7ac18acd2cb8b82d606f52e6c35ac71346df4e2 ; avant toute demande de geste Production, consigner une recette navigateur Test réussie, maintenir la CI verte et reconfirmer en lecture seule les hypothèses Production ; tout changement du candidat, du blob ou de ces hypothèses exige une nouvelle qualification. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Verdict

**APPROVED_WITH_CONDITIONS.**

La qualification `atomique_ou_procedure_speciale` est acceptée pour le candidat et le blob exactement identifiés. Le remplacement d’une fonction de déclencheur préexistante justifie une procédure spéciale à ordre strict plutôt qu’un affaiblissement de la garde additive.

Les preuves Node, SQL sous rollback et CI sont valides. Conformément aux acquis `DELEGATION_ARBITRE` et `PALIER_HUMAIN_RESTREINT`, cette qualification documentaire est arbitrée ici sans confirmation supplémentaire.

Avant toute demande de geste Production :

1. la recette navigateur sur Test doit être réussie et consignée ;
2. la CI doit rester verte sur le SHA candidat exact ;
3. un précontrôle Production en lecture seule doit reconfirmer les hypothèses documentées concernant la fonction, son empreinte, le déclencheur unique et l’état des migrations ;
4. toute modification du SHA candidat, du blob de migration ou des hypothèses Production impose une nouvelle qualification.

Ce verdict n’autorise ni fusion vers `production`, ni migration Supabase Production, ni déploiement. Ces gestes relèveront respectivement des paliers `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` ou `SUPABASE_PRODUCTION_MUTATION`.

RAIL_LU: 0eaaa981f8efae90504fe0c2fc1ce3c67636ae4c

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: NEXUS-QUART-QUALIF-20261016
REQUEST: request-1.md
HEAD: 0eaaa981f8efae90504fe0c2fc1ce3c67636ae4c
LEASE: aucun
GATE_STATE: G2, CI verte sur a06c2c15ae27a13681ad5a2c1cb3ffed6b11540b
PROOF_STATE: PROOF_VALID
CONDITIONS: Qualification limitée au SHA a06c2c15ae27a13681ad5a2c1cb3ffed6b11540b et au blob d7ac18acd2cb8b82d606f52e6c35ac71346df4e2 ; avant toute demande de geste Production, consigner une recette navigateur Test réussie, maintenir la CI verte et reconfirmer en lecture seule les hypothèses Production ; tout changement du candidat, du blob ou de ces hypothèses exige une nouvelle qualification.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
