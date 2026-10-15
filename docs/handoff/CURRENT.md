<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/NEXUS-BOUCLE-CONTRAT-1-20261015/request-2.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-BOUCLE-CONTRAT-1-20261015
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=d6a97a47
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 151-fichiers
  - id: commit-correctif
    classe: VERIFIED
    valeur: 03fb26ec sur incident/INC-20261015-001
  - id: epreuves-avant-apres
    classe: VERIFIED
    valeur: tour-vide 4/13 puis 14/14; suites de reference exit=0; reconciler 16/16
---
# Retour d'exécution — lot 1 (tour vide et consommation après action), INC-20261015-001

Le correctif est sur `incident/INC-20261015-001`, commit 03fb26ec (poussé). Rien n'est fusionné, ni sur le rail, ni sur `main`, ni sur `production`. `claude.yml` n'est pas modifié : le patch est préparé dans `docs/handoff/propositions/INC-20261015-001-claude-yml-lot1.patch` (88 lignes) et reste à appliquer par Frédéric.

## Preuve des conditions de decision-1

1. **Uniquement sur `incident/INC-20261015-001`, sans fusion ni modification de `main`/`production`.** Respecté : un seul commit (03fb26ec) sur cette branche, aucun merge. Ce dépôt de retour est la seule écriture sur le rail.
2. **Réutiliser `ATTENTE_CONSOMMATION_DECISION` comme prise en charge, lecteurs adaptés.** `outils/handoff.js` : `consommer <lot> --prise-en-charge` écrit ce statut. `outils/reveil-handoff.js` : motif `PRISE_EN_CHARGE`, sans réveil en boucle. `outils/watchdog-stagnation.js` : continuation `PRISE_EN_CHARGE` (60 min). `outils/garde-boucle-autonome.js` : `evaluerTourVide`. `etat-deploiement.js` le mappait déjà. `rapatrier-vers-rail.js`, `materialiser-decision-ci.js`, `relancer-claude-ci.js` et le reconciler n'ont pas été modifiés : leurs suites sont vertes.
3. **Interdire `DECISION_CONSOMMEE` sans preuve d'action ou arrêt matérialisé.** `consommer <lot>` nu est refusé (`CONSOMMATION_SANS_PREUVE`), sauf `closes: true` ou `--cloture`. `--preuve-action <commit>` exige un commit hors `docs/handoff/`, ancêtre de HEAD. Une demande déposée pendant la prise en charge consomme atomiquement et consigne l'arrêt.
4. **Faire échouer et signaler tout tour vide.** `TOUR_VIDE` : aucun fichier hors `docs/handoff/` et aucune nouvelle demande. Le tour échoue, pas de consommation, pas de relance identique (clé stable = sha256 du lot, de la décision, du rail et des opérations triées). Côté workflow : étape d'alerte Telegram dans le patch `claude.yml`, **non appliquée**.
5. **Épreuves avant/après consignées, sans déclarer clos les scénarios dépendant des lots 2 ou 3.** Voir ci-dessous. Les scénarios 6, 7, 11 et 16 (en partie) ne sont pas déclarés clos.
6. **Contre-exemples PROPRETE et RECONCILER préservés.** PROPRETE : une épreuve de `test_boucle_tour_vide_20261015.js` rejoue le cas d'un commit de travail réel (2a2f792e) et le tour reste valide. RECONCILER : recette du reconciler 16/16, code non modifié.
7. **Aucune branche dédiée affectée à `github-actions-claude`.** Aucune ; le patch n'introduit pas de branche `lot/<id>` (lot 3, non autorisé).

## Épreuves avant/après

- `test_boucle_tour_vide_20261015.js` : **4/13 avant le correctif, 14/14 après** (S15a renforcée).
- Suites de référence, toutes à `exit=0` après correctif : handoff_v2, reveil_handoff, reveil_autosuffisant, boucle_autonome, garde_boucle_autonome, watchdog_stagnation, watchdog_orphelines, etat_deploiement, execution_recue, handoff_rail_actif, materialiser_decision_ci, rapatriement_lot_du_rail, continuite_bout_en_bout, enregistrer_incident, garde_preuve_conditions, handoff_file_en_attente, reconciler (16/16).
- `test_relais_arbitre_openai_20261008*.js` : **aucun fichier trouvé** ; non exécuté.
- `test_handoff_file_en_attente_20261007.js` B1 adapté : il consomme désormais par prise en charge, vrai commit et `--preuve-action` (8/8).
- Mutations : les mutants sont rougis par les épreuves ; M2 n'était pas détecté, S15a a été renforcée et le mutant rougit.

## Limites, risques et suite

- Le correctif de `claude.yml` n'agit qu'une fois le patch appliqué sur `main` par Frédéric. Tant qu'il ne l'est pas, le prompt en vigueur consomme encore d'abord : le défaut n'est pas corrigé en production de la boucle.
- Lots 2 (contrat opérations/capacités) et 3 (branches `lot/<id>`) : non autorisés, non commencés.
- Défaut voisin, hors périmètre : `claude.yml` compte des lignes de refus (21) au lieu de refus (10).
- Incident et règle : 2 lignes `TOUR_VIDE` dans `INCIDENTS.jsonl`, règle GOV-009 dans `RULES.json`, ligne `EXPERIENCE.jsonl`.
- La consommation de decision-1 se fait ici par arrêt matérialisé : l'action est livrée sur la branche d'incident, mais son intégration attend l'arbitrage.

Demande : valider le lot 1, et dire si le patch `claude.yml` peut être présenté à Frédéric pour application.
