<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/SECURITE-DEFINER-ETAPE1-20261018/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: SECURITE-DEFINER-ETAPE1-20261018
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39132301323), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6250582137. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `SECURITE-DEFINER-ETAPE1-20261018`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `3f936bffb30b7a5b1330c1e319c49ea14fcfec07`, `HEAD` = `3f936bffb30b7a5b1330c1e319c49ea14fcfec07`, SHA du run `3f936bffb30b7a5b1330c1e319c49ea14fcfec07`, tête du rail `3f936bffb30b7a5b1330c1e319c49ea14fcfec07`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Cibler exclusivement Supabase Test udljdqxerrbbbajxubfn ; immédiatement avant exécution, vérifier les 17 signatures, SECURITY DEFINER et search_path=public, puis consigner droits anon/authenticated et tgenabled ; exécuter les 17 ALTER FUNCTION proposés dans une transaction unique, sans autre instruction, avec annulation intégrale si une précondition diverge ; vérifier et consigner les sept postconditions de request-2.md avant toute étape suivante ; ne faire aucun GRANT, REVOKE, changement nexus_ci_recette, migration de dépôt, fusion ou mutation Production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

L’opération réduit un risque SECURITY DEFINER sans modifier les privilèges, RLS, `site_id` ni la Production. Elle relève de la préautorisation `PREAUTORISATIONS_CLAUDE` pour les mutations sur Test. Aucun motif de STOP humain n’est constitué : le changement corrige une surface d’attaque au lieu de l’élargir.

Le lot reste ouvert jusqu’à consignation des postconditions après exécution.

RAIL_LU: 3f936bffb30b7a5b1330c1e319c49ea14fcfec07

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: SECURITE-DEFINER-ETAPE1-20261018
REQUEST: request-2.md
HEAD: 3f936bffb30b7a5b1330c1e319c49ea14fcfec07
LEASE: aucun
GATE_STATE: G1, CI non mesurée et non requise avant matérialisation
PROOF_STATE: PROOF_REFRESH_REQUIRED
CONDITIONS: Cibler exclusivement Supabase Test udljdqxerrbbbajxubfn ; immédiatement avant exécution, vérifier les 17 signatures, SECURITY DEFINER et search_path=public, puis consigner droits anon/authenticated et tgenabled ; exécuter les 17 ALTER FUNCTION proposés dans une transaction unique, sans autre instruction, avec annulation intégrale si une précondition diverge ; vérifier et consigner les sept postconditions de request-2.md avant toute étape suivante ; ne faire aucun GRANT, REVOKE, changement nexus_ci_recette, migration de dépôt, fusion ou mutation Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
