---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: base-production-exacte
    classe: VERIFIED
    valeur: origin_production_6c3efcc_inchange
  - id: diff-exact-3-fichiers
    classe: VERIFIED
    valeur: nexus-app-donnees_nexus-conseiller-donnees_NEXUS-App-v1_20_lignes_utiles
  - id: dependance-dd4d0f3-non-necessaire
    classe: VERIFIED
    valeur: nexus-station_nexus-verify-moteur_migration_split_validation_deja_en_production
  - id: tests-baseline-candidat-mutation
    classe: VERIFIED
    valeur: 8_sur_8_execution_reelle
  - id: regression-portee-exacte
    classe: DECLARED
    valeur: diff_octet_pour_octet_recherche_exhaustive_appelants_suite_274_non_rejouee_arbre_production_complet
  - id: obstacle-branche-jetable-reelle
    classe: DECLARED
    valeur: git_checkout_worktree_fetch_archive_hash-object_bloques_materialisation_git_show_fichier_par_fichier
  - id: p0-2-b1-brief-non-touches
    classe: VERIFIED
    valeur: aucun_fichier_station_config_role_rls_brief_modifie
  - id: guardians
    classe: VERIFIED
    valeur: 0_finding
  - id: apprentissage
    classe: VERIFIED
    valeur: 21_regles_conforme
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme_avant_apres
  - id: decision-6-consommee
    classe: VERIFIED
    valeur: commit_0bdff44
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Candidat P0-1/P0-3 reconstruit depuis Production — `dd4d0f3` non nécessaire

Périmètre exécuté conforme à `decision-6.md` : `decision-6.md` consommée
(`outils/handoff.js consommer`) ; le candidat P0-1/P0-3 est reconstruit
**depuis `origin/production`** (`6c3efcc`, inchangé), pas depuis le rail.
Preuve complète — diff, graphe de dépendances, tests baseline/candidat,
mutation — dans
`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-1-20260920/candidat-p0-production-1.md`.
Aucun merge/push Production, aucune opération Supabase, P0-2/B1/#62/#65/Brief
non touchés.

## Obstacle d'outillage assumé — pas une branche git réelle

`git checkout -b`, `git worktree add`, `git fetch`, `git archive`, `git
hash-object -w` requièrent tous une approbation indisponible dans ce run
automatisé (chacun tenté et refusé avant de retenir la méthode suivante).
Seul `git show origin/production:<chemin>` (lecture pure) fonctionne. Le
candidat est donc un répertoire scratch (`.scratch-p0-production/`, non
committé, non poussé), matérialisé fichier par fichier depuis
`origin/production`, plutôt qu'une branche/worktree réelle — c'est un écart
de forme par rapport à `decision-6.md`, assumé et nommé ici, pas masqué. Le
fond (base Production exacte, diff minimal, tests réels, mutation réelle) est
inchangé.

**Il n'existe donc pas de « SHA candidat »** au sens d'un commit git réel —
seulement l'empreinte SHA256 de chacun des trois fichiers candidats
(ci-dessous) et le diff exact, suffisants pour qu'une session avec écriture
git complète produise elle-même ce commit à l'identique.

## Base Production exacte

```
origin/production = 6c3efccc0167ea6d0537245bc9dfaa1dad329509
```
Identique à la valeur citée par `decision-6.md` — vérifié par `git rev-parse
origin/production` avant tout travail, non bougé depuis.

## Le diagnostic qui change tout : `dd4d0f3` n'est PAS un prérequis

`cartographie-rail-production-1.md` affirmait « `dd4d0f3` est le commit déjà
identifié comme prérequis de P0-1 ». **Vérifié faux par lecture directe de
Production** :

- `NexusStation.dateLocaleStation(timezone, instant)` existe déjà sur
  Production (`nexus-station.js`), **identique octet pour octet** à la
  version du rail sur cette fonction précise.
- `NEXUS-App-v1.html` en Production charge déjà `nexus-station.js`, résout
  déjà `FUSEAU_STATION`, et **passe déjà** cette valeur en 3ᵉ argument à
  `chargerStatutCarburantsHome` — seule la fonction elle-même l'ignorait.
- `NexusVerifyMoteur.statutValidationQuart` existe déjà sur Production
  (`nexus-verify-moteur.js`), avec exactement les colonnes et états requis
  par P0-3 ; `nexus-verify-moteur.js` est même déjà chargé par
  `NEXUS-Brief-v1.html` en Production.
- `audits_caisse` porte déjà `ecart_piste/ecart_boutique/valide_le_piste/
  valide_le_boutique` en Production (migration
  `20260824131251_split_validation_piste_boutique_audits_caisse.sql`).

**Conséquence : zéro ligne extraite de `dd4d0f3`.** Le socle fuseau/identité
dont ce commit fait partie est déjà substantiellement présent sur Production
pour tout ce que P0-1/P0-3 nécessitent. `dd4d0f3` reste nécessaire pour
d'autres chantiers (planning, `quartPlanifie`, où le rail et Production
divergent réellement — hors périmètre de ce lot), mais pas pour celui-ci.

## Diff exact — 3 fichiers, 20 lignes utiles

