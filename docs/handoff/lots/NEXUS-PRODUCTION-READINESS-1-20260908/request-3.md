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
    valeur: handoff.js verifier conforme, enregistrer-lot et consommer rejoues a l identique
  - id: manifeste-migrations
    classe: VERIFIED
    valeur: 16 incluses, 4 exclues Test/CI, 1 bloquee migration 21 depend de nexus_live_events Test-only
  - id: mesures-production-declarees
    classe: DECLARED
    valeur: 5 faits transmis par l Orchestrator le 08/09 vers 20h57 Martinique, non reverifies faute d acces Production
  - id: sql-comparaison-seed-advisor
    classe: VERIFIED
    valeur: fichier construit, strictement SELECT, non execute
  - id: preprod-anonymise
    classe: DECLARED
    valeur: conception seule, statut INCONNU NON CONSTRUIT
  - id: plan-rollback-release
    classe: VERIFIED
    valeur: plan-reparation-rollback-1.md et procedure-release-production-1.md rediges
  - id: criteres-live-production
    classe: VERIFIED
    valeur: module et test 14 sur 14, mutation negative verifiee, non cable dans nexus-live-projection.js
  - id: regression-globale
    classe: VERIFIED
    valeur: 228 sur 237, 9 echecs historiques inchanges
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router 1 finding NexusStock deja connu, verifier-apprentissage conforme
  - id: ci-canonique-bf40b9a
    classe: NOT_APPLICABLE
    valeur: integration sur config-par-environnement hors de portee de cette session
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Manifeste Production, mesures déclarées intégrées, plans PREPROD/rollback/release, critères Live — et limite de portée CI/branche

## 1. Ce qui restait de la reconciliation `bf40b9a`

