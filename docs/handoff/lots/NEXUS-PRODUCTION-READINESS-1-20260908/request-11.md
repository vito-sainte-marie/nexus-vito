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
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0_production=d5a8b77
  - id: decision-9-consommee
    classe: VERIFIED
    valeur: commit_766b456_marque_consomme
  - id: six-branches-classees
    classe: VERIFIED
    valeur: BRANCHES-CLASSEES.json_toutes_SUPERSEDEE_motifs_verifies_par_diff
  - id: garde-branches-en-rade
    classe: VERIFIED
    valeur: aucune_44_examinees_test_21_sur_21
  - id: verdict-recalcule
    classe: VERIFIED
    valeur: PRET_POUR_PRODUCTION_dix_criteres_sur_dix
  - id: ci-candidat
    classe: VERIFIED
    valeur: pull_request_success_push_success_sur_764efa8
  - id: regression
    classe: VERIFIED
    valeur: 9_echecs_historiques_inchanges_0_regression
  - id: guardians
    classe: VERIFIED
    valeur: 0_finding_guardians_router_0_finding_guardian_qa_263_epreuves
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Rail réconcilié, six branches classées, verdict recalculé : PRET_POUR_PRODUCTION — gate humaine toujours seule à trancher

## Ce qui était demandé

Réconcilier le rail Handoff (`decision-9.md` existait déjà, en réponse à
`request-10.md`, mais `STATE.json` restait `ATTENTE_DECISION`) sans réécrire
l'historique, puis classer factuellement les six branches
`claude/issue-28-20260910-*` qui rendaient `aucunBlocageNonResolu` `INCONNU`
depuis le commit `764efa8`, en n'intégrant que ce qui serait réellement
absent du candidat et nécessaire à la release.

## 1 — Rail réconcilié

`node outils/handoff.js consommer NEXUS-PRODUCTION-READINESS-1-20260908` a
marqué `decision-9.md` consommée (commit `766b456`, celui qui l'avait
déposée) :

```
statut            : DECISION_CONSOMMEE
derniere_demande  : request-10.md
derniere_decision : decision-9.md
commit_decision   : 766b45698ffc5351204cbd5e3d83dc480b50496a
```

`node outils/handoff.js verifier` reste conforme après coup (29 lots, 10
avertissements préexistants, 0 nouvelle erreur). Aucun fichier réécrit,
aucun historique modifié — la décision existait déjà, elle n'était que non
consommée.

## 2 — Les six branches, classées une par une, par diff réel

Chacune analysée par `git log`/`git diff` contre son propre point de
divergence avec le candidat — jamais deviné. Verdict identique pour les
six : **`SUPERSEDEE`**, aucun delta fonctionnel ou de sécurité réellement
absent du candidat. Motifs complets dans
`docs/handoff/BRANCHES-CLASSEES.json` ; résumé :

| Branche | Ce qu'elle portait | Pourquoi rien à transporter |
|---|---|---|
| `-1435` | `request-8.md` (diagnostic zzzzrefdetestinexistante) | Contenu identique en substance au `request-8.md` déjà canonique, arrivé par une autre voie |
| `-1544` | fixtures §10, instrumentation §7, rattraper request-8 | `guardians-router.js`/`run-tests.js`/`test_guardians_router_20260907.js` octet pour octet identiques au HEAD ; `test_fixtures_hors_depot_20260910.js` dépassé par une version ultérieure (bac à sable + 2 contrôles en plus) |
| `-1621` | consommation de `decision-8.md` | Effet strictement redondant, le HEAD est allé plus loin depuis |
| `-1727` | classement de -1435/-1544/-1621, mise à jour `blocages-ouverts-1.md` | Son classement n'avait jamais été fusionné (repris directement dans ce lot, vérifié indépendamment) ; sa narration est dépassée par les sessions -1828 et la fermeture définitive du défaut Auth déjà canonique |
| `-1828` | `request-9.md` (isolation défaut 13) | Repris et réécrit indépendamment sur le HEAD canonique actuel, lui-même dépassé depuis par la fermeture définitive du défaut Auth |
| `-2006` | correctif fixture (bac à sable), consommation `decision-9`, `request-11.md` | Correctif fonctionnellement équivalent à `c405c75` déjà canonique (nommage différent) ; sa consommation de décision et son `request-11.md` datent d'avant la fermeture définitive du défaut Auth et les déclarations du 10/09 — stales, non publiés tels quels |

