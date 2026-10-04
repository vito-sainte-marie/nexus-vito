---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7-production=30544c9-inchangees
  - id: transport-2206-deja-fait
    classe: VERIFIED
    valeur: origin-claude-issue-28-20261004-2206-et-origin-handoff-continuite-20260920-meme-sha-c001e94
  - id: decision-3-deposee-consommee-sur-branche
    classe: VERIFIED
    valeur: commit-ab76ef6-depot-d1768a0-consommation-pas-encore-sur-rail-canonique
  - id: regression-globale
    classe: VERIFIED
    valeur: 295-304-9-echecs-historiques-identiques
  - id: regression-fdj
    classe: VERIFIED
    valeur: node-run-tests.js-fdj-36-36
  - id: guardians
    classe: VERIFIED
    valeur: router-0-finding-qa-0-finding-apprentissage-conforme-langage-conforme
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme-avant-apres-35-lots
  - id: preuve-navigateur-dette-3-chemins
    classe: DECLARED
    valeur: non-realisee-limite-inchangee-depuis-request-3
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucune-variable-environnement-supabase-production-dans-ce-canal
  - id: point-zero
    classe: DECLARED
    valeur: specifie-non-execute
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration-production
---
# Suite autorisée par `decision-3.md` — transport Handoff, décision déposée/consommée sur branche

Réponse à `decision-3.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-3.md`) — GO explicite de Frédéric Bragance dans l'issue
#28 (04/10/2026) : « ARBITRAGE HUMAIN — GO REQUEST-3 FDJ CARNETS ».

## 0. SHA et rail

- HEAD canonique lu au démarrage de cette session : `c001e94`
  (`handoff-continuite-20260920`, identique à `origin/claude/issue-28-20261004-2206`
  — voir §1).
- Branche de travail de cette session : `claude/issue-28-20261004-2314`,
  créée à partir du rail canonique.
- Commit `ab76ef6` — dépôt de `decision-3.md` (via `outils/handoff.js
  decision`, enveloppe conforme par construction).
- Commit `d1768a0` — consommation de `decision-3.md` + régénération des
  miroirs v1.

## 1. Transport de `claude/issue-28-20261004-2206` — déjà fait avant cette session

Vérifié avant toute écriture : `git diff origin/claude/issue-28-20261004-2206
origin/handoff-continuite-20260920 --stat` est **vide**. Les deux refs
pointent sur le **même commit** (`c001e944b87b469d9641694803c84f207993db4a`).
Le transport demandé par le GO était donc déjà réalisé — par fast-forward,
sans commit étranger, avant le démarrage de cette session (aucune trace de
l'opération exacte visible depuis ce canal : ni fetch ni `gh pr list` ne
sont exécutables ici, réseau sortant bloqué — voir §6). Confirmé par le
contenu : `git diff --stat` entre `53d7cb6~1` et `c001e94` ne touche que
`NEXUS-FDJ-v1.html`, `NEXUS-FDJ-Manager-v1.html`, les fichiers Handoff du
lot, un seed SQL Test et les tests FDJ — aucun fichier `ANON5`/sécurité,
aucun `.github/workflows/*`, aucun fichier `main`/`production`.

## 2. `decision-3.md` — déposée et consommée, PAS ENCORE sur le rail canonique

Conformément au GO, `decision-3.md` a été déposée et consommée via
`outils/handoff.js` (jamais écrite à la main) :

```
STATE.json : FDJ-CARNETS-LEDGER-AUDIT-1-20261004
  statut            : DECISION_CONSOMMEE
  derniere_demande  : request-3.md
  derniere_decision : decision-3.md
  commit_decision   : ab76ef6243b3c67251960c24ad8518c1ea7d89d7
  consomme_le       : 2026-10-04T23:20:41.008Z
```

**Limite honnête, pas masquée** : ces deux commits (`ab76ef6`, `d1768a0`)
existent uniquement sur `claude/issue-28-20261004-2314` à ce stade. Ce canal
ne peut pousser que sur sa propre branche (`git-push.sh` refuse tout
refspec autre que `<branche-courante>`) — il ne peut pas écrire directement
sur `handoff-continuite-20260920`. **Le rail canonique contient donc
toujours `request-3.md` et le correctif des 3 chemins (hérités du transport
du §1), mais PAS ENCORE `decision-3.md` ni sa consommation.** Un geste
d'intégration (PR `claude/issue-28-20261004-2314` → `handoff-continuite-20260920`,
même mécanisme que celui qui a déjà transporté le §1) reste nécessaire pour
que `STATE.json` canonique reflète `DECISION_CONSOMMEE`.

## 3. CI/Guardians proportionnés — exécutés réellement dans ce canal