Rejoué à l'identique sur cette branche (voir commit dédié) : `outils/handoff.js
enregistrer-lot`, inscription du lot, consommation de `decision-3.md`
(Philosophie/Langage) et `decision-1.md` (Readiness), `request-2.md`,
`inventaire-migrations-1.md`. Vérifié à nouveau ici, pas seulement recopié :
`handoff.js verifier` conforme, `test_handoff_v2_20260905.js` 53/53,
`test_handoff_enregistrer_lot_20260909.js` 7/7.

## 2. Décision déterministe sur les migrations Test/CI — appliquée

`manifeste-migrations-production-1.md` (nouveau) : 16 migrations incluses
dans la release Production, 4 exclues par défaut (16, 18, 19, 20 — portée
Test/CI par leur propre en-tête), 1 **BLOQUÉE/EXCLUE** (21 —
`actor_role_human_pour_autorisation_frederic` altère `nexus_live_events`,
créée uniquement par la migration 18 elle-même Test-only ; aucune migration
Production dédiée n'existe pour cette table). Condition de déblocage
explicite pour #21 : soit une migration Production dédiée à
`nexus_live_events` avec RLS revue pour ce contexte, soit une décision
canonique explicite promouvant NEXUS Live en Production. Aucune des deux
n'existe à ce jour.

## 3. Mesures Production déclarées par l'Orchestrator — intégrées, pas revérifiées

Les cinq faits transmis dans le réveil (colonne `sites.timezone` absente,
2 sites tous deux `America/Martinique` côté `station_config` ; 17 lignes
`shifts` et 89 lignes `mission_catalog` divergentes ; 13 services clôturables
sur 16 `en_cours` mesurés) sont repris dans `inventaire-migrations-1.md`,
section « Mesures Production déclarées par l'Orchestrator », **classés
DECLARED** — cette session n'a elle-même aucun accès Production (inchangé
depuis le 06/09/2026), donc ne peut pas les reclasser VERIFIED. Lecture : la
migration #4 (fuseau horaire) ne présente plus de risque d'écrasement connu
(valeur unique partagée par les 2 sites) ; la migration #3 a un impact
chiffré exact (17 + 89) ; la migration #6 reste la plus sensible (13 des 16
services actifs requalifiés).

## 4. SQL de comparaison `seed_referentiel_advisor` — construit, non exécuté

`comparaison-seed-referentiel-advisor.sql` (nouveau, strictement `SELECT`,
aucune écriture) : reprend à l'identique les VALUES des deux inserts de la
migration (6 gabarits, 31 règles), les compare par `LEFT JOIN` sur `code` aux
tables réelles, et rapporte pour chaque ligne `COMPLETEE` / `ECRASEE` (avec
la liste exacte des champs divergents) / `IDENTIQUE`, plus un résumé chiffré
par table. Aucun résultat n'est supposé : ce fichier pose la question, il ne
la répond pas — à exécuter contre Production en lecture seule dès qu'une
session en a les moyens, avant toute application de la migration #5.

## 5. Poursuite en autonomie hors Production

- `plan-preprod-anonymise-1.md` : recensement des champs porteurs de donnée
  personnelle (lecture de schéma, pas de données), principe de mapping
  déterministe par site de construction (clé HMAC éphémère, jamais
  committée), et surtout la limite assumée : les champs de texte libre
  (commentaires, autocritiques) ne peuvent pas être anonymisés par simple
  substitution d'identifiant — ils doivent être remplacés entièrement tant
  qu'aucun détecteur de contenu identifiable n'existe et n'est éprouvé.
  Statut explicite : **INCONNU / NON CONSTRUIT** — aucun dump, aucun script,
  aucune preuve d'absence de donnée personnelle n'existe à ce jour.
- `plan-reparation-rollback-1.md` : rollback CODE par migration (schéma/
  fonction, réversible) distinct du rollback DONNÉES (seules #3, #5, #6
  touchent des lignes existantes) ; règle de sauvegarde préalable (`SELECT`
  exporté hors dépôt avant #3/#5/#6) ; critère de fenêtre de déploiement
  fail-closed pour #6 (13/16 services `en_cours` seraient requalifiés).
- `procedure-release-production-1.md` : onze étapes, de la candidate figée à
  la vérification post-application, avec la règle explicite qu'aucune preuve
  antérieure (CI sur une branche de travail, mesure vieille de plusieurs
  jours) ne remplace une vérification fraîche à la gate, et que l'étape 8
  (gate humaine) n'est jamais automatisable.
- `criteres-pret-pour-production-1.md` + `nexus-live-criteres-production.js`
  (nouveau module pur) + `test_nexus_live_criteres_production_20260909.js`
  (14/14, mutation négative vérifiée : un fait `false` ne peut jamais
  produire un statut `OK`) : sept critères fail-closed, dont une gate
  humaine qui doit nommer explicitement la release qu'elle autorise — une
  gate sur une autre release est `BLOQUE`, jamais confondue. **Non câblé**
  dans `nexus-live-projection.js` : ce fichier est activement modifié par
  Frédéric depuis le 08/09/2026 ; l'y insérer sans revue complète de ses
  ~800 lignes risquerait une régression sur un écran déjà en évolution.
  Le module est autonome, testé, prêt à être consommé dès qu'une session a
  le temps de la revue nécessaire.

## 6. Preuve CI demandée sur `test_handoff_v2_20260905.js` — limite honnête

Le réveil demande la preuve CI correspondant au commit `bf40b9a` une fois
« intégré au canonique ». Cette session ne peut pousser que sur sa propre
branche (`git push`/`merge`/`cherry-pick`/`checkout <ref> -- <fichier>` vers
`config-par-environnement` refusent tous une approbation qu'aucun humain ne
peut donner dans ce run automatisé — vérifié explicitement dans cette
session, pas supposé). Le correctif est donc rejoué ici à l'identique et
prouvé **localement** : `test_handoff_v2_20260905.js` 53/53,
`test_handoff_enregistrer_lot_20260909.js` 7/7, `run-tests.js` 228/237 (9
échecs historiques inchangés), `guardians-router.js` 1 finding (collision
`NexusStock` déjà connue, `ARCH-002`, non nouvelle), `verifier-apprentissage.js`
conforme. La preuve CI sur le commit canonique lui-même reste à obtenir
après intégration effective sur `config-par-environnement` — pas fabriquée
ici.

## Guardians

Architecture & Cohérence : PASS (aucun calcul métier dupliqué ; le seul
finding du routeur est la collision `NexusStock` déjà tracée). Security &
Isolation : PASS (aucun secret, aucune opération Supabase, aucun accès
Production tenté ou simulé). Business Rules : PASS (aucune règle métier
Carburants touchée). QA/Regression : PASS (228/237, 0 régression, mutation
négative du nouveau module vérifiée). Bible/Philosophie : PASS (chaque case
INCONNU l'est réellement, aucune n'est complétée par confort ; `35 000 L`
n'est pas rouvert).

## Limites résiduelles honnêtes

1. Intégration sur `config-par-environnement` non faite — obstacle de
   permission de cette session, pas contourné (commandes exactes ci-dessous).
2. `comparaison-seed-referentiel-advisor.sql` non exécuté contre Production —
   aucun accès disponible ici.
3. PREPROD anonymisé reste à l'état de conception — aucun script, aucune
   preuve d'absence de donnée personnelle.
4. Critères Live non câblés dans `nexus-live-projection.js` — module
   autonome livré à la place, par prudence sur un fichier en évolution
   active.
5. Fenêtre de déploiement et mesure #5 restent à rafraîchir juste avant toute
   gate — la mesure du 08/09 ~20:57 est explicitement datée, pas permanente.

## Pour intégrer depuis une session outillée (écriture `config-par-environnement`)

```
git fetch origin claude/issue-28-20260909-0100 config-par-environnement
git checkout -b lot/production-readiness-manifeste-plans origin/config-par-environnement
git checkout origin/claude/issue-28-20260909-0100 -- \
  outils/handoff.js docs/handoff/STATE.json \
  docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/ \
  nexus-live-criteres-production.js test_nexus_live_criteres_production_20260909.js \
  test_handoff_enregistrer_lot_20260909.js
node outils/handoff.js miroirs
node test_handoff_v2_20260905.js && node test_handoff_enregistrer_lot_20260909.js && node test_nexus_live_criteres_production_20260909.js
node outils/handoff.js verifier
git commit -m "handoff: manifeste migrations Production, plans PREPROD/rollback/release, criteres Live"
git push origin lot/production-readiness-manifeste-plans:config-par-environnement
```
