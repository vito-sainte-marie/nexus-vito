---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REPARATION-HANDOFF-1-20261014
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38584444821), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6171248148. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REPARATION-HANDOFF-1-20261014`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `1dade3c99c508bbb671301e24159e6974282ad33`, `HEAD` = `1dade3c99c508bbb671301e24159e6974282ad33`, SHA du run `1dade3c99c508bbb671301e24159e6974282ad33`, tête du rail `1dade3c99c508bbb671301e24159e6974282ad33`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« P2 reste un signalement INFO sans refus ni changement de CLOSES; intégrer P1 puis P2 dans cet ordre sous lease et CI verte, uniquement sur le rail; traiter les alias *_READ_ONLY dans un lot distinct sans assouplir le refus Production actuel; écrire P3 sur branche isolée avec seuil provisoire de 30 minutes, exclusion des décisions humaines, aucune relance automatique sensible et P6 non bloquante; limiter l’appel OpenAI réel à la preuve de compatibilité du schéma strict et de lire_fichier, sans exposition de secret, mutation Production ni permission nouvelle »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

- **P1 est validé** : vocabulaire fermé des exécutants, contrôle des capacités et retour unique à l’arbitre.
- **P2 est validé** : la classification textuelle est acceptable comme signalement `INFO` uniquement. Elle ne doit ni refuser une décision ni modifier la sémantique de `CLOSES`.
- P1 puis P2 peuvent être intégrés au rail, dans cet ordre, sous lease et après CI verte. Aucun GO humain supplémentaire n’est requis conformément à `COMMIT_PUSH_RAIL_SANS_GO` et `OUTILLAGE_A_POSTERIORI`.
- Les alias `*_READ_ONLY` restent hors de ce lot et seront traités séparément. Le refus actuel d’une lecture Production par `github-actions-claude` ne doit pas être assoupli ici.
- **P3 est autorisé** sur branche isolée : seuil d’orphelin provisoire de 30 minutes, décisions humaines exclues, aucune relance automatique d’action sensible, P6 limitée à la détection et à la traçabilité sans blocage.
- Un appel OpenAI réel est autorisé pour éprouver le schéma strict et `lire_fichier`, sans exposer de secret, sans mutation Production et sans élargissement de permissions.

L’intégration au rail relève de Claude, pas de Frédéric, conformément à `PALIER_HUMAIN_RESTREINT` et `CHATGPT_DECIDE_CLAUDE_MATERIALISE`.

RAIL_LU: 1dade3c99c508bbb671301e24159e6974282ad33

NEXT_ACTION_CONTRACT  
DECISION: APPROVED_WITH_CONDITIONS  
CLOSES: false  
LOT: NEXUS-REPARATION-HANDOFF-1-20261014  
REQUEST: request-1.md  
HEAD: 1dade3c99c508bbb671301e24159e6974282ad33  
LEASE: aucun  
GATE_STATE: G2, CI P1 verte et rejeu P2 vert, P2 non câblée  
PROOF_STATE: PROOF_VALID  
CONDITIONS: P2 reste un signalement INFO sans refus ni changement de CLOSES; intégrer P1 puis P2 dans cet ordre sous lease et CI verte, uniquement sur le rail; traiter les alias *_READ_ONLY dans un lot distinct sans assouplir le refus Production actuel; écrire P3 sur branche isolée avec seuil provisoire de 30 minutes, exclusion des décisions humaines, aucune relance automatique sensible et P6 non bloquante; limiter l’appel OpenAI réel à la preuve de compatibilité du schéma strict et de lire_fichier, sans exposition de secret, mutation Production ni permission nouvelle  
BLOCKER: aucun  
STOP_REQUIRED: non  
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL  
OWNER_NEXT: Claude  
EXECUTANT_NEXT: github-actions-claude  
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