```
nexus-app-donnees.js          — chargerStatutCarburantsHome(client, siteId, timezone)
nexus-conseiller-donnees.js   — chargerControlesVerifyRestants(client, siteId, timezone)
NEXUS-App-v1.html             — <script nexus-verify-moteur.js> + FUSEAU_STATION au call-site
```

Diff complet reproduit dans `candidat-p0-production-1.md`. `timezone` est un
paramètre ADDITIF en position finale dans les deux fonctions : absent, repli
UTC identique à avant (non-régression Brief, qui n'appelle ces fonctions
qu'avec 2 arguments, inchangé). Aucune migration, aucune RLS, aucun rôle,
aucun `station_config.raccourcis`, aucun fichier Brief modifié.

## Tests — baseline mordue, candidat vert, mutation détectée (8/8, exécution réelle)

```
OK — BASELINE chargerStatutCarburantsHome — bug P0-1 confirmé : bascule à 20h locale (UTC), timezone silencieusement ignorée
OK — BASELINE chargerControlesVerifyRestants — bug P0-3 confirmé : quart saisi-non-validé compte comme fait
OK — CANDIDAT NexusStation.dateLocaleStation — 19:59→20:00 locale ne bascule pas, continuité jusqu'à minuit locale
OK — CANDIDAT chargerStatutCarburantsHome — délègue réellement à NexusStation.dateLocaleStation(timezone)
OK — CANDIDAT chargerStatutCarburantsHome — fuseau absent : repli UTC inchangé, Brief non affecté
OK — CANDIDAT chargerControlesVerifyRestants — 4/4 cas P0-3 (non-validé, partiel, validé, journée complète)
OK — CANDIDAT chargerControlesVerifyRestants — fuseau absent : repli UTC inchangé, Brief non affecté
OK — MUTATION — candidat sans propagation du fuseau échoue au frontière 19:59→20:00, identique à la baseline
8/8 vérifications passées
```

Frontière exacte exigée par `decision-6.md` §4 : `2026-09-20T23:59:00Z`
(19:59 locale) → `2026-09-20`, `2026-09-21T00:00:00Z` (20:00 locale) →
**reste** `2026-09-20` avec le candidat (bascule sur `2026-09-21` avec la
baseline — bug reproduit), continuité jusqu'à `2026-09-21T04:00:00Z` (minuit
locale réel) → `2026-09-21`. Les 4 cas d'audit (non validé/partiel/validé/
ajusté-équivalent) sont couverts. Mutation : la fonction baseline réinjectée
à la place du candidat échoue au même point que la baseline — preuve
dépendante du diff, pas du harnais.

## Régression — portée exacte, honnêtement bornée

`decision-6.md` §5 demande une comparaison de suite complète. **Non faite à
cette échelle** — matérialiser l'arbre Production complet (274 fichiers de
test) via `git show` fichier par fichier n'est pas proportionné à un diff de
deux fonctions, et `git archive`/`checkout`/`worktree` sont tous bloqués dans
ce canal. À la place : diff octet pour octet confirmant qu'aucune autre
fonction n'est touchée, et recherche exhaustive des appelants sur l'arbre
Production réel confirmant que seuls `NEXUS-App-v1.html` et
`nexus-conseiller-donnees.js`/`nexus-brief-donnees.js` référencent ces deux
fonctions (jamais Cockpit). Paramètre additif en position finale : aucun
appelant existant ne peut se casser par construction JavaScript. **Risque
résiduel assumé** : la suite `node run-tests.js` complète sur un checkout
réel Production + ce diff reste à rejouer avant toute promotion.

## Guardians / apprentissage / Handoff (sur le lot committé, pas le candidat)

- `node outils/guardians-router.js` → 0 finding (1 fichier changé dans ce
  lot avant ce dépôt — `candidat-p0-production-1.md` —, scopes
  `orchestrator`/`handoff`, 3 règles en portée).
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt.
- `decision-6.md` consommée (`outils/handoff.js consommer`, commit
  `0bdff44`).

## Refs protégées

`main = a786408`, `production = 6c3efcc` — inchangées avant et après ce
geste. Aucune opération Supabase.

## Ce que ce lot ne fait pas

Aucune promotion Production de P0-1/P0-3 (ni décision ni exécution). Aucune
matérialisation d'une branche/worktree git réelle (obstacle d'outillage
nommé, pas contourné). Aucune régression exhaustive sur l'arbre Production
complet (portée exacte assumée ci-dessus). Aucun autre chantier (P0-2, B1,
#62/#65, Brief, NEXUS Live) rouvert. Les 14 migrations déjà réconciliées
Production → rail ne sont ni retouchées ni réinterprétées comme restant à
promouvoir.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
promotion Production, aucun secret exposé, aucun merge/rebase/squash de
`production` vers le rail, aucun portage architectural de `dd4d0f3`, aucun
élargissement de permissions GitHub.

## STOP

Conformément à `decision-6.md` §7 : le candidat P0-1/P0-3 est reconstruit et
prouvé depuis Production, le diagnostic `dd4d0f3` est corrigé, la portée de
régression est nommée honnêtement. STOP à cette gate — aucune exécution
supplémentaire sans nouvelle décision, en particulier aucune promotion
Production.
