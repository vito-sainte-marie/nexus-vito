---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-2.md
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38481291656), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6157008223. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REGUL-GROUPES-1-20261013`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `INACCESSIBLE`, `HEAD` = `INACCESSIBLE`, SHA du run `f6ae64b7a9c256895fc0c6acabf0ab729e4313b9`, tête du rail `f6ae64b7a9c256895fc0c6acabf0ab729e4313b9`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Avant toute proposition d’exécution, comparer la définition Production de _regul_tiroir_detail au texte attendu et documenter les écarts; relire les six fonctions utilisant select … into ou %rowtype et démontrer l’absence de dépendance incompatible à la forme des lignes; rejouer les scénarios existants sur une copie représentative de Production avec la migration seule et consigner les résultats, y compris la réversibilité tant que la table des groupes reste vide. »). Elles lient l'exécutant suivant (`Claude via le canal Production en lecture seule`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

J’arbitre sur le texte intégral recopié dans le réveil, le connecteur au rail n’étant pas accessible dans cette session.

**Décision : APPROVED_WITH_CONDITIONS.** Le raisonnement établit une compatibilité plausible, mais les trois limites explicitement déclarées empêchent de considérer la condition 5 comme démontrée avant toute proposition d’exécution. Les vérifications complémentaires sont donc requises. Elles restent hors palier humain tant qu’elles sont limitées à des lectures et à un rejeu sur copie, sans mutation, fusion ni déploiement Production.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT  
DECISION: APPROVED_WITH_CONDITIONS  
CLOSES: true  
LOT: NEXUS-REGUL-GROUPES-1-20261013  
REQUEST: request-2.md  
HEAD: INACCESSIBLE  
LEASE: aucun  
GATE_STATE: G2, CI de la PR #112 verte  
PROOF_STATE: PROOF_REFRESH_REQUIRED  
CONDITIONS: Avant toute proposition d’exécution, comparer la définition Production de `_regul_tiroir_detail` au texte attendu et documenter les écarts; relire les six fonctions utilisant `select … into` ou `%rowtype` et démontrer l’absence de dépendance incompatible à la forme des lignes; rejouer les scénarios existants sur une copie représentative de Production avec la migration seule et consigner les résultats, y compris la réversibilité tant que la table des groupes reste vide.  
BLOCKER: aucun pour poursuivre les vérifications; la preuve de compatibilité de l’intervalle « migration posée, code non déployé » reste incomplète pour une future proposition d’exécution  
STOP_REQUIRED: non  
CAPACITE_REQUISE: lecture seule Supabase Production  
OWNER_NEXT: Claude  
EXECUTANT_NEXT: Claude via le canal Production en lecture seule  
ACTION_NEXT: Comparer la définition Production de `_regul_tiroir_detail` au texte attendu par la migration et consigner tout écart sémantique.
