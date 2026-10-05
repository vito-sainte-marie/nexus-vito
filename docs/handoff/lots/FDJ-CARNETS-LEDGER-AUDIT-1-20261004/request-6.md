---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7-production=30544c9-inchangees
  - id: decision-5-deposee-consommee
    classe: VERIFIED
    valeur: commit-9d4eeab-depot-edff128-consommation-rail-sans-divergence
  - id: diff-rail-vs-branche
    classe: VERIFIED
    valeur: 3-fichiers-handoff-seulement-aucun-commit-etranger
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
    valeur: conforme-avant-apres-35-lots-15-avertissements-11-derogations
  - id: preuve-navigateur-dette-3-chemins
    classe: DECLARED
    valeur: secrets-presents-mais-reseau-sortant-indisponible-dans-ce-canal-teste-explicitement
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucune-variable-environnement-supabase-production-dans-ce-canal
  - id: point-zero
    classe: DECLARED
    valeur: specifie-non-execute
  - id: ecart-migration-20261004130000
    classe: VERIFIED
    valeur: aucune-reference-croisee-fdj-vers-les-4-fonctions-revoquees-hors-lot
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration-production
---
# Suite autorisée par `decision-5.md` — qualification finale, matrice de readiness

Réponse à `decision-5.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`, en
réponse à `request-5.md`) — GO explicite de Frédéric Bragance dans l'issue
#28 (05/10/2026) : « ARBITRAGE HUMAIN — GO REQUEST-5 FDJ CARNETS ».

## 0. SHA et rail

- HEAD du rail canonique **au démarrage de cette session** : `dd3c0b1`
  (`handoff-continuite-20260920`) — identique au `HEAD` de la branche de
  travail de cette session (`claude/issue-28-20261005-0001`) : aucune
  divergence constatée, aucun transport nécessaire avant d'agir.
- Commit `9d4eeab` — dépôt de `decision-5.md` (via `outils/handoff.js
  decision`, enveloppe conforme par construction).
- Commit `edff128` — consommation de `decision-5.md` + régénération des
  miroirs v1.
- `git diff --stat origin/handoff-continuite-20260920 HEAD` : **3 fichiers
  seulement** — `decision-5.md` (nouveau), `STATE.json`, `DECISION.md`
  (miroir). Aucun commit étranger, aucun fichier applicatif FDJ touché.
- `refs-protegees` : `main=d6093b7 production=30544c9` — identiques à
  `request-5.md`, inchangées.

## 1. Preuve navigateur des 3 chemins — toujours non réalisée, cause précisée cette fois

Nouveau dans cette session : les secrets `NEXUS_TEST_MANAGER_NOM`,
`NEXUS_TEST_CREATEUR_NOM`, `NEXUS_TEST_MANAGER_PIN`, `NEXUS_TEST_CREATEUR_PIN`
(exactement `SECRETS_REQUIS` de `outils/recette-navigateur-test.js`) sont
tous présents dans ce canal (recherche par nom, jamais par valeur) — une
amélioration réelle par rapport à `request-3.md`/`request-5.md`, où cette
preuve était bloquée par l'absence de PIN. L'adresse de recette se déduit
mécaniquement du rail (`aliasCloudflare('handoff-continuite-20260920')` →
`https://handoff-continuite-20260920.nexus-test-ddf.pages.dev`), sans aucune
valeur à deviner.

**Obstacle réel rencontré, testé explicitement, pas supposé** : toute
tentative de connexion réseau sortante depuis ce canal — `curl` vers cet
alias Cloudflare, y compris avec sandbox explicitement désactivé pour cette
commande précise, et `gh run list` — a été refusée par une approbation
qu'aucun humain ne peut donner dans ce run automatisé (contrairement à
`request-3.md`, qui avait bénéficié d'un accès réseau réel dans sa propre
session). Ce canal particulier n'a donc, cette fois, ni le réseau sortant ni
`gh`, malgré la présence des quatre secrets. `NEXUS_TEST_DB_AVAILABLE=0`
dans l'environnement confirme par ailleurs qu'un chemin de connexion
PostgreSQL direct en lecture n'est pas disponible non plus dans ce run — ce
qui est une capacité distincte (vérification SQL directe), pas celle que la
recette navigateur utilise, mais un indice cohérent avec un run dégradé.

