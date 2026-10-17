---
protocol: nexus-handoff/2
kind: decision
lot_id: JOURNAL-PISTE-20261017
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39073128856), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6241869124. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `JOURNAL-PISTE-20261017`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `ff698da7e344accd76935f9813c58c2c7066801e`, `HEAD` = `ff698da7e344accd76935f9813c58c2c7066801e`, SHA du run `ff698da7e344accd76935f9813c58c2c7066801e`, tête du rail `ff698da7e344accd76935f9813c58c2c7066801e`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Aucun SQL ne doit être exécuté avant un nouvel arbitrage portant sur le SQL exact ; la prochaine demande doit présenter la migration complète, les politiques RLS, les révocations et grants, les trois fonctions SECURITY DEFINER avec search_path fixé et contrôle fail-closed, le mécanisme exact de planification et ses permissions, ainsi que les preuves rejouables avant/après couvrant anon, pompiste, manager d’un autre site, autorisations manager/gérant du bon site et refus de UPDATE/DELETE/TRUNCATE ; le site doit être dérivé de l’identité de l’appelant et tout paramètre site éventuel doit être supprimé ou vérifié sans jamais faire autorité ; périmètre Supabase Test exclusivement, sans fusion, déploiement ni mutation Production ; aucune alerte en litres ne doit être déclarée fiable avant validation physique de l’échelle. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**DECISION: APPROVED_WITH_CONDITIONS**

L’instruction de préparation est approuvée ; elle ne constitue aucun GO d’exécution SQL ni d’octroi de permissions. Conformément à `DELEGATION_ARBITRE`, cet arbitrage ne requiert pas de confirmation supplémentaire.

Le prochain examen devra porter sur le SQL exact et les preuves rejouables avant toute mutation, en respectant les décisions métier déjà rendues. En particulier, le SQL devra résoudre explicitement la contradiction apparente entre un paramètre `site` et l’exigence que le site soit déduit de l’appelant : aucun identifiant de site fourni par l’appelant ne pourra faire autorité.

RAIL_LU: ff698da7e344accd76935f9813c58c2c7066801e

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: JOURNAL-PISTE-20261017
REQUEST: request-1.md
HEAD: ff698da7e344accd76935f9813c58c2c7066801e
LEASE: aucun
GATE_STATE: G0, CI non mesurée
PROOF_STATE: PROOF_REFRESH_REQUIRED
CONDITIONS: Aucun SQL ne doit être exécuté avant un nouvel arbitrage portant sur le SQL exact ; la prochaine demande doit présenter la migration complète, les politiques RLS, les révocations et grants, les trois fonctions SECURITY DEFINER avec search_path fixé et contrôle fail-closed, le mécanisme exact de planification et ses permissions, ainsi que les preuves rejouables avant/après couvrant anon, pompiste, manager d’un autre site, autorisations manager/gérant du bon site et refus de UPDATE/DELETE/TRUNCATE ; le site doit être dérivé de l’identité de l’appelant et tout paramètre site éventuel doit être supprimé ou vérifié sans jamais faire autorité ; périmètre Supabase Test exclusivement, sans fusion, déploiement ni mutation Production ; aucune alerte en litres ne doit être déclarée fiable avant validation physique de l’échelle.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Préparer et déposer sur le rail une nouvelle demande contenant le SQL exact et les preuves de sécurité rejouables, sans exécuter la migration.
