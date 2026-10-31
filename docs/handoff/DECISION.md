<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/INVENTAIRE-GAZ-CAGE-20261031/decision-1.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-GAZ-CAGE-20261031
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6548174466
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41234786704), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6548174466. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-GAZ-CAGE-20261031`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `2675e3011b1f1821f08bf03f5d9b9ed1cfa966f0`, `HEAD` = `2675e3011b1f1821f08bf03f5d9b9ed1cfa966f0`, SHA du run `2675e3011b1f1821f08bf03f5d9b9ed1cfa966f0`, tête du rail `2675e3011b1f1821f08bf03f5d9b9ed1cfa966f0`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Lecture Production strictement en SELECT et filtrée par site sur les tables et champs désignés ; consigner les résultats permettant de départager H1 et H2 ; ne corriger l’écriture à la source que si H1 est confirmée et ne pas ajouter d’heuristique de filtrage des zéros sans preuve ; retenir l’option A avec migration et données sur Test uniquement, en préservant site_id et les politiques RLS existantes ; afficher le repère à la clôture uniquement ; aucune mutation, migration, fusion ou promotion Production n’est autorisée. »). Elles lient l'exécutant suivant (`session-claude-habilitee`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

- En application de `PALIER_HUMAIN_RESTREINT`, la lecture seule de Production ne nécessite pas le GO de Frédéric. Elle est autorisée avec filtrage explicite par site et sans aucune mutation.
- **Stockage : option A**, sous forme d’un réglage `jsonb` nullable porté par `inventaire_zone_produit`, avec migration sur Test uniquement à ce stade. L’option B n’est pas retenue faute de réglage existant identifié.
- **Affichage : clôture uniquement**, conformément à la demande explicite de Frédéric. L’affichage à l’ouverture est une extension non approuvée et reste hors périmètre.
- La règle proposée de sélection du « dernier comptage valide » n’est pas approuvée sans preuve. La correction doit viser la source si H1 est confirmée ; aucune heuristique masquant les zéros à la lecture ne doit être introduite.
- Toute migration, écriture de réglage, fusion ou promotion en Production demeure hors de cette décision.

BRANCHE_DU_LOT: inventaire-gaz-cage-20261031

RAIL_LU: 2675e3011b1f1821f08bf03f5d9b9ed1cfa966f0

NEXT_ACTION_CONTRACT  
DECISION: APPROVED_WITH_CONDITIONS  
CLOSES: false  
LOT: INVENTAIRE-GAZ-CAGE-20261031  
REQUEST: request-1.md  
HEAD: 2675e3011b1f1821f08bf03f5d9b9ed1cfa966f0  
LEASE: aucun  
GATE_STATE: G0, CI non exécutée  
PROOF_STATE: PROOF_VALID  
CONDITIONS: Lecture Production strictement en SELECT et filtrée par site sur les tables et champs désignés ; consigner les résultats permettant de départager H1 et H2 ; ne corriger l’écriture à la source que si H1 est confirmée et ne pas ajouter d’heuristique de filtrage des zéros sans preuve ; retenir l’option A avec migration et données sur Test uniquement, en préservant site_id et les politiques RLS existantes ; afficher le repère à la clôture uniquement ; aucune mutation, migration, fusion ou promotion Production n’est autorisée.  
BLOCKER: aucun  
STOP_REQUIRED: non  
CAPACITE_REQUISE: SUPABASE_PRODUCTION_LECTURE  
OWNER_NEXT: Claude  
EXECUTANT_NEXT: session-claude-habilitee  
ACTION_NEXT: Exécuter la lecture seule de Production filtrée par site décrite dans request-1.md afin de départager H1 et H2.
