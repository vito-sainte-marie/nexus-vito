---
protocol: nexus-handoff/2
kind: decision
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6406715721
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40257890487), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6406715721. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `OUTILLAGE-REGULARISATION-20261026`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `0b3bbc18d82d64587a14b351f3ac62f4936fe160`, `HEAD` = `0b3bbc18d82d64587a14b351f3ac62f4936fe160`, SHA du run `0b3bbc18d82d64587a14b351f3ac62f4936fe160`, tête du rail `0b3bbc18d82d64587a14b351f3ac62f4936fe160`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Ratifier les trois commits sans exiger de mutation dédiée supplémentaire pour e251592c ; implémenter le bornage de --preuve-action avec refus avant écriture, exception explicite lorsque branche du lot = rail, tests des SHA rail-seul/branche/inconnu/branche introuvable et mutation de l’ascendance ; conserver les deux prises de poste du scénario puis clore par l’écran le second service ; ne nettoyer aucun service historique, ne toucher ni Production ni main ; obtenir la CI verte avant consommation finale. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

1. Les commits `6510a2e3`, `631f5d00` et `e251592c` sont ratifiés a posteriori. Ils relèvent de l’acquis `OUTILLAGE_A_POSTERIORI` : outillage, gardes, tests et CI, sans Production, secret, choix métier ni modification de `main`. L’absence de mutation dédiée à `e251592c` est acceptable puisque ce correctif préserve le comportement et que le bloc concerné reste couvert par les mutations de `6510a2e3`.

2. Le bornage de `consommer --preuve-action` est approuvé :
   - pour une branche de lot distincte du rail, le SHA doit exister, être ancêtre de `origin/<branche du lot>` et ne pas être un commit porté par le seul rail ;
   - la branche provient exclusivement de l’enveloppe de décision ;
   - une branche introuvable produit `BRANCHE_DU_LOT_INTROUVABLE` avant toute écriture ;
   - un SHA inconnu ou hors branche produit un refus explicite avant toute écriture ;
   - lorsque la branche du lot est le rail lui-même, aucune restriction d’ascendance supplémentaire ne s’applique au-delà de la validation existante par `commitHorsRegistre`. Cette exception est nécessaire pour permettre les actions légitimement réalisées sur le rail.

3. Pour le scénario Employé Test A, le choix retenu est la **clôture par l’écran, en fin de scénario, du second service laissé ouvert**. Le scénario doit conserver les deux prises de poste successives qui éprouvent le cas du quart déjà ouvert. Aucun SQL de nettoyage, aucune suppression ou reprise des services historiques n’est autorisé par cette décision.

4. Avant consommation finale du lot, les nouveaux comportements doivent être couverts par les cas annoncés, une mutation neutralisant l’ascendance doit faire rougir l’épreuve, les cas voisins doivent rester verts et la CI du rail doit être verte. Les acquis `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent : aucun GO humain supplémentaire n’est requis.

RAIL_LU: 0b3bbc18d82d64587a14b351f3ac62f4936fe160

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: OUTILLAGE-REGULARISATION-20261026
REQUEST: request-1.md
HEAD: 0b3bbc18d82d64587a14b351f3ac62f4936fe160
LEASE: aucun
GATE_STATE: G1, CI verte pour les correctifs ratifiés ; modifications approuvées restant à implémenter et éprouver
PROOF_STATE: PROOF_VALID
CONDITIONS: Ratifier les trois commits sans exiger de mutation dédiée supplémentaire pour e251592c ; implémenter le bornage de --preuve-action avec refus avant écriture, exception explicite lorsque branche du lot = rail, tests des SHA rail-seul/branche/inconnu/branche introuvable et mutation de l’ascendance ; conserver les deux prises de poste du scénario puis clore par l’écran le second service ; ne nettoyer aucun service historique, ne toucher ni Production ni main ; obtenir la CI verte avant consommation finale.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
