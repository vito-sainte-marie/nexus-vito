---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-RELECTURES-20261024
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6388644611
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40125950697), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6388644611. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-RELECTURES-20261024`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `a781e9d9b0cd727a5f46818424b58d6311552bb5`, `HEAD` = `a781e9d9b0cd727a5f46818424b58d6311552bb5`, SHA du run `a781e9d9b0cd727a5f46818424b58d6311552bb5`, tête du rail `a781e9d9b0cd727a5f46818424b58d6311552bb5`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Mémoïsation cloisonnée par site_id et date avec absence de donnée périmée prouvée; station_config et shifts regroupés seulement si Guardian démontre leur cumul; mesure Test avant/après comparable; dépliage automatique testé avec obligatoires soldées et non-dépliage avec obligatoire restante, sans empêcher le repli manuel; si 3 s ne sont pas atteintes, clore ce lot avec le chiffre et le poste dominant restant, toute optimisation du calcul de sélection relevant d’un lot distinct. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS.**

Le périmètre est cohérent : suppression des lectures redondantes sans changement du calcul, mutualisation conditionnelle fondée sur la mesure, puis correction du dépliage de « Disponibles ».

Arbitrages rendus :

1. Les regroupements de `station_config` et `shifts` sont autorisés uniquement si la mesure Guardian démontre leur cumul pendant une même ouverture.
2. La mémoïsation doit rester cloisonnée par `(site_id, date)` et ne produire ni contamination entre sites/dates ni donnée périmée après une mutation pertinente.
3. « Disponibles » peut s’ouvrir automatiquement lorsque toutes les missions obligatoires du jour sont validées ou lorsqu’il n’en existe aucune. L’ouverture automatique n’annule pas le choix manuel de replier.
4. Si les **3 secondes** ne sont pas atteintes, ce lot se clôt néanmoins sur la mesure obtenue, avec identification de la lecture ou du calcul restant dominant. L’optimisation interne du calcul de sélection sera un lot distinct, sans extension automatique du présent périmètre.
5. L’audit du langage reste ensuite un chantier de propositions seulement et suit `PRIORITES_PORTEFEUILLE`.
6. Cette approbation ne confère aucune autorité de fusion, déploiement, promotion ou mutation en Production.

Les preuves exigées à la clôture sont : comptage avant/après des lectures, mesure comparable sur Test, tests de cloisonnement du cache, cas « obligatoires soldées », cas « obligatoire restante », conservation du repli manuel et mutations vérifiées.

RAIL_LU: a781e9d9b0cd727a5f46818424b58d6311552bb5

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-RELECTURES-20261024
REQUEST: request-1.md
HEAD: a781e9d9b0cd727a5f46818424b58d6311552bb5
LEASE: aucun
GATE_STATE: G0, CI non lancée
PROOF_STATE: PROOF_VALID
CONDITIONS: Mémoïsation cloisonnée par site_id et date avec absence de donnée périmée prouvée; station_config et shifts regroupés seulement si Guardian démontre leur cumul; mesure Test avant/après comparable; dépliage automatique testé avec obligatoires soldées et non-dépliage avec obligatoire restante, sans empêcher le repli manuel; si 3 s ne sont pas atteintes, clore ce lot avec le chiffre et le poste dominant restant, toute optimisation du calcul de sélection relevant d’un lot distinct.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Ajouter le test compteur démontrant une seule lecture des ingrédients pour une génération suivie d’une réévaluation.
