---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PRODUCTION-READINESS-1-20260908
seq: 3
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=10c65d0 production=501c0c7
  - id: rail-reconcilie
    classe: VERIFIED
    valeur: enregistrer-lot integre, decisions philo-3 et readiness-2 consommees, handoff.js verifier conforme
  - id: regression-ci-handoff
    classe: VERIFIED
    valeur: test_handoff_v2_20260905.js 53/53, test_handoff_enregistrer_lot_20260909.js 7/7
  - id: migrations-16-18-19-20
    classe: VERIFIED
    valeur: manifeste-migrations-production-1.md, exclues Test/CI par leur propre en-tete
  - id: migration-21-dependance
    classe: VERIFIED
    valeur: bloquee, nexus_live_events cree uniquement par migration Test-only 18
  - id: comparateur-advisor-select-only
    classe: VERIFIED
    valeur: comparaison-seed-referentiel-advisor.sql, aucune ecriture, non execute contre Production
  - id: preprod-anonymise
    classe: DECLARED
    valeur: plan-preprod-anonymise-1.md, statut INCONNU/NON_CONSTRUIT assume
  - id: repetition-migrations
    classe: NOT_APPLICABLE
    valeur: aucun acces Test/PREPROD depuis ce canal GitHub Issue
  - id: plan-reparation-rollback
    classe: VERIFIED
    valeur: plan-reparation-rollback-1.md, code vs donnees distingues
  - id: criteres-live-production
    classe: VERIFIED
    valeur: nexus-live-criteres-production.js, 27/27, mutation negative, non cable dans projection
  - id: regression-globale
    classe: VERIFIED
    valeur: 228/237, 9 echecs historiques identiques, 0 regression
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 0 finding, verifier-apprentissage conforme 20 regles
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Réconciliation du rail (régression CI corrigée) + périmètre hors Production de decision-2.md

## 1. Réconciliation du rail Handoff — régression CI diagnostiquée et corrigée

Ce checkout démarrait exactement au HEAD canonique `e364b781` (`decision-2.md`).
`node outils/handoff.js verifier` échouait avec la même erreur `LOT_HORS_REGISTRE`
que celle déjà décrite dans `request-2.md` : `NEXUS-PRODUCTION-READINESS-1-20260908`
existe sous `docs/handoff/lots/` mais restait absent de `STATE.json.lots` sur le
HEAD canonique, car le correctif `enregistrer-lot` produit lors d'une session
antérieure (`claude/issue-28-20260909-0019`) n'avait jamais été intégré à
`config-par-environnement`. C'est exactement la cause du 10e échec rouge signalé
dans le réveil (`test_handoff_v2_20260905.js`, run `34303711005`), pas une
régression nouvelle.

Correction appliquée, fichier par fichier, vérifiée identique à la source :
- `outils/handoff.js` : fonction `validerEnveloppesLot` extraite de
  `validerRegistre`, nouvelle commande `enregistrer-lot <LOT_ID>` qui rejoue les
  mêmes contrôles avant d'inscrire un lot déjà déposé par commit direct.
- `test_handoff_enregistrer_lot_20260909.js` (nouveau, 7/7).
- `node outils/handoff.js enregistrer-lot NEXUS-PRODUCTION-READINESS-1-20260908`
  a inscrit le lot (`ATTENTE_DECISION`, `derniere_demande: request-2.md`, 2
  décisions déjà déposées).
- Une seconde contradiction est apparue une fois ce trou comblé :
  `NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908` avait lui aussi une décision
  (`decision-3.md`, `closes: true`, déposée directement par Frédéric) jamais
  consommée sur le HEAD canonique — `PLUSIEURS_LOTS_ACTIFS`. Consommée
  (`node outils/handoff.js consommer NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908`,
  commit `90276b4`) avant de poursuivre, sans quoi le registre restait à deux
  lots actifs simultanés.
- `node outils/handoff.js consommer NEXUS-PRODUCTION-READINESS-1-20260908` a
  ensuite marqué `decision-2.md` consommée (commit `e364b7812f552a1ef3b9e0e779ddbb7674a19296`,
  exactement le commit de décision cité dans le réveil).

**Preuve mesurée après correction** : `test_handoff_v2_20260905.js` → **53/53**
(il échouait avant la réconciliation, sur le registre réel de ce checkout — pas
une trace manuelle). `test_handoff_enregistrer_lot_20260909.js` → **7/7**.
`node outils/handoff.js verifier` → conforme, 29 lots, 10 avertissements (tous
préexistants et déjà autorisés par Frédéric dans des lots antérieurs), 0
nouvelle erreur. Les 9 autres échecs historiques (`test_chaine_temporelle_carburant_20260821.js`,
`test_inventaire_*`, `test_pilotage_qualite_receptions.js`, `test_reception_*`)
n'ont pas été touchés ni reclassés — ils restent identiques à la liste connue.

## 2. Migrations 16/18/19/20 — fermeture de dépendances, pas une gate fondateur

