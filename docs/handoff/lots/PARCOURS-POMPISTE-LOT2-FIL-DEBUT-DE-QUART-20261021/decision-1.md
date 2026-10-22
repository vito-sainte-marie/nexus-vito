---
protocol: nexus-handoff/2
kind: decision
lot_id: PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6329651118
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 39699510616), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6329651118. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `8810174a991c3efd5d62d331e4d92e19f9115796`, `HEAD` = `8810174a991c3efd5d62d331e4d92e19f9115796`, SHA du run `8810174a991c3efd5d62d331e4d92e19f9115796`, tête du rail `8810174a991c3efd5d62d331e4d92e19f9115796`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Mesurer après fetch le SHA exact de origin/production et créer le worktree depuis cette ref; rester strictement dans le fil et le routage décrits, sans SQL, migration, pointage ni correction du lot 3; démontrer par épreuves rouges puis vertes et mutations les trois étapes, la reprise des brouillons, la sortie commune et l’absence des écrans intermédiaires; effectuer la recette Test au format téléphone avec les mesures avant/après; ouvrir uniquement une PR brouillon vers production, sans fusion, promotion ni déploiement. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

La demande est **APPROVED_WITH_CONDITIONS**. Le choix métier a déjà été rendu par Frédéric et le lot ne comporte ni mutation Supabase Production, ni sécurité/RLS, ni secret, ni fusion ou déploiement. Les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` autorisent donc l’exécution sans nouveau GO humain.

La préparation du code, les tests, la recette Test et l’ouverture d’une PR brouillon sont autorisés. Le palier `PRODUCTION_FUSION_DEPLOIEMENT_PROMOTION` demeure réservé à une demande ultérieure portant effectivement sur la fusion, la promotion ou le déploiement.

RAIL_LU: 8810174a991c3efd5d62d331e4d92e19f9115796

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: PARCOURS-POMPISTE-LOT2-FIL-DEBUT-DE-QUART-20261021
REQUEST: request-1.md
HEAD: 8810174a991c3efd5d62d331e4d92e19f9115796
LEASE: aucun
GATE_STATE: G0, CI non lancée
PROOF_STATE: PROOF_VALID
CONDITIONS: Mesurer après fetch le SHA exact de origin/production et créer le worktree depuis cette ref; rester strictement dans le fil et le routage décrits, sans SQL, migration, pointage ni correction du lot 3; démontrer par épreuves rouges puis vertes et mutations les trois étapes, la reprise des brouillons, la sortie commune et l’absence des écrans intermédiaires; effectuer la recette Test au format téléphone avec les mesures avant/après; ouvrir uniquement une PR brouillon vers production, sans fusion, promotion ni déploiement.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