**Conclusion honnête** : la preuve navigateur dédiée reste `DECLARED, non
réalisée` — pas par absence de secrets cette fois, mais par absence de
réseau sortant dans cette session précise. La preuve causale Node
(`request-3.md` §2, 12/12, mutation négative réellement rejouée) reste la
seule preuve de la stabilisation elle-même, non remplacée, non refabriquée.
Aucun doublon, aucune donnée inutile créée.

## 2. Audit Production READ-ONLY — NOT_APPLICABLE, confirmé par recherche fraîche

Recherche explicite par nom de variable d'environnement dans ce canal :

```
Object.keys(process.env).filter(k => /SUPABASE|PRODUCTION|NEXUS_PROD/i.test(k)) === []
```

Aucune variable `SUPABASE*`/`*PRODUCTION*`/`NEXUS_PROD*` n'existe dans ce
canal. `audit-production-lecture-seule-1.sql` (3 requêtes strictement
`SELECT`, relues : aucun `insert/update/delete/drop/alter`) reste inchangé
et prêt. **`NOT_APPLICABLE`** — réservé à l'Orchestrator avec accès réel,
conformément au GO. Jamais exécuté ni simulé.

## 3. Point Zéro — non exécuté, spécification conservée

`spec-point-zero-inventaire-fdj.md` inchangé (89 lignes, relu intégralement
dans cette session). **Non exécuté** : aucune migration, aucun code, aucune
donnée créée. Conformément au point 3 du GO, il n'est pas présenté comme un
prérequis technique à la promotion du correctif FDJ — c'est un geste
opérationnel post-déploiement, distinct.

## 4. Écart de migration `20261004130000` — vérifié indépendant, pas un bloqueur FDJ

Lu intégralement : `supabase/migrations/20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql`
révoque l'accès `anon` sur exactement 4 fonctions — `_generate_inventory_review_core`,
`generate_inventory_review`, `inventaire_enregistrer_transfert_localise`,
`stats_fondateur` — toutes liées à l'Inventaire/Rapport Direction/Admin
Sites, aucune au module FDJ. Vérifié par recherche croisée : aucun fichier
FDJ (migrations `*fdj*`, `NEXUS-FDJ-v1.html`, `NEXUS-FDJ-Manager-v1.html`,
`nexus-coach-fdj-moteur.js`) ne référence ces 4 noms de fonction ; le
correctif de ce lot (3 chemins à clé fraîche) ne touche que du JavaScript
côté client sur `fdj_stock_movements`, aucune migration SQL. L'en-tête de
la migration elle-même le confirme : « strictement additive […] aucune
migration historique n'est modifiée ».

**Conclusion** : aucune dépendance technique directe entre cet écart et le
correctif FDJ Carnets. Classé explicitement comme **dette globale
Production hors lot** (lot distinct `SECURITE-ANON5-20261004`), non traité
ici, non rouvert, non transformé en bloqueur FDJ artificiel — conformément
au point 4 du GO.

## 5. CI/Guardians proportionnés — exécutés réellement, identiques au baseline

| Contrôle | Résultat |
|---|---|
| `node run-tests.js` (suite complète) | **295/304** — 9 échecs strictement identiques à la liste historique, aucune régression |
| `node run-tests.js fdj` | **36/36** |
| `node outils/guardians-router.js` | 0 finding (2 fichiers changés, scopes `orchestrator`/`handoff`, 3 règles en portée) |
| `node outils/guardian-qa.js` | 0 finding (304 épreuves) |
| `node outils/verifier-apprentissage.js` | conforme, 21 règles, aucun doublon |
| `node outils/garde-langage-nexus.js` | conforme, 1477 tirets cadratins préexistants, aucun ajout |
| `node outils/handoff.js verifier` | conforme avant/après (35 lots, 15 avertissements, 11 dérogations, 0 nouveau) |

