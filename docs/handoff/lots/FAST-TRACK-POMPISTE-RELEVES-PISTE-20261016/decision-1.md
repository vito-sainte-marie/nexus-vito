---
protocol: nexus-handoff/2
kind: decision
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 1
author: ChatGPT
branch: handoff-continuite-20260920
decision: APPROVED_WITH_CONDITIONS
closes: false
in_reply_to: request-1.md
---
# Décision sur request-1.md — APPROVED_WITH_CONDITIONS

_Provenance : verdict rendu par ChatGPT via l'API OpenAI (run 38981064891), posté sur https://github.com/vito-sainte-marie/nexus-vito/issues/28#issuecomment-6226556987. Matérialisé par la CI (stade (a), autorisé par Frédéric Bragance le 09/10/2026), sans session Claude ni recopie humaine. Le verdict est reproduit tel quel ; seul le contrat a été contrôlé._

## Ce que la CI a contrôlé

- `NEXT_ACTION_CONTRACT` conforme (mêmes règles que le relais : vocabulaire, palier Frédéric, aucune mention qui relance Claude).
- `LOT` = `FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016`, `REQUEST` = `request-1.md` : c'est la demande en attente au registre (`ATTENTE_DECISION`).
- Rail `handoff-continuite-20260920` : celui du lot au registre, de forme `handoff-*` ; ni `main` ni `production`.
- Lecture du rail : `RAIL_LU` = `67b85dfd02879fb134e71a8f032eb2b4f6f1a9c1`, `HEAD` = `67b85dfd02879fb134e71a8f032eb2b4f6f1a9c1`, SHA du run `67b85dfd02879fb134e71a8f032eb2b4f6f1a9c1`, tête du rail `67b85dfd02879fb134e71a8f032eb2b4f6f1a9c1`. Un SHA doit être celui du run ; `INACCESSIBLE` (relais intégral) n'est admis que si le run est la tête du rail.
- Aucun palier humain : ni `DECISION: BLOCKED`, ni `OWNER_NEXT: Frédéric`, ni `STOP_REQUIRED` renseigné.

## Ce que la CI n'a PAS contrôlé

- Les conditions du verdict (« Développement, déploiement et recette limités à Test sur branche dédiée, sans main ni Production ; ne pas inventer les éléments absents du brief ; disposer du brief intégral avant toute implémentation dépendant de la persistance, d’une migration, de l’intégration finale ou des critères de recette ; toute migration éventuelle est Test uniquement et respecte site_id, RLS et l’isolation multisite ; conserver l’index physique à sept chiffres et rendre toute présentation à six chiffres explicite sans troncature aveugle ; présenter 1191213 comme référence GNR historique et non comme relevé employé. »). Elles lient l'exécutant suivant (`github-actions-claude`), qui les vérifie avant d'agir.
- Ce dépôt est poussé avec le jeton du workflow : il ne relance ni la CI ni Claude. La reprise reste celle du prochain réveil.

## Texte de l'arbitre

**Verdict : APPROVED_WITH_CONDITIONS.**

Le lot est désormais actif selon `STATE.json` ; la mention d’attente derrière `NEXUS-CONSIGNATION-RECETTE-LOTC-20261016` est donc périmée.

Le GO couvre le développement sur branche dédiée, le déploiement Test et la recette Test uniquement. Il n’autorise ni `main`, ni Production. Conformément à `PALIER_HUMAIN_RESTREINT`, `DELEGATION_ARBITRE`, `PREAUTORISATIONS_CLAUDE` et `COMMIT_PUSH_RAIL_SANS_GO`, aucun GO humain supplémentaire n’est requis dans ce périmètre.

Le brief tronqué ne doit pas être complété par hypothèse. Avant toute implémentation dépendant des parties manquantes — notamment persistance, migration, intégration finale ou critères de recette — le brief intégral doit être disponible. Toute migration éventuelle reste strictement limitée à Test et doit respecter les invariants `site_id`, RLS et isolation multisite. La valeur physique observée à sept chiffres doit être conservée ; toute présentation à six chiffres doit être explicite et ne jamais supprimer aveuglément un chiffre significatif. L’index GNR 1191213 doit rester identifié comme référence historique, jamais comme relevé physique de l’employé.

RAIL_LU: 67b85dfd02879fb134e71a8f032eb2b4f6f1a9c1

NEXT_ACTION_CONTRACT
DECISION: APPROVED_WITH_CONDITIONS
CLOSES: false
LOT: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
REQUEST: request-1.md
HEAD: 67b85dfd02879fb134e71a8f032eb2b4f6f1a9c1
LEASE: aucun
GATE_STATE: G0, CI non exécutée
PROOF_STATE: PROOF_VALID
CONDITIONS: Développement, déploiement et recette limités à Test sur branche dédiée, sans main ni Production ; ne pas inventer les éléments absents du brief ; disposer du brief intégral avant toute implémentation dépendant de la persistance, d’une migration, de l’intégration finale ou des critères de recette ; toute migration éventuelle est Test uniquement et respecte site_id, RLS et l’isolation multisite ; conserver l’index physique à sept chiffres et rendre toute présentation à six chiffres explicite sans troncature aveugle ; présenter 1191213 comme référence GNR historique et non comme relevé employé.
BLOCKER: aucun
STOP_REQUIRED: non
CAPACITE_REQUISE: DEPOT_ECRITURE_RAIL
OWNER_NEXT: Claude
EXECUTANT_NEXT: github-actions-claude
ACTION_NEXT: Matérialiser cette décision sur le rail avec outils/handoff.js decision --auteur ChatGPT.
