# Dossier de décision — PR #62, FDJ Vague 1 (cycle de vie de la caisse)

Établi le 22/09/2026. Ce dossier s'arrête à un **GO / NO GO de fusion**. Il ne demande ni
déploiement, ni migration Supabase Production : ce sont des gates distinctes, postérieures.

## 1. Le candidat

| | |
|---|---|
| PR | [#62](https://github.com/vito-sainte-marie/nexus-vito/pull/62) — « FDJ Vague 1 — le cycle de vie de la caisse, du quart ouvert par la prise de poste à la validation manager » |
| Branche | `fdj-vague1-cycle-caisse-20260916` (non protégée) |
| **SHA candidat** | **`fe4e9a2bf7e2ee15fc302e7d89c59be2259fe6d2`** |
| Base | `production` = `2bc7b39dd73a35d8031f850e202095370a1db85a` |
| `mergeable` / `mergeable_state` | `true` / `unstable` |

**Le SHA a été relu depuis GitHub, pas repris de confiance.** Consigne du Créateur : «
considérer les SHA GitHub obtenus comme les nouveaux candidats, pas `fe4e9a2`/`fe36a8e` par
confiance implicite ». Lecture faisant foi : `gh api repos/vito-sainte-marie/nexus-vito/git/ref/heads/fdj-vague1-cycle-caisse-20260916`
→ `fe4e9a2bf7e2ee15fc302e7d89c59be2259fe6d2`, identique à `gh api …/pulls/62 → .head.sha`.

`gh pr view --json headRefOid` a été écarté : il rendait encore `MERGEABLE/BLOCKED` alors que
l'API des refs donnait déjà l'état réel.

Le SHA poussé est *identique* au commit local d'intégration — pas seulement équivalent. L'égalité
de SHA est donc elle-même la preuve d'égalité d'arbre ; il n'y a rien à comparer en plus.

## 2. Ce que le candidat contient

- 30 commits en avance sur `production`, **0 en retard** — `merge-base` = la tête de
  `production` elle-même. Le candidat ne dépend d'aucun rail.
- 42 fichiers, +16 905 / −760.
- **12 migrations ajoutées**, de `20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql` à
  `20260916221100_fdj_commande_saisie_caisse_manager.sql`. Le dépôt passe de 276 à 288
  migrations.
- **Aucune instruction destructrice active.** Recherche de `drop table|drop column|drop
  schema|drop database|truncate|delete from|drop policy` sur les 12 fichiers : 18
  correspondances, **toutes en commentaire** (notes de retour arrière). Zéro hors commentaire.

`git merge-tree --write-tree production fe4e9a2` : fusionne proprement, aucun conflit.

## 3. Les preuves ordinaires, sur ce SHA exact

Run **35763212401** — workflow `Tests`, `success`, 2026-09-22T17:50:25Z. Job `non-regression`,
**11 étapes, 11 vertes** :

```
 1 Set up job                                          7 Simulations métier
 2 actions/checkout@11d5960a                           8 Infrastructure — empreinte de l'artefact
 3 actions/setup-node@49933ea5                         9 Infrastructure — garde de l'artefact Pages
 4 Cohérence des épingles de cache                    10 Infrastructure — un `pull_request` ne peut pas déployer
 5 Suite de non-régression                            11 Guardian Philosophie NEXUS — rapport
 6 Comparer aux échecs connus
```

L'étape 8 est verte : les deux constantes d'empreinte ont bien été re-mesurées avec le lot de
migrations (`MIGRATIONS_REELLES_NOMBRE = 288`, empreinte `116fc821…`). C'est la contre-épreuve
attendue de « tout lot de migrations rougit l'épreuve d'empreinte » : ici elle ne rougit pas,
donc les constantes suivent le lot.

Check-runs sur `fe4e9a2` :

| Check | Conclusion | Requis par le ruleset `production` ? |
|---|---|---|
| `non-regression` (×2 : `push` + `pull_request`) | success | **oui** |
| `Construire et éprouver l'artefact` | success | **oui** |
| `Cloudflare Pages` | failure | non |
| `Déployer sur GitHub Pages` | skipped | non |
| `Supabase Preview` | skipped | non |

**Les deux checks requis sont verts.** C'est pourquoi `mergeable_state` vaut `unstable` (un
check non requis est rouge) et non `blocked`.

