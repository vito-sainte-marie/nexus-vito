---
protocol: nexus-handoff/2
kind: decision
lot_id: MENU-ACCUEIL-EMPLOYE-20261030
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6522776105
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41054783024), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6522776105. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `MENU-ACCUEIL-EMPLOYE-20261030`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `db168abca412b33b43d0a22a916bc6c4964b40f9`, `HEAD` = `db168abca412b33b43d0a22a916bc6c4964b40f9`, SHA du run `db168abca412b33b43d0a22a916bc6c4964b40f9`, tête du rail `db168abca412b33b43d0a22a916bc6c4964b40f9`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Implémenter l’option A ; rester sur une modification d’interface sans colonne ni migration ; ne pas modifier l’exclusion roleDuJour !== 'renfort' ni les contrôles Inventaire de l’Accueil ; vérifier par tests les entrées du menu selon le poste, l’absence de Jaugeage et Index pour les employés, et la visibilité de la recherche réservée aux manager et gérant. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le périmètre réduit est validé comme base du développement. L’option **A** s’applique : le lien « Inventaire » reste actif pour le renfort, conformément à la décision déjà relayée demandant sa création telle quelle. L’option B introduirait au contraire un comportement différent. Aucun nouveau choix métier ne nécessite donc d’être soumis à Frédéric, conformément à `DELEGATION_ARBITRE` et `PALIER_HUMAIN_RESTREINT`.

Le lot reste strictement limité à l’interface : aucune colonne, migration, modification de l’applicabilité de l’inventaire sur l’Accueil, ni opération en Production.

BRANCHE_DU_LOT: menu-accueil-employe-20261030

RAIL_LU: db168abca412b33b43d0a22a916bc6c4964b40f9
NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: MENU-ACCUEIL-EMPLOYE-20261030
REQUEST: request-2.md
HEAD: db168abca412b33b43d0a22a916bc6c4964b40f9
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Implémenter l’option A ; rester sur une modification d’interface sans colonne ni migration ; ne pas modifier l’exclusion roleDuJour !== 'renfort' ni les contrôles Inventaire de l’Accueil ; vérifier par tests les entrées du menu selon le poste, l’absence de Jaugeage et Index pour les employés, et la visibilité de la recherche réservée aux manager et gérant.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
