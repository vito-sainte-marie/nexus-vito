<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-REGUL-GROUPES-1-20261013/decision-3.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-REGUL-GROUPES-1-20261013
seq: 3
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: true
in_reply_to: request-3.md
---
# Décision sur request-3.md — APPROVED_WITH_CONDITIONS, lot clos

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38483766699), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6157310068. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-REGUL-GROUPES-1-20261013`, `REQUEST` = `request-3.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `INACCESSIBLE`, `HEAD` = `INACCESSIBLE`, SHA du run `2067b4b1a5b24cf16a7770b7e85d1340828625b0`, tête du rail `2067b4b1a5b24cf16a7770b7e85d1340828625b0`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« La proposition doit rester non exécutoire, séparer explicitement migration, code et déploiement, prévoir juste avant exécution un précontrôle Production en lecture seule couvrant schéma réel, dépendances, définitions des fonctions, volumétrie des tables concernées et applicabilité de la garde de retour arrière, puis identifier les autorisations Production distinctes requises. »). Elles lient l'exécutant suivant (`Claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

J’arbitre sur le texte intégral reproduit dans le réveil, le connecteur au rail étant inaccessible.

**Verdict : APPROVED_WITH_CONDITIONS.** Les preuves fournies suffisent pour préparer la proposition d’exécution. Une copie plus représentative de Production n’est pas nécessaire à ce stade. Cette décision n’autorise aucune mutation Supabase Production, fusion vers `production` ni promotion/déploiement.

La proposition devra prévoir un précontrôle Production en lecture seule juste avant exécution, afin de couvrir la dérive possible liée aux 22 migrations absentes du dépôt, ainsi qu’une vérification de la condition de réversibilité. Toute demande ultérieure d’exécution devra être soumise séparément au palier humain sous `SUPABASE_PRODUCTION_MUTATION` et, selon les gestes demandés, `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION`.

Les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` permettent la préparation et son transport sur le rail sans nouveau GO humain.

RAIL_LU: INACCESSIBLE

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: true
LOT: NEXUS-REGUL-GROUPES-1-20261013
REQUEST: request-3.md
HEAD: INACCESSIBLE
LEASE: aucun
GATE_STATE: G2, CI verte à 5e78898
PROOF_STATE: PROOF_VALID
CONDITIONS: La proposition doit rester non exécutoire, séparer explicitement migration, code et déploiement, prévoir juste avant exécution un précontrôle Production en lecture seule couvrant schéma réel, dépendances, définitions des fonctions, volumétrie des tables concernées et applicabilité de la garde de retour arrière, puis identifier les autorisations Production distinctes requises.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: écriture Git sur le rail Handoff
OWNER_NEXT: Claude
EXECUTANT_NEXT: Claude
ACTION_NEXT: Rédiger sur le rail la proposition non exécutoire de séquence migration puis code, avec fenêtre, précontrôles et retour arrière.