`node` fonctionne dans ce canal cette fois (contrairement à une partie de
l'historique antérieur de ce fil) :

| Contrôle | Résultat |
|---|---|
| `node run-tests.js` (suite complète) | **295/304** — les 9 échecs strictement identiques à la liste historique connue (`test_reception_moteur.js`, `test_reception_v1_dom.js`, etc.), aucune régression |
| `node run-tests.js fdj` | **36/36** |
| `node outils/guardians-router.js` | 0 finding (2 fichiers changés, scopes `orchestrator`/`handoff`) |
| `node outils/guardian-qa.js` | 0 finding (304 épreuves) |
| `node outils/verifier-apprentissage.js` | conforme, 21 règles, aucun doublon |
| `node outils/garde-langage-nexus.js` | conforme, 1477 tirets cadratins préexistants, aucun ajout |
| `node outils/handoff.js verifier` | conforme avant/après (35 lots, 15 avertissements, 11 dérogations — tous préexistants) |

Ces résultats sont strictement identiques à ceux déjà rapportés par
`request-3.md` (295/304, 36/36) — aucune régression introduite par le dépôt
de `decision-3.md` lui-même (fichiers Handoff uniquement).

## 4. Limite connue conservée, pas masquée (point 7 du GO)

La stabilisation des 3 chemins à clé fraîche (`jetonsActivationImplicite`,
`jetonsActivationCarnet`, `jetonsCorrectionManager`) reste prouvée
**causalement en Node** (mutation négative réellement rejouée, `request-3.md`
§2) **sans preuve navigateur dédiée** — le script de qualification existant
exerce `eprouverCleFraicheSansEcriture`, pas la mise en cache du jeton par
les 3 fonctions appelantes elles-mêmes (`request-3.md` §3, limite inchangée
depuis son dépôt). Non masquée, non refabriquée ici.

## 5. Contrôles Production READ-ONLY (point 8 du GO)

`audit-production-lecture-seule-1.sql` reste inchangé (3 requêtes
strictement `SELECT`). Recherche explicite par **nom** de variable
d'environnement dans ce canal :

```
noms correspondant à /SUPABASE|PRODUCTION|NEXUS_PROD/i : []
```

Aucune variable `SUPABASE*`/`*PRODUCTION*`/`NEXUS_PROD*` n'existe dans ce
canal. **`NOT_APPLICABLE`** — réservé à l'Orchestrator, conformément au GO.

## 6. Point Zéro (point 9 du GO)

`spec-point-zero-inventaire-fdj.md` inchangé. **Non exécuté** : aucune
migration, aucun code, aucune donnée créée.

## 7. Écart de migration `20261004130000`

**Non traité**, explicitement hors de ce geste, conformément à
l'interdiction du GO.

## Verdict proposé

**`DECISION-3_DEPOSEE_CONSOMMEE_SUR_BRANCHE`** — le correctif des 3 chemins
et `request-3.md` sont déjà sur le rail canonique (transport antérieur à
cette session, §1, SHA identique prouvé). `decision-3.md` et sa
consommation sont déposées et prouvées conformes, mais résident encore sur
`claude/issue-28-20261004-2314` : une intégration (PR vers
`handoff-continuite-20260920`) reste nécessaire pour que le registre
canonique les reflète. CI/Guardians proportionnés exécutés et verts, 0
régression. Limite navigateur toujours assumée. Ce verdict ne vaut ni
promotion Production ni clôture du lot — **STOP avant tout geste Production,
nouvel arbitrage humain attendu avant la suite.**

## Ce qui reste hors de ce request

- Intégration de `claude/issue-28-20261004-2314` sur `handoff-continuite-20260920`
  (PR à ouvrir/merger — même mécanisme que le transport déjà opéré pour
  `claude/issue-28-20261004-2206`).
- Les 3 requêtes `SELECT` de `audit-production-lecture-seule-1.sql` —
  toujours réservées à l'Orchestrator, aucun accès Production dans ce canal.
- Preuve navigateur dédiée de la stabilisation des 3 chemins — limite
  assumée, inchangée.
- Point Zéro Inventaire FDJ — spécifié, toujours pas exécuté.
- Écart de migration `20261004130000` sur `production` — hors de ce geste.

## Invariants respectés

Aucun changement `main`/`production`, aucune fusion vers `production`,
aucun déploiement Production, aucune migration Production, aucune
écriture/réparation Production, aucune gate Pages Production, aucune
opération sur l'écart `20261004130000`, aucun secret créé/lu/exposé, Point
Zéro non exécuté, aucune réécriture d'un historique validé, aucun commit
étranger au lot FDJ Carnets.
