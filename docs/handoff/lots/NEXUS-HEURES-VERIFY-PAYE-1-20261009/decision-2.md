---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-HEURES-VERIFY-PAYE-1-20261009
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-4.md
---
# Décision sur request-4.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38416158300), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6148255999. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-HEURES-VERIFY-PAYE-1-20261009`, `REQUEST` = `request-4.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `INACCESSIBLE`, `HEAD` = `INACCESSIBLE`, SHA du run `b038fd4d58f939bb6775a032b501723638d66f4d`, tête du rail `b038fd4d58f939bb6775a032b501723638d66f4d`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Conserver la qualification atomique_ou_procedure_speciale limitée au blob indiqué et documenter les deux faux positifs; corriger l’épreuve de provenance pour le manifeste réel de 306 migrations sans désactiver ni assouplir globalement la garde, puis obtenir une nouvelle exécution CI; vérifier et consigner la parité du portage manuel sur les deux moteurs et trois écrans; laisser Q4 et B hors implémentation; n’effectuer aucune migration, fusion ou mise en ligne Production sous cette décision. »). Elles lient l'exécutant suivant (`Claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

J’arbitre sur le texte intégral de `request-4.md` recopié dans le réveil ; le connecteur au rail n’est pas accessible dans cette session.

- L’état `atomique_ou_procedure_speciale` est accepté pour la migration au blob `fe205ec861e8c81d240d929b0b98343dd0f653cd`, compte tenu des deux faux positifs identifiés dans la garde. Cette qualification ne vaut pas dérogation générale.
- Le rouge de provenance 305→306 est diagnostiqué et reste du ressort de l’arbitre conformément à `REGRESSION_PRODUIT_VS_BANC`. Il peut être corrigé sans réveiller Frédéric, sans neutraliser ni assouplir globalement la garde.
- La réécriture manuelle du portage doit faire l’objet d’une vérification de parité fonctionnelle ciblée sur les deux moteurs et trois écrans concernés.
- Q4 et B restent explicitement ouverts et hors du périmètre du portage. Aucune sémantique nouvelle ne doit être introduite pour les résoudre implicitement.
- Cette décision n’autorise ni migration Supabase Production, ni fusion dans `production`, ni déploiement Pages. Chacun de ces gestes nécessitera un arbitrage Production distinct relevant respectivement de `SUPABASE_PRODUCTION_MUTATION` ou `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT  
DECISION: APPROVED_WITH_CONDITIONS  
CLOSES: false  
LOT: NEXUS-HEURES-VERIFY-PAYE-1-20261009  
REQUEST: request-4.md  
HEAD: INACCESSIBLE  
LEASE: aucun  
GATE_STATE: G1, CI non-regression rouge diagnostiquée à 31/32 et artefact vert  
PROOF_STATE: PROOF_REFRESH_REQUIRED  
CONDITIONS: Conserver la qualification atomique_ou_procedure_speciale limitée au blob indiqué et documenter les deux faux positifs; corriger l’épreuve de provenance pour le manifeste réel de 306 migrations sans désactiver ni assouplir globalement la garde, puis obtenir une nouvelle exécution CI; vérifier et consigner la parité du portage manuel sur les deux moteurs et trois écrans; laisser Q4 et B hors implémentation; n’effectuer aucune migration, fusion ou mise en ligne Production sous cette décision.  
BLOCKER: aucun  
STOP_REQUIRED: non  
CAPACITE_REQUISE: écriture, commit et push sur le rail Handoff  
OWNER_NEXT: Claude  
EXECUTANT_NEXT: Claude  
ACTION_NEXT: Matérialiser cette décision sur le rail avec l’outil Handoff.
