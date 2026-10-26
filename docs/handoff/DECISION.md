<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/OUTILLAGE-REGULARISATION-20261026/decision-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: decision
lot_id: OUTILLAGE-REGULARISATION-20261026
seq: 2
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-2.md
provenance:
  niveau: 2
  mode: github_actions_relay
  reference: https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6407130529
---
# Décision sur request-2.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 40260892515), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6407130529. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `OUTILLAGE-REGULARISATION-20261026`, `REQUEST` = `request-2.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `fbdf8ce73df84884b64d96e8f1a1280fffd232ad`, `HEAD` = `fbdf8ce73df84884b64d96e8f1a1280fffd232ad`, SHA du run `fbdf8ce73df84884b64d96e8f1a1280fffd232ad`, tête du rail `fbdf8ce73df84884b64d96e8f1a1280fffd232ad`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Rendre BRANCHE_DU_LOT obligatoire et unique avant toute future consommation avec --preuve-action, avec refus avant écriture s’il manque ou est invalide ; conserver la consommation de decision-1 comme cas régularisé ; créer l’employé automatisé uniquement sur Test par un jeu versionné et idempotent, sans compte Auth sauf preuve ultérieure de nécessité, puis exiger l’épreuve d’isolation, sa mutation et trois runs consécutifs verts avant de retirer Employé Test A ; limiter l’attente du commit Test à trois observations espacées de 120 secondes puis émettre un ::warning:: avec commits attendu et servi et nombre de tentatives ; faire échouer explicitement un tour ayant poussé du travail mais restant en ATTENTE_CONSOMMATION_DECISION ; ne toucher ni main ni Production. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

1. **Condition 2 ratifiée avec bornage renforcé.** Le marqueur unique `BRANCHE_DU_LOT:` dans le corps de la décision est accepté comme directive versionnée sans modification de l’enveloppe `nexus-handoff/2`. En revanche, le comportement permissif en l’absence du marqueur n’est pas accepté pour les futures consommations avec `--preuve-action` : elles devront échouer avant écriture. La consommation déjà réalisée de `decision-1.md` est régularisée par les preuves d’ascendance et la CI verte fournies.
2. **Proposition A approuvée en deux temps.** L’employé automatisé est créé uniquement sur Test par un jeu versionné, idempotent et sans secret. Aucun compte Auth n’est créé tant qu’une épreuve ne démontre pas qu’il est indispensable au parcours. Employé Test A reste couvert jusqu’à trois exécutions consécutives vertes du nouveau scénario. L’épreuve d’isolation et sa mutation sont obligatoires avant son retrait.
3. **Proposition B approuvée avec réessai borné.** Effectuer au maximum trois observations, espacées de 120 secondes, puis émettre un `::warning::` contenant le commit attendu, le commit servi et le nombre de tentatives. Conformément à ENV-003, l’absence du bon déploiement reste non bloquante pour le job, mais ne peut plus être silencieuse.
4. **Runner incomplet à corriger.** Un tour ayant poussé du travail mais se terminant encore en `ATTENTE_CONSOMMATION_DECISION` doit produire une erreur explicite et un statut non réussi ; une épreuve doit couvrir ce cas.
5. Les corrections factuelles au message de `b9e34f97` sont enregistrées sans réécriture de l’historique. Aucun câblage supplémentaire de `tests.yml` n’est requis.
6. Aucun accès à `main`, à Production, ni aucune mutation Production n’est autorisé par cette décision.

Les acquis `OUTILLAGE_A_POSTERIORI`, `PREAUTORISATIONS_CLAUDE`, `PALIER_HUMAIN_RESTREINT` et `COMMIT_PUSH_RAIL_SANS_GO` s’appliquent. Aucun motif du palier Frédéric n’est constitué.

RAIL_LU: fbdf8ce73df84884b64d96e8f1a1280fffd232ad

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: OUTILLAGE-REGULARISATION-20261026
REQUEST: request-2.md
HEAD: fbdf8ce73df84884b64d96e8f1a1280fffd232ad
LEASE: aucun
GATE_STATE: G1, CI verte sur b9e34f97
PROOF_STATE: PROOF_VALID
CONDITIONS: Rendre BRANCHE_DU_LOT obligatoire et unique avant toute future consommation avec --preuve-action, avec refus avant écriture s’il manque ou est invalide ; conserver la consommation de decision-1 comme cas régularisé ; créer l’employé automatisé uniquement sur Test par un jeu versionné et idempotent, sans compte Auth sauf preuve ultérieure de nécessité, puis exiger l’épreuve d’isolation, sa mutation et trois runs consécutifs verts avant de retirer Employé Test A ; limiter l’attente du commit Test à trois observations espacées de 120 secondes puis émettre un ::warning:: avec commits attendu et servi et nombre de tentatives ; faire échouer explicitement un tour ayant poussé du travail mais restant en ATTENTE_CONSOMMATION_DECISION ; ne toucher ni main ni Production.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