`inventaire-migrations-1.md` confirme statiquement les 21 migrations séparant
`origin/production` (`501c0c7`, ancêtre direct vérifié) de la candidate
`ba1eed0e833c354f556128dc0ee4b0619725ed1a`. `manifeste-migrations-production-1.md`
tranche, par lecture de dépendances plutôt que par préférence :
- **16 incluses** dans la release Production ;
- **4 exclues par défaut** (#16, #18, #19, #20) — chacune se déclare elle-même
  Test/CI dans son propre en-tête (rôle `nexus_ci_recette` borné à
  `nexus-station-test`, table `nexus_live_events` « Test uniquement — NON
  appliquée en Production ») ;
- **#21 BLOQUÉE/EXCLUE** — elle altère `nexus_live_events`, une table créée
  **uniquement** par la migration Test-only #18. Aucune migration de ce dépôt
  ne crée cette table pour Production ; l'appliquer échouerait à l'exécution.
  Deux conditions de déblocage explicites sont posées (migration Production
  dédiée, ou décision canonique de promotion de NEXUS Live), aucune tranchée
  ici — pas un choix arbitraire.

## 3. `seed_referentiel_advisor` — comparateur SELECT-only produit

`comparaison-seed-referentiel-advisor.sql` reprend **à l'identique** le bloc
`VALUES` de `20260905161500_seed_referentiel_advisor.sql` (6 gabarits +
31 règles, vérifié champ par champ contre le fichier de migration réel) et
compare, `code` par `code`, `COMPLETEE`/`ECRASEE`/`IDENTIQUE`, avec la liste
exacte des champs divergents. Recherche explicite dans le fichier : aucun
`insert/update/delete/drop/alter/truncate/grant/revoke` — strictement `SELECT`.
Exécutable par l'Orchestrator via l'accès Production existant ; aucun secret
pour Claude. Non exécuté dans ce lot (aucun accès Production dans ce canal) —
ne suppose aucun résultat.

## 4. PREPROD anonymisé — plan de conception, statut assumé INCONNU

`plan-preprod-anonymise-1.md` recense les champs porteurs de donnée
personnelle par lecture de schéma, pose un principe de mapping déterministe
(HMAC à clé éphémère, jamais committée), et fixe trois preuves manquantes
(script de construction, épreuve automatisée anti-fuite, revue humaine)
avant de pouvoir déclarer PREPROD « anonymisé et prouvé ». Aucune donnée
Production lue, aucun script exécutable créé. Statut explicitement
**INCONNU / NON CONSTRUIT** — pas une case remplie par confort.

## 5. Répétition des migrations — non faite, honnêtement

Ce canal GitHub Issue n'a ni accès réseau ni identifiants vers un
environnement Test/PREPROD où rejouer réellement les 16 migrations incluses.
Ce point reste `NOT_APPLICABLE` dans ce lot, cohérent avec la restriction
documentée depuis le 06/09/2026 sur ce workflow.

## 6. Plan de réparation en avant / rollback

`plan-reparation-rollback-1.md` distingue rollback CODE (symétrique,
déterministe, une ligne par migration incluse) et rollback DONNÉES (limité
aux trois migrations DML #3/#5/#6, avec la règle d'export préalable
obligatoire avant toute exécution Production). Fenêtre de déploiement :
les mesures existantes (16 `en_cours`, 13 clôturables) sont traitées comme
une mesure ponctuelle, pas une fenêtre garantie — critère de re-mesure
explicite avant la gate. `procedure-release-production-1.md` fixe les 11
étapes de toute promotion future, avec la gate humaine de Frédéric comme
seule étape non automatisable.

## 7. Critères « Prêt pour Production » — module testé, non câblé dans Live

`nexus-live-criteres-production.js` implémente les dix critères exacts de
`decision-2.md` §7, fail-closed (un fait absent est `INCONNU`, jamais `OK`
par défaut), et calcule `gate_humaine_frederic`/`autorisation_production`
**séparément** de `verdict` — `PRET_POUR_PRODUCTION` reste atteignable avant
que Frédéric ait tranché (c'est le sens même de « peut être soumis à
Frédéric »), et `autorisation_production: AUTORISEE` exige les dix critères
**et** une gate nommant explicitement la même release, jamais l'un sans
l'autre. `test_nexus_live_criteres_production_20260909.js` — **27/27**, dont
une épreuve retirant chacun des dix critères isolément et une mutation
négative (`false` ne produit jamais `OK`). **Non câblé** dans
`nexus-live-projection.js` : ce fichier est modifié activement par Frédéric
(~800 lignes non revues), l'y insérer sans revue risquerait une régression
sur un écran déjà en évolution — livré autonome et testé plutôt que forcé.

## Preuves globales mesurées dans cette session

- `node run-tests.js` → **228/237**, les 9 échecs strictement identiques à la
  liste historique tolérée par la CI — 0 régression imputable.
- `node outils/guardians-router.js` → 0 finding.
- `node outils/verifier-apprentissage.js` → conforme, 20 règles.
- `node outils/handoff.js verifier` → conforme après consommation des deux
  décisions, 10 avertissements tous préexistants.

## Pourquoi un humain doit-il intervenir ici ?

Aucune décision de fondateur n'est nécessaire à ce stade : la fermeture de
dépendances Test/CI applique un principe déjà canonique (isolation
Test/Production), sans choix produit ouvert. Le package de readiness n'est
**pas complet** pour la gate finale (PREPROD non construit, migrations non
rejouées, mesures Production non fraîches) — ce retour documente une
progression déterministe, pas une demande d'arbitrage. Le prochain arbitrage
utile serait la gate finale elle-même, une fois toutes les preuves
`decision-2.md` §7 réellement acquises.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun
identifiant disponible dans ce canal), aucune promotion Production, aucun
secret/PIN/service_role ajouté ou exposé, aucun fichier applicatif métier
touché (diff limité à `outils/handoff.js`, `docs/handoff/`,
`nexus-live-criteres-production.js` et ses tests).
