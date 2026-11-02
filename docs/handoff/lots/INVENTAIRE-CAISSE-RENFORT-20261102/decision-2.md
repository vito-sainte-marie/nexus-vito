---
protocol: nexus-handoff/2
kind: decision
lot_id: INVENTAIRE-CAISSE-RENFORT-20261102
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6581454825
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 41474513264), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6581454825. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `INVENTAIRE-CAISSE-RENFORT-20261102`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `9d9dca4d9b571fd958d80f5db6a931cc6ff4aa8a`, `HEAD` = `9d9dca4d9b571fd958d80f5db6a931cc6ff4aa8a`, SHA du run `9d9dca4d9b571fd958d80f5db6a931cc6ff4aa8a`, tête du rail `9d9dca4d9b571fd958d80f5db6a931cc6ff4aa8a`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« L1 limité à une pilote caisse sur Test; activation individuelle refusée par défaut, côté serveur et isolée par site_id; non-pilotes inchangés; cycles non bornés non calculables; pilote mesuré 7 jours et au moins 10 missions, prolongeable jusqu’à 14 jours; toute table, colonne, migration, policy ou grant passe par SECURITE_RLS_SITE_ID; toute permission nouvelle ou surface élargie passe par SECRET_PERMISSION_SURFACE_SECURITE; aucun renfort, élargissement, Production ou communication terrain autorisé. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

## Décision

**APPROVED_WITH_CONDITIONS — closes: false.**

1. La décision de Frédéric « plus de feuille » remplace bien `decision-1 §4` : pour chaque famille, le papier cesse à sa bascule effective dans NEXUS. Pour le pilote, cela s’applique uniquement à l’employée basculée ; les autres continuent la feuille jusqu’à leur propre bascule. La date, la communication terrain et toute mise en Production restent hors de cette autorisation.
2. L1 est autorisé en conception puis en code sur Test pour **une seule employée pilote en caisse**. L’ambiguïté « même personne pour caisse et renfort ou une personne par rôle » ne bloque pas L1 caisse, mais aucune conclusion ne doit en être tirée pour le renfort.
3. L’activation doit être individuelle, refusée par défaut, lue côté serveur et limitée par `site_id` et identifiant d’employée. Les non-pilotes doivent conserver exactement leur comportement actuel.
4. Ordre imposé :
   - inventorier les mécanismes existants de réglage et d’autorisation manager ;
   - concevoir l’activation individuelle ;
   - coder sur Test avec les mécanismes existants ;
   - éprouver pilote, non-pilote et isolation intersite.
   
   Toute table, colonne, policy, migration ou grant franchit la porte `SECURITE_RLS_SITE_ID` avant modification. Toute permission nouvelle ou surface manager élargie franchit `SECRET_PERMISSION_SURFACE_SECURITE`.
5. Un cycle non borné par deux comptages NEXUS reste **non calculable** : il ne produit ni anomalie ni imputation à l’employée pilote.
6. Le pilote est observé pendant **7 jours calendaires** à compter de sa bascule effective, avec au moins 10 missions éligibles. Si ce volume n’est pas atteint, l’observation continue jusqu’à 14 jours maximum. Le bilan doit mesurer :
   - taux de missions réalisées dans leur fenêtre, cible ≥ 90 % ;
   - temps médian et percentile 90 de comptage, consignés sans seuil éliminatoire faute de référence initiale ;
   - nombre d’écarts confirmés après recomptage à l’aveugle ;
   - nombre d’erreurs de saisie ;
   - 100 % des écarts classés ou explicitement laissés en investigation ;
   - zéro perte, doublon ou exposition à une autre employée ou à un autre site.
7. Aucun élargissement à d’autres employées, aucune migration, aucune modification de sécurité et aucune opération Production ne sont autorisés par cette décision. L’élargissement devra s’appuyer sur le bilan du pilote et sur la réponse déjà attendue concernant caisse/renfort.

Les acquis `DELEGATION_ARBITRE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : L1 sur Test et les commits du rail n’exigent aucun GO humain supplémentaire.

RAIL_LU: 9d9dca4d9b571fd958d80f5db6a931cc6ff4aa8a

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: INVENTAIRE-CAISSE-RENFORT-20261102
REQUEST: request-2.md
BRANCHE_DU_LOT: handoff-continuite-20260920
HEAD: 9d9dca4d9b571fd958d80f5db6a931cc6ff4aa8a
LEASE: aucun
GATE_STATE: G0, CI verte
PROOF_STATE: PROOF_VALID
CONDITIONS: L1 limité à une pilote caisse sur Test; activation individuelle refusée par défaut, côté serveur et isolée par site_id; non-pilotes inchangés; cycles non bornés non calculables; pilote mesuré 7 jours et au moins 10 missions, prolongeable jusqu’à 14 jours; toute table, colonne, migration, policy ou grant passe par SECURITE_RLS_SITE_ID; toute permission nouvelle ou surface élargie passe par SECRET_PERMISSION_SURFACE_SECURITE; aucun renfort, élargissement, Production ou communication terrain autorisé.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