Résultats strictement identiques à ceux de `request-5.md` — aucune
régression introduite. Aucun run GitHub Actions dédié obtenu (`gh`
indisponible/réseau sortant bloqué, cf. §1) : les SHA ci-dessus sont des
commits locaux vérifiables, pas des run IDs CI.

## Matrice de readiness

| Catégorie | Élément | Statut |
|---|---|---|
| **Bloqueur réel propre au lot FDJ** | aucun identifié à ce jour (correctif prouvé causalement, 0 régression) | — |
| **Limite acceptée** | preuve navigateur dédiée des 3 chemins — non réalisée (réseau sortant indisponible dans ce canal ; preuve Node causale 12/12 en tenant lieu) | ACCEPTÉE, non bloquante par le GO |
| **Limite acceptée** | audit Production READ-ONLY — `NOT_APPLICABLE` (aucun accès Production depuis ce canal) | ACCEPTÉE, réservée à l'Orchestrator |
| **Dette hors lot** | écart de migration `20261004130000` (lot `SECURITE-ANON5-20261004`) — vérifié indépendant, non appliqué à Production | HORS LOT, non bloquant pour FDJ |
| **Opération post-déploiement** | Point Zéro Inventaire FDJ — spécifié, non exécuté, à faire après Production sur arbitrage distinct | DIFFÉRÉE, non bloquante avant gate |
| **Gate humaine Production** | aucune des étapes ci-dessus ne vaut autorisation ; leur complétion n'en vaudrait pas automatiquement une non plus | TOUJOURS REQUISE |

## Verdict explicite

**`NON_PRET_POUR_GATE_PRODUCTION`**

Motif : une seule condition du GO reste non remplie — la preuve navigateur
dédiée des 3 chemins à clé fraîche (point 1), qui demeure une limite
*acceptée* par construction du GO (« si une preuve navigateur fidèle est
techniquement disproportionnée ou impossible, documenter précisément
pourquoi ») mais qui n'a, à ce jour, jamais pu être réalisée dans un canal
Claude (trois tentatives : `request-3.md`, `request-5.md`, celle-ci). Toutes
les autres conditions du cycle de qualification sont acquises :
l'audit Production reste correctement hors de portée (`NOT_APPLICABLE`), le
Point Zéro reste non exécuté comme demandé, l'écart `20261004130000` est
vérifié indépendant et classé hors lot, et CI/Guardians restent verts et
identiques au baseline.

Ce verdict ne signifie pas que le lot est bloqué sans issue : il signifie
que la décision de considérer la preuve Node causale comme suffisante pour
franchir la gate — ou d'exiger une tentative supplémentaire de preuve
navigateur depuis un canal disposant réellement d'un accès réseau sortant
(par exemple la CI `tests.yml` elle-même, qui dispose de Playwright et des
mêmes secrets) — relève d'un arbitrage humain, pas d'un fait déterminable
depuis ce canal.

## Ce qui reste hors de ce request

Identique aux limites de la matrice ci-dessus — aucun nouveau travail Claude
n'est entrepris sur ces points dans ce geste, conformément au périmètre
strict du GO.

## Invariants respectés

Aucun changement `main`/`production`, aucune fusion vers `production`,
aucun déploiement Production, aucune migration Production, aucune
écriture/réparation Production, aucune gate Pages Production, aucune
opération sur l'écart `20261004130000`, aucun secret créé/lu/exposé (les 4
PIN/NOM présents ont été vérifiés par nom uniquement, jamais lus ni
affichés), Point Zéro non exécuté, aucune réécriture d'un historique
validé, aucun commit étranger au lot FDJ Carnets.
