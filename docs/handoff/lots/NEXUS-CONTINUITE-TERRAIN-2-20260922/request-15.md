---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 15
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: decision-materialisee
    classe: VERIFIED
    valeur: decision-10-approved_with_conditions-closes-false-consommee
  - id: frontiere-autorite-documentee
    classe: VERIFIED
    valeur: consolidation-sans-nouvelle-tentative-transport
  - id: artefacts-prets-non-transportes
    classe: DECLARED
    valeur: harnais-realignes-deja-sur-le-rail-transport-non-tente
  - id: ci-candidate
    classe: NOT_APPLICABLE
    valeur: rien-de-nouveau-sur-la-candidate-ce-tour
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Décision matérialisée, frontière d'autorité documentée une seule fois — Phase 1-4 non engagées

## 1. `decision-10.md` matérialisée et consommée

En réponse au programme de stabilisation transmis par le Créateur (issue #28, 24/09/2026,
Phase 0), l'arbitrage a été déposé exclusivement via `outils/handoff.js decision`
(`NEXUS-CONTINUITE-TERRAIN-2-20260922/decision-10.md`, `APPROVED_WITH_CONDITIONS`,
`closes: false`, en réponse à `request-14.md`), puis consommé
(`node outils/handoff.js consommer`, commit `6fe993c`). Le registre reste conforme après dépôt
et après consommation (`node outils/handoff.js verifier` : 32 lots, 15 avertissements — tous
préexistants, 0 nouvelle erreur).

Verdict : la question `request-14.md` §6 est tranchée en faveur de la voie 1 — transport des
deux harnais réalignés pour remplacer les originaux défaillants sur la candidate — sans
réouvrir le périmètre applicatif de `decision-9.md`. La dette qu'ils corrigent (garde
`NEXUS_CONFIG` jamais stubée par les harnais originaux) reste qualifiée dette historique
indépendante et isolée, pas une gate rendue artificiellement verte.

## 2. Frontière d'autorité documentée une seule fois

`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/frontiere-autorite-transport-1.md`
(nouveau, déposé dans ce même tour, commit `6fe993c`) consolide — sans les reproduire — les
preuves déjà établies par `request-13.md` (six formes d'écriture testées et refusées, réseau
brut joignable mais délibérément non utilisé pour contourner via le jeton d'installation).
Conformément à l'instruction explicite du Créateur, **aucune de ces méthodes n'a été retestée**
dans ce tour.

## 3. Artefacts déjà prêts, transport non tenté depuis ce canal

Les deux harnais réalignés existent déjà sur le rail canonique, inchangés depuis leur dépôt
antérieur, prêts à être appliqués par une autorité Git capable d'écrire
`rebuild/carburants-65-20260922` :
- `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_regularisation_manager_20260916-harnais-realigne-1.js`
  (en remplacement de `test_regularisation_manager_20260916.js`)
- `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/test_cloture_services_obsoletes_20260916-harnais-realigne-1.js`
  (en remplacement de `test_cloture_services_obsoletes_20260916.js`)

Ce tour n'a tenté ni push, ni cherry-pick, ni aucune autre écriture vers cette branche —
conformément à l'instruction du Créateur de ne pas générer une nouvelle boucle request/repair
identique. Le transport est délégué à l'Orchestrator ou au connecteur GitHub, comme demandé.

## 4. `#65` reste `NO GO` — Phase 1 non engagée

Aucune des gates de `decision-9.md` §4 n'est close par ce tour : CI candidate à mesurer sur le
commit qui portera le transport des harnais, `nexus-config.js` réellement servi ciblant
exclusivement Supabase Test, recette navigateur — tout cela reste dû après le transport.
Conformément au programme du Créateur (« Après verdict #65, ouvrir un lot infrastructure
dédié »), la Phase 1 (baseline reproductible) et les phases suivantes ne sont pas engagées dans
ce tour.

## Ce qui n'a pas été fait, honnêtement

- Aucune tentative de transport Git vers `rebuild/carburants-65-20260922` — délibérément, pas
  par incapacité non vérifiée.
- Aucune mesure CI nouvelle sur la candidate (rien n'a changé sur cette branche depuis
  `request-14.md`).
- Aucun travail engagé sur les Phases 1 à 4 du programme de stabilisation.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase Production, aucune
promotion Production, aucun changement de rôle/RLS/règle métier/UX, aucun secret lu ou exposé,
aucune écriture sur `rebuild/carburants-65-20260922` ni sur aucune branche hors de celle
assignée à cette session, aucun reset destructif de Test, aucun nouveau module produit.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail canonique.
