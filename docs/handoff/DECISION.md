<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-CARBURANTS-VISUEL-1-20261014/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: NEXUS-CARBURANTS-VISUEL-1-20261014
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38656144643), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6181019943. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `NEXUS-CARBURANTS-VISUEL-1-20261014`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `f4fabd27b395c196819d5fcbe0d2fbb93a9afcc4`, `HEAD` = `f4fabd27b395c196819d5fcbe0d2fbb93a9afcc4`, SHA du run `f4fabd27`, tête du rail `f4fabd27`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Effectuer sur Test une recette authentifiée avec données représentatives aux largeurs 1280, 820 et 390 px ; vérifier la distinction visuelle SP95/Gasoil/GNR, l’absence de débordement ou de régression fonctionnelle, puis joindre les captures et le résultat à une demande de clôture. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

Réponse de l'arbitre (ChatGPT, via l'API, run 38656144643). Contrat validé par le relais ; matérialisation par la CI si NEXUS_MATERIALISATION_CI=arme, sinon par Claude.

Verdict : **APPROVED_WITH_CONDITIONS**. Le changement applicatif est limité à la présentation, les couleurs prescrites sont respectées et la CI est verte. Les neuf échecs locaux sont connus et sans régression, conformément à l’acquis `REGRESSION_PRODUIT_VS_BANC`.

La validation visuelle sur Test ne nécessite pas Frédéric : les acquis `PALIER_HUMAIN_RESTREINT` et `PREAUTORISATIONS_CLAUDE` permettent à Claude d’effectuer la recette navigateur Test. Le lot reste ouvert jusqu’à cette recette authentifiée aux trois largeurs. Cette approbation ne confère aucune autorité sur `main` ou Production.

RAIL_LU: f4fabd27b395c196819d5fcbe0d2fbb93a9afcc4

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: NEXUS-CARBURANTS-VISUEL-1-20261014
REQUEST: request-2.md
HEAD: f4fabd27b395c196819d5fcbe0d2fbb93a9afcc4
LEASE: aucun
GATE_STATE: G1, CI SUCCESS
PROOF_STATE: PROOF_VALID
CONDITIONS: Effectuer sur Test une recette authentifiée avec données représentatives aux largeurs 1280, 820 et 390 px ; vérifier la distinction visuelle SP95/Gasoil/GNR, l’absence de débordement ou de régression fonctionnelle, puis joindre les captures et le résultat à une demande de clôture.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: SUPABASE_TEST_LECTURE
OWNER_NEXT: Claude
EXECUTANT_NEXT: session-claude-habilitee
ACTION_NEXT: Exécuter la recette visuelle authentifiée sur Test aux trois largeurs et déposer ses preuves dans une demande de clôture.

<!-- nexus-arbitrage: 38251e489ea097c6 -->
