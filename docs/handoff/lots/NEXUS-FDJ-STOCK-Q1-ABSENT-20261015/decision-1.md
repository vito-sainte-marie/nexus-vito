---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38667761343), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6182563004. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-FDJ-STOCK-Q1-ABSENT-20261015`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `f2132e72586889d4350d8fd979ac92fc526a7d6b`, `HEAD` = `f2132e72586889d4350d8fd979ac92fc526a7d6b`, SHA du run `f2132e72586889d4350d8fd979ac92fc526a7d6b`, tête du rail `f2132e72586889d4350d8fd979ac92fc526a7d6b`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Table dédiée avec provenance auditée; site_id obligatoire et RLS multisite sans élargissement de permission; aucune donnée opérationnelle fictive; exhaustivité calculée sans coder 29 en dur; source uniquement complète et confirmée; conservation des contradictions; recette Test des cinq scénarios et de l’isolation multisite; aucune mutation Production ni action sur main ou production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

Le choix métier n’est pas nouveau : il est explicitement arbitré par le mandat de Frédéric reproduit dans la demande. Il n’y a donc pas de motif `DECISION_METIER_NON_ARBITREE`. Les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO` autorisent la construction et la recette hors Production sans nouveau GO humain.

L’approche par **table dédiée** est approuvée : elle sépare correctement la reconstitution logique des comptages physiques et évite de créer un quart ou une activité fictive.

Conditions vérifiables :

1. La table dédiée porte une provenance explicite et auditée : site, date/quart absent, quart source, comptage initial source, jeu, valeur reconstituée et horodatage.
2. `site_id` est obligatoire et protégé par les mêmes invariants d’isolation multisite et de RLS que les données FDJ existantes, sans élargissement de permission.
3. Aucun enregistrement fictif n’est créé dans `fdj_shifts`, `fdj_shift_counts`, les caisses, ventes, recettes, présences ou clôtures.
4. La garde vérifie l’ensemble attendu des jeux actifs ; le nombre 29 ne doit pas être codé en dur.
5. La reconstitution n’est produite que si l’ouverture du quart suivant est confirmée et si tous ses comptages initiaux attendus sont renseignés et non nuls.
6. Un comptage physique réel reste prioritaire sans suppression de la valeur reconstituée : les deux provenances sont conservées et la contradiction est signalée.
7. La recette Test couvre au minimum : quart absent avec source complète confirmée, quart suivant incomplet, quart suivant non confirmé, comptage réel contradictoire et isolation entre deux sites.
8. Aucune mutation Production, fusion ou promotion vers `main` ou `production` n’est autorisée par cette décision.

RAIL_LU: f2132e72586889d4350d8fd979ac92fc526a7d6b

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-FDJ-STOCK-Q1-ABSENT-20261015
REQUEST: request-1.md
HEAD: f2132e72586889d4350d8fd979ac92fc526a7d6b
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Table dédiée avec provenance auditée; site_id obligatoire et RLS multisite sans élargissement de permission; aucune donnée opérationnelle fictive; exhaustivité calculée sans coder 29 en dur; source uniquement complète et confirmée; conservation des contradictions; recette Test des cinq scénarios et de l’isolation multisite; aucune mutation Production ni action sur main ou production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Implémenter sur une branche dédiée issue de origin/handoff-continuite-20260920 la migration et le correctif conformes aux conditions.