**Preuve mesurée** : `node outils/garde-branches-en-rade.js` →
« aucune (44 branche(s) claude/* examinée(s)) », contre « 6 [...] en rade »
avant ce lot. `node test_garde_branches_en_rade_20260908.js` → 21/21.

## 3 — Conséquence mécanique sur `aucunBlocageNonResolu`, pas une nouvelle déclaration de fondateur

Le second blocage ouvert par Frédéric Bragance le 10/09 (commit `764efa8`)
nommait lui-même sa condition exacte de levée : « ce n'est pas un démenti de
la déclaration [sur le défaut 7], qui reste valide [...] c'est un SECOND
blocage, distinct ». Cette condition — les six branches classées — est
désormais remplie, par les faits ci-dessus, pas par une nouvelle
appréciation métier. `aucunBlocageNonResolu.valeur` repasse donc à `true`
dans `faits-pret-pour-production.json`, avec :
- l'historique complet de la suspension conservé tel quel (rien n'est
  effacé) ;
- la déclaration de Frédéric Bragance sur le défaut 7
  (`declaration_defaut_7_toujours_valide`) inchangée, toujours en vigueur ;
- le défaut 7 lui-même **reste ouvert au suivi**, instrumenté, non corrigé —
  cette levée ne le referme pas, elle referme uniquement le second blocage.

Si Frédéric juge que la levée d'un blocage qu'il a lui-même posé doit
rester sa seule prérogative même quand la condition qu'il a nommée est
remplie mécaniquement, ce point se corrige d'un mot dans le fichier de
faits — signalé ici explicitement plutôt que décidé en silence.

## 4 — Verdict recalculé, pas raconté

CI mesurée en direct sur le candidat réel de cette session (`764efa8`),
pas recopiée d'un run antérieur :

```
node outils/evaluer-pret-pour-production.js
  candidat : 764efa8
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

Dix critères sur dix au vert. `PRET_POUR_PRODUCTION` ne vaut à aucun moment
autorisation Production — la gate reste explicitement celle de Frédéric,
sur une release et un impact précis, et elle est `INCONNU` : aucune gate
n'a été formulée dans ce lot, ni ne pouvait l'être depuis ce canal.

**Fenêtre de mesure à surveiller** : les re-mesures Production SELECT-only
(`preuve-re-mesure-finale-1.md`, 10/09 14:02Z) restent valides 24 h, jusqu'au
**11/09/2026 14:02Z**. Si la gate de Frédéric intervient après cette
échéance, elles devront être rejouées avant toute autorisation.

## Régression et Guardians, réellement exécutés

- `node run-tests.js` → 9 échecs historiques strictement inchangés, 0
  régression.
- `node outils/guardians-router.js` → 0 finding (1 fichier changé dans ce
  lot, `BRANCHES-CLASSEES.json`, scopes `orchestrator`/`handoff`).
- `node outils/guardian-qa.js` → 0 finding (263 épreuves).
- `node outils/verifier-apprentissage.js` → conforme (20 règles).
- `node outils/handoff.js verifier` → conforme (29 lots, 10 avertissements
  préexistants, 6 dérogations, 0 nouvelle erreur).

## Ce qui reste, explicitement hors de ce lot

La gate humaine de Frédéric elle-même — jamais pré-autorisable, jamais
déduite par un outil. Si elle intervient, elle doit nommer la release
(`764efa8` ou tout commit ultérieur identique en substance) et son impact
mesuré, et rester distincte de ce verdict technique.

## Invariants respectés

Aucun changement `main`/`production` (main=10c65d0, production=d5a8b77,
inchangées, vérifiées avant et après ce lot), aucune écriture ni migration
Supabase Production, aucun déploiement ni rollback Production, aucune
copie non anonymisée de Production, aucun secret/PIN/service_role lu,
affiché ou exposé, aucun élargissement de surface de sécurité. Migration
21 reste exclue de cette release, inchangée.