`Cloudflare Pages` est rouge sur *toutes* les branches du dépôt depuis toujours et n'a jamais
publié quoi que ce soit ; il n'est pas requis. Ce n'est pas une régression de #62.

**Rien n'a été déployé.** Le workflow `Déploiement Production (GitHub Pages)` s'est bien
déclenché (run 35763413971, `success`), mais son job `Déployer sur GitHub Pages` est `skipped` :
seul `Construire et éprouver l'artefact` a tourné. Vérifié job par job, pas déduit du vert du
run.

## 4. Ce qui n'existe pas pour ce SHA — à ne pas convertir en succès

> « Inscrire explicitement au dossier que la recette navigateur profonde n'existe pas pour leur
> SHA. Ne pas transformer son absence en succès ou en preuve équivalente. » — Frédéric, 22/09.

**La recette navigateur profonde n'existe pas pour `fe4e9a2`.** Ce n'est ni un échec, ni un
saut : c'est une **absence structurelle**, mesurée dans le fichier lui-même.

`.github/workflows/tests.yml` sur `fe4e9a2` ne contient aucune occurrence de :

```
NEXUS_REF_EST_LE_RAIL : 0    Playwright      : 0    journal Live : 0
recette navigateur    : 0    PostgreSQL Test : 0
```

Le workflow du rail en déclare 48 étapes nommées ; celui de `fe4e9a2` en déclare 8, et en
exécute 11 en tout. L'étape de résolution du rail et les cinq étapes profondes (connexion
PostgreSQL Test, semis Carburants, journal Live, installation Playwright, recette navigateur) ne
sont pas conditionnées à faux : **elles ne sont pas dans le fichier.**

Conséquences à énoncer sans les adoucir :

- Il n'y a **aucune preuve « SHA attendu ↔ SHA servi »** pour `fe4e9a2`. La preuve de ce type
  obtenue le 22/09 porte sur `a4e86c0`, qui ne contient ni le code ni les migrations de #62.
  Elle ne se transporte pas.
- Il n'y a **aucun parcours navigateur** exécuté contre ce code : ni prise de poste, ni cycle de
  caisse, ni validation manager. Les 11 étapes vertes sont des épreuves Node et des gardes
  d'infrastructure, pas une recette d'usage.
- Les 12 migrations **n'ont été appliquées à aucune base** au titre de ce SHA. Aucune connexion
  PostgreSQL Test n'a eu lieu dans ce run.
- Un vert à 11/11 ici et un vert à 51/51 sur le rail ne se comparent pas. Le premier ne dit rien
  de ce que le second mesure.

Cause : la preuve profonde est aujourd'hui réservée à la ref déclarée rail au registre. Faire de
`fdj-vague1-cycle-caisse-20260916` un rail pour l'obtenir serait recréer le défaut qu'on vient de
supprimer — une désignation déplacée pour arranger un cas. Le Créateur a explicitement renvoyé
cette question à une évolution d'architecture CI séparée, hors de #62/#65.

## 5. Ce qu'une fusion n'accomplit pas

- **Fusionner ne déploie pas.** La mise en ligne Pages est un geste distinct, sur gate séparée.
- **Fusionner n'applique pas les migrations.** La base Production est à 276 ; le dépôt passerait
  à 288. L'écart serait de 12, et il se résorbe par une gate Supabase Production distincte, non
  demandée ici.
- **Ordre avec #65 :** les deux candidats partent de la même tête de `production` et fusionnent
  chacun proprement, mais **pas l'un sur l'autre**. `git merge-tree fe4e9a2 fe36a8e` rend un
  conflit, un seul, de contenu, dans `.github/deploiement/test_empreinte_artefact_20260915.js` —
  les deux constantes d'empreinte (288 d'un côté, 277 de l'autre, 289 en réalité une fois les
  deux fusionnés). Conflit **textuel et visible**, pas sémantique et silencieux. Le second
  fusionné devra re-mesurer ses deux constantes ; sans cela l'étape 8 rougira sur `production`.

## 6. La décision demandée

**GO / NO GO de fusion de #62 vers `production`**, sur le SHA
`fe4e9a2bf7e2ee15fc302e7d89c59be2259fe6d2` et lui seul. Si la tête de la branche bouge,
l'autorisation tombe et le dossier est à refaire.

Aucune fusion Production automatique. Aucun déploiement et aucune migration Production ne sont
demandés par ce dossier, quelle que soit la réponse.
