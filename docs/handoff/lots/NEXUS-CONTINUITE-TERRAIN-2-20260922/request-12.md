---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 12
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: consommation-decision-9
    classe: VERIFIED
    valeur: commit-c9e0b76-marquee-consommee
  - id: node-check
    classe: VERIFIED
    valeur: syntaxe-valide-fichier-restaure-760-lignes
  - id: regle-role-source-unique
    classe: VERIFIED
    valeur: 1-occurrence-nexusEstManager
  - id: diff-mesure
    classe: VERIFIED
    valeur: 464-insertions-9-suppressions-un-seul-fichier-perimetre-verifie
  - id: harnais-1-vert
    classe: VERIFIED
    valeur: test_regularisation_manager_20260916-harnais-realigne-1-24-sur-24
  - id: harnais-2-vert
    classe: VERIFIED
    valeur: test_cloture_services_obsoletes_20260916-harnais-realigne-1-14-sur-14
  - id: tests-additionnels-verts
    classe: VERIFIED
    valeur: service_courant_unique-8-8-jour_metier_pointage-19-19-missions_jour_station-3-3
  - id: verification-negative
    classe: VERIFIED
    valeur: fuseau_station-plante-sur-original-120-123-sur-restaure-3-echecs-identiques-avant-apres
  - id: suite-candidate-complete
    classe: NOT_APPLICABLE
    valeur: git-fetch-checkout-worktree-archive-refuses-dans-ce-canal-224-tests-non-rejoues
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: aucune-permission-decriture-sur-rebuild-carburants-65-fichier-depose-dans-le-lot
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Restauration minimale exécutée sous `decision-9.md` — fichier livré, suite candidate complète hors de portée

## Ce qui a été fait

Consommation de `decision-9.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en réponse
à `request-11.md`) via `outils/handoff.js consommer`. Construction et exécution réelle du
plus petit assemblage qu'elle autorise, sur le fichier **actuel** de la candidate
(305 lignes, `290a217`), plutôt qu'un remplacement en bloc par une version historique —
explicitement interdit par `decision-9.md` §1.

Fichier livré : `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js`
(760 lignes). Détail complet, diff, et résultats de test dans
`preuve-restauration-minimale-65-20260924.md` (même répertoire).

## Résumé des preuves (détail dans `preuve-restauration-minimale-65-20260924.md`)

- `node --check` passe.
- Règle de rôle à source unique : 1 seule occurrence (`nexusEstManager`), conforme à
  l'assertion exacte du harnais.
- Diff contre `origin/rebuild/carburants-65-20260922:nexus-auth.js` : 464 insertions,
  9 suppressions, un seul fichier — relu ligne à ligne, limité strictement aux 5 éléments
  autorisés par `decision-9.md` §1, aucun bloc hors périmètre (vérifié : aucune trace de
  classification d'accès, aucune migration des trois fonctions de pointage exclues).
- Les deux harnais réalignés, **exécutés réellement** (pas rejoués depuis une zone jetable
  d'une session antérieure) : `test_regularisation_manager_20260916-harnais-realigne-1.js`
  → 24/24 ; `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` → 14/14.
  **38/38 assertions métier au vert.**
- Trois fichiers de test candidate additionnels, également exécutés réellement :
  `test_service_courant_unique_20260905.js` (8/8), `test_jour_metier_pointage_20260919.js`
  (19/19), `test_missions_jour_station_20260918.js` (3/3, 72 sous-contrôles).
- Vérification négative : `test_fuseau_station_20260918.js` plante totalement sur le
  fichier candidate original (fonction introuvable) ; passe à 120/123 sur le fichier
  restauré. Les 3 échecs résiduels sont **identiques avant et après** restauration
  (classification d'accès, explicitement exclue par `decision-9.md` §2) — aucune
  régression introduite.

## Ce qui reste hors de portée de ce canal

**La suite candidate complète (224 tests, comparaison au baseline connu 217/224) n'a pas
été rejouée.** `git fetch`, `git checkout <ref>`, `git worktree add`, `git archive` vers/depuis
`rebuild/carburants-65-20260922` restent tous refusés dans ce canal — retestés
explicitement dans cette session (y compris une boucle shell `for`, bloquée
indépendamment de toute cible Git). Reconstruire individuellement les ~224 fichiers de
test et leurs dépendances via `git show` un par un n'était pas praticable dans le temps de
cette session ; 6 des 19 fichiers désignés par `request-7.md` comme affectés par
`290a217` ont néanmoins été rejoués réellement (voir preuve, §4-§6) ; 3 tentatives
supplémentaires ont échoué par fichiers manquants dans cet environnement partiel
(`NEXUS-Verify-v1.html`, dépendances de `nexus-inventaire-transferts-internes.js`), pas
par un échec imputable au correctif — signalé honnêtement, pas maquillé en succès.

Conformément à `decision-9.md` §5 (transport), le fichier restauré et sa preuve sont
déposés dans ce lot, en commit atomique sur la branche de travail de cette session
(`claude/issue-28-20260924-0136`, commit `44fc13a`), plutôt que d'être écrits directement
sur `rebuild/carburants-65-20260922`.

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ou écriture Supabase Production,
aucun déploiement/promotion Production, aucun changement de rôle/RLS, aucun secret exposé.
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique. `#65` reste NO GO — les
gates suivantes de `decision-9.md` §4 (CI candidate verte, preuve `nexus-config.js`,
recette navigateur) ne sont pas acquises par ce lot et ne sont pas revendiquées ici.

## Retour attendu

Deux voies possibles, non tranchées ici :
1. Une session outillée (accès `git fetch`/`checkout`/`worktree` vers
   `rebuild/carburants-65-20260922`) rejoue la suite candidate complète (224 tests) contre
   le fichier livré et confirme/infirme l'absence de régression au niveau du dépôt entier ;
2. L'Orchestrator transporte lui-même `nexus-auth-restaure-65-20260924.js` vers la
   candidate (le mécanisme de rapatriement déjà utilisé pour les lots précédents de ce
   fil) puis fait tourner la CI candidate réelle.

La question ouverte de `request-11.md` §6 (cible d'écriture : candidate seule, ou aussi le
rail `handoff-continuite-20260920`) reste non tranchée par ce dépôt.
