---
protocol: nexus-handoff/2
kind: decision
lot_id: PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6365821592
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39959922904), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6365821592. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `487156b1c1dc330d264d6300c8a6ad10350ed67b`, `HEAD` = `487156b1c1dc330d264d6300c8a6ad10350ed67b`, SHA du run `487156b1c1dc330d264d6300c8a6ad10350ed67b`, tête du rail `487156b1c1dc330d264d6300c8a6ad10350ed67b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Limiter l’Inventaire au retrait du second chargement du plan et à la parallélisation des chargements réellement indépendants, sans RPC ; prouver au navigateur, sur le même compte et le même quart, le chronométrage avant/après, le chargement unique du plan et l’identité des produits et quantités attendues ; prouver pour Missions que « disponibles » est déplié seulement en l’absence de mission obligatoire et que le comportement existant est conservé lorsqu’il y en a ; pour le nettoyage Test, imposer refus de Production et de tout autre projet, simulation par défaut, exécution explicite, bornes par identifiants, affichage préalable exact des lignes et absence de retrait des services créés par d’autres auteurs ; aucune migration, fusion, promotion ou écriture Production. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Les trois volets sont approuvés. Aucun motif du palier Frédéric n’est déclenché : le nettoyage est limité à Test, borné aux données de recette créées dans ce chantier, et exclut explicitement Production.

L’exécution est confiée à `session-claude-habilitee`, qui détient les capacités nécessaires pour le rail, la recette navigateur et les écritures Test. L’acquis `PREAUTORISATIONS_CLAUDE` autorise ces opérations sans nouveau GO humain ; `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent également.

La mesure navigateur avant/après demandée est bien une condition de clôture du volet Inventaire. Elle doit être réalisée sur le même compte et le même quart, sans annoncer de gain non mesuré.

RAIL_LU: 487156b1c1dc330d264d6300c8a6ad10350ed67b

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: PARCOURS-POMPISTE-LOT3-INVENTAIRE-MISSIONS-20261023
REQUEST: request-1.md
HEAD: 487156b1c1dc330d264d6300c8a6ad10350ed67b
LEASE: aucun
GATE_STATE: G0, CI non déclenchée — aucun code écrit
PROOF_STATE: PROOF_VALID
CONDITIONS: Limiter l’Inventaire au retrait du second chargement du plan et à la parallélisation des chargements réellement indépendants, sans RPC ; prouver au navigateur, sur le même compte et le même quart, le chronométrage avant/après, le chargement unique du plan et l’identité des produits et quantités attendues ; prouver pour Missions que « disponibles » est déplié seulement en l’absence de mission obligatoire et que le comportement existant est conservé lorsqu’il y en a ; pour le nettoyage Test, imposer refus de Production et de tout autre projet, simulation par défaut, exécution explicite, bornes par identifiants, affichage préalable exact des lignes et absence de retrait des services créés par d’autres auteurs ; aucune migration, fusion, promotion ou écriture Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Matérialiser cette décision avec `outils/handoff.js decision --auteur ChatGPT` sur le rail lu.
