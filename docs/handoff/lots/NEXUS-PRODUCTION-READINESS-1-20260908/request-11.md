---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 11
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=d5a8b77
  - id: decision-9-consommee
    classe: VERIFIED
    valeur: commit_766b456_marque_consomme
  - id: branche-2123-classee
    classe: VERIFIED
    valeur: BRANCHES-CLASSEES.json_SUPERSEDEE_diff_verifie_aucun_code_perdu
  - id: garde-branches-en-rade
    classe: VERIFIED
    valeur: aucune_45_examinees_test_21_sur_21
  - id: verdict-recalcule
    classe: VERIFIED
    valeur: PRET_POUR_PRODUCTION_dix_criteres_sur_dix_via_evaluer-pret-pour-production.js
  - id: ci-candidat
    classe: VERIFIED
    valeur: pull_request_success_push_success_sur_f5ba864
  - id: regression
    classe: VERIFIED
    valeur: 9_echecs_historiques_inchanges_0_regression
  - id: guardians
    classe: VERIFIED
    valeur: 0_finding_guardians_router_0_finding_guardian_qa_263_epreuves
  - id: mesures-production-fraiches
    classe: VERIFIED
    valeur: preuve-re-mesure-finale-1_valide_jusqu_au_2026-09-11T14h02Z
  - id: gate-humaine-frederic
    classe: DECLARED
    valeur: valeur_null_non_touchee_appartient_exclusivement_a_frederic
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Rail réconcilié, verdict recalculé sur le candidat réel : dix critères sur dix — reste la gate de Frédéric

## Ce qui était demandé

Réconcilier `STATE.json` (resté `ATTENTE_DECISION`/`request-10.md`/`decision-8.md` alors que
`decision-9.md` existait déjà sur le canon, en réponse à `request-10.md`), consommer
`decision-9.md` sans réécrire l'historique, puis recalculer le verdict sur le SHA réellement
canonique — sans intégrer par simple copie l'ancien `request-11.md` resté sur une branche stale.

## 1 — Rail réconcilié

`decision-9.md` (`APPROVED`, `closes: false`, en réponse à `request-10.md`) a été consommée via
`node outils/handoff.js consommer NEXUS-PRODUCTION-READINESS-1-20260908` (commit `766b456`,
`consomme_le: 2026-09-10T22:34:46.508Z`). `node outils/handoff.js verifier` reste conforme avant
et après (29 lots, 10 avertissements préexistants, 6 dérogations, 0 nouvelle erreur). Miroirs
régénérés.

## 2 — Un ancien `request-11.md` trouvé sur une branche stale, classé plutôt que copié

`outils/garde-branches-en-rade.js` a signalé une septième branche non classée,
`claude/issue-28-20260910-2123` (un commit, `ee56767`). Vérification par diff complet : aucun
fichier de code, seulement un état Handoff (`STATE.json`, `CURRENT.md`, `DECISION.md`,
`faits-pret-pour-production.json`) et un `request-11.md` — construits sur le candidat antérieur
`764efa8`, avant la classification indépendante et plus rigoureuse des six branches faite
directement sur le canon jusqu'à `647a074` puis `f5ba864`. Cette branche n'a donc rien
d'applicatif ni de probatoire que le canon ne porte déjà, de façon plus complète. Classée
`SUPERSEDEE` dans `docs/handoff/BRANCHES-CLASSEES.json` (motif détaillé, SHA de tête, diff
vérifié) plutôt qu'intégrée. `node outils/garde-branches-en-rade.js` confirme désormais
« aucune (45 branche(s) claude/* examinée(s)) », `test_garde_branches_en_rade_20260908.js`
21/21.

## 3 — Verdict recalculé sur le candidat réel, par l'outil, pas déclaré

```
node outils/evaluer-pret-pour-production.js

candidat : f5ba864
CI       : pull_request:success · push:success

✓ OK  candidate_immuable_identifiee
✓ OK  ci_et_guardians_conformes
✓ OK  rail_handoff_conforme
✓ OK  manifeste_migrations_a_jour
✓ OK  impacts_production_mesures_horodates
✓ OK  aucun_impact_dml_inconnu
✓ OK  preprod_anonymise_ou_equivalent
✓ OK  repetition_migrations_recette_reussie
✓ OK  plan_reparation_rollback_documente
✓ OK  fenetre_deploiement_confirmee
✓ OK  aucun_blocage_non_resolu

VERDICT               : PRET_POUR_PRODUCTION
gate humaine Frédéric : INCONNU
autorisation          : NON_AUTORISEE
```

Dix critères déterministes sur dix au vert, calculés par le code sur ce SHA exact — pas repris
sur parole d'un précédent rapport. Le SHA candidat porte un run `push` et un run `pull_request`
tous deux `success` (contrôlé par l'évaluateur lui-même via `gh run list --commit f5ba864`, pas
supposé).

## 4 — Candidat exact et impacts mesurés

**Candidat** : `f5ba8641bb8117883cff42a302ba2c64618f7e5a`, branche `config-par-environnement`.
`origin/main = 10c65d0`, `origin/production = d5a8b77` — aucun des deux touché.

**Impacts Production mesurés en lecture seule** (`preuve-re-mesure-finale-1.md`, 10/09/2026
14h02–14h05 UTC sur `uzhjpqpctpvxytxpxoqz`, **valides jusqu'au 11/09/2026 14h02 UTC** — encore
fraîches au moment de ce dépôt) :

| Mesure | Valeur |
|---|---|
| Référentiel Advisor — lignes qui changeraient de valeur | 0 (37 identiques, 0 créée, 0 changée) |
| `shifts` où `site_id` diverge de `site` | 17 |
| `mission_catalog` où `site` diverge de `site_id` | 89 |
| Sites sans fuseau résolvable | 0 |
| Services `en_cours` au total | 21 |
| Services qui seraient clos `clos_sans_pointage` (migration #6) | 20 |
| Écritures en vol sur `shifts`/`mission_catalog` au moment du contrôle | 0 |
| `nexus_live_events` déjà présente en Production | non (condition d'arrêt de la migration 21 non déclenchée) |

Migration 21 reste exclue de cette release (dépendance à `nexus_live_events`, table Test-only,
aucune migration Production dédiée). Le défaut 7 (`security`, occurrence unique sur l'ancien
candidat `ea561f6`, jamais reproduite) reste déclaré non bloquant par Frédéric Bragance, ouvert
et instrumenté — non représenté comme corrigé.

## 5 — Ce qui est demandé maintenant

Uniquement la gate finale de Frédéric sur ce candidat et ces impacts précis. Aucune ré-exécution,
aucun nouveau correctif : les dix critères déterministes sont verts, calculés par
`outils/evaluer-pret-pour-production.js` sur `f5ba864`, et les mesures Production sont encore
fraîches. `Prêt pour Production` ne vaut pas et ne vaudra jamais autorisation Production — seule
la déclaration explicite de Frédéric sur cette release précise (`gateHumaineFrederic`) peut faire
passer `autorisation` de `NON_AUTORISEE` à `AUTORISEE`. Si la gate n'est pas posée avant le
11/09/2026 14h02 UTC, `impacts_production_mesures_horodates` repasse `BLOQUE` et les six mesures
sont à rejouer avant toute nouvelle demande.

Aucune écriture ni migration Supabase Production, aucun push/merge `main`/`production`, aucun
déploiement/rollback réel, aucune copie non anonymisée de Production, aucun secret/`service_role`
exposé dans ce dépôt.
