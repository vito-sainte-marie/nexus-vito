# Cartographie du rail face à Production — les 433 commits

**21/09/2026.** Audit demandé par l'Orchestrateur. **Aucune écriture** : tout ce
qui suit est lu depuis git, sur `origin/production` (`6c3efcc`) et
`origin/handoff-continuite-20260920` (`f444f3c`). Aucune branche protégée n'a
été touchée, aucun workflow déclenché.

Ce document répond à la mesure que je déclarais manquante dans la stratégie
publiée sur l'issue #28 : « Je n'ai pas audité les 433 commits : nombre
d'unités cohérentes, part de travail Test/CI sans vocation à monter, part de
code mort. C'est la mesure à faire avant tout calendrier. »

## Méthode

```
git log --format='%H|%ad|%an|%s' origin/production..origin/handoff-continuite-20260920
git cherry origin/production origin/handoff-continuite-20260920
git log --no-merges --name-only <même plage>   # classement par surface
```

Chaque commit est classé par les **surfaces de fichiers** qu'il touche, dans cet
ordre de priorité : `MIG` (`supabase/migrations/`), `DOC` (`docs/`), `CI`
(`.github/`), `OUT` (`outils/`), `TEST` (`test_*`, `recette*`), `APP` (tout
`.js`/`.html`/`.css` restant, c'est-à-dire le code réellement servi par GitHub
Pages), `AUT` (le reste). Un commit peut porter plusieurs surfaces.

## Le compte, d'abord

| Mesure | Valeur |
|---|---|
| Commits dans la plage | **433** |
| dont commits de fusion | 10 |
| Commits porteurs de contenu | **423** |
| `git cherry` : sans équivalent sur Production (`+`) | **422** |
| `git cherry` : équivalent déjà présent (`-`) | **1** |

L'écart 433 / 423 est entièrement expliqué par les 10 fusions, que `git cherry`
ignore. **Le rail n'a pratiquement rien en commun avec Production par un autre
chemin** : un seul commit sur 423 a déjà un équivalent en amont. Il n'y a donc
aucun espoir de voir la divergence se résorber d'elle-même.

## Ce que le rail contient vraiment

Répartition des 423 commits par surface (un commit peut compter plusieurs fois) :

| Surface | Commits |
|---|---|
| `DOC` — documentation et registre | **316** |
| `TEST` — épreuves | 168 |
| `OUT` — outillage | 121 |
| `APP` — **code servi en Production** | **79** |
| `CI` — chaînes GitHub | 47 |
| `MIG` — migrations | 30 |

Et surtout, les deux chiffres qui commandent tout le reste :

- **207 commits sur 423 (49 %) ne touchent QUE `docs/`.**
- **322 commits sur 423 (76 %) ne touchent ni l'applicatif ni les migrations** —
  ils n'ont, par construction, **rien à monter en Production**.

Contre-mesure indépendante, sur le texte des sujets : 203 commits sur 433 (47 %)
mentionnent explicitement `handoff`, `registre`, `répétition`, `recette`,
`gate`, `guardian` ou `orchestration`. Les deux méthodes concordent.

### Le volume applicatif réel

```
git diff --numstat origin/production...origin/handoff-continuite-20260920 \
  -- '*.js' '*.html' '*.css' \
  ':(exclude)docs/*' ':(exclude)outils/*' ':(exclude)test_*' ':(exclude).github/*'
→ 105 fichiers, +6152 −872
```

**105 fichiers et +6152 −872 lignes** : voilà la dette applicative. Ce n'est pas
433 commits qu'il faut promouvoir, c'est **79 commits touchant 105 fichiers**.

## L'amplitude : quatre commits font la divergence

Les 79 commits applicatifs sont très inégaux :

| Amplitude | Commits |
|---|---|
| ≥ 20 fichiers applicatifs | **2** |
| 5 à 19 fichiers | 10 |
| 2 à 4 fichiers | 29 |
| 1 seul fichier | 38 |

Les quatre balayages transversaux, qui expliquent à eux seuls la longue traîne
de fichiers touchés une seule fois et **la majorité des 32 fichiers en conflit** :

| Fichiers | SHA | Sujet |
|---|---|---|
| 31 | `cf3e66d` | A3-6 — trente pieds de page signés du nom d'un autre commerce |
| 27 | `0f1b7b0` | LANG-004 : les agents portent leur nom devant l'utilisateur |
| 17 | `dd4d0f3` | A3 / C1 client — le fuseau devient un contexte explicite de bout en bout |
| 15 | `58e394b` | fix(navigation): identifier une page indépendamment de l'hébergeur (A8) |

`dd4d0f3` est le commit déjà identifié comme **prérequis de P0-1** : sans lui,
le correctif se porte proprement sur Production et reste inopérant, parce que
`timezone` n'y est jamais propagé.

## Les lots cohérents

Le rail n'est pas un magma : il porte des identifiants, et **le registre Handoff
nomme déjà la plupart de ces lots**. La cartographie ci-dessous ne crée pas de
taxonomie nouvelle, elle relie ce qui existe.

### Socle — identité, site, fuseau (04–05/09)

`A2` `A3` (et A3-1, A3-3, A3-6, B1, C1, C2, C2-4, C3) `A4` `A4-bis` `A8` `A11`
`A12` `A14` `A15` `A16` `A6`, plus les gardes `2B-SECURITY-WRITE-GUARD`,
`MUTATION-SITE-GUARD`, `INSERT-SITE-GUARD`, `CREATEUR-SITES-GUARD`,
`STATIC-GUARD-FINDINGS`. Lots registre : `SITE-EXPLICITE-1-*`.

C'est **le socle dont tout le reste dépend** : c'est lui qui rend le site et le
fuseau explicites de bout en bout. Contient les quatre balayages transversaux.
Rien de ce qui suit ne fonctionne en Production sans lui.

### Service et prise de poste (05/09)

`S-1` à `S-5`, `B1`. Migrations **et** applicatif : reprise des services
ouverts, unicité du service en cours, clôture par le pointage de départ,
rattachement d'un comptage au service actif. Lots registre :
`B1-REJEU-NAVIGATEUR-20260905`, `VERIFY-QUART-AUTOMATIQUE-20260905`.
**Dépend du socle** (l'heure de la station).

### Carburants (06–08/09)

`CARB-004` (11 commits), `CARB-006`, `CARB-007`, `Q65`. Jour commandable vs jour
de livraison, plafond de cuve, capacités de station. Lots registre :
`CARBURANTS-PERFORMANCE-*-20260906`. **Dépend du socle** (capacité de cuve =
donnée du site).

### Pointage — correctif terrain (11–13/09)

`NEXUS-POINTAGE-CORRECTIF-1-20260911` : le départ qui ne dépend plus d'une
pause, les deux portes vers la prise de poste, la photo devenue complémentaire,
le service neuf qui héritait des pointages de l'ancien, la file hors ligne.
C'est le lot le plus proche du terrain, **et le mieux documenté** (huit
documents de preuve au registre). Contient P0-1 et P0-3.

### Langage et vocabulaire (05–08/09)

`LANG-003`, `LANG-004`, `C2` vocabulaire. Transversal par nature (27 fichiers
d'un coup), sans effet fonctionnel. **Promouvable séparément, à faible risque
métier mais fort risque de conflit textuel.**

### NEXUS Live / Développement (07–08/09)

~11 commits, `nexus-live-*.js` + `NEXUS-Live-Developpement-v1.html`, `LIVE-001`.
Écran de pilotage interne. Lot registre :
`NEXUS-LIVE-CONTROL-CENTER-1-20260906`. **Nouveau surface, aucun conflit
attendu** : il n'existe pas sur Production.

### Qualité, gardes, évaluation (08/09)

`DEBUG-001`, `COACH-001`, `EVAL-001`, `ARCH-003`, « Gates : répondre n'est pas
résoudre », « Barrière Production ». Corrections de fond sur ce que NEXUS
affirme. Lot registre : `NEXUS-PHILOSOPHIE-LANGAGE-AUDIT-1-20260908`.

### Sécurité base (07–09/09)

`SEC-018`, `SEC-020`, `SEC-021`, `SEC-022`, `Q76`, RLS du rôle CI. **Migrations
uniquement.** À lire en regard des 14 migrations de Production absentes du rail.

### Processus — sans vocation à monter

`PREPROD` (9 commits), répétition, registre Handoff, orchestration, guardians,
recette navigateur, outillage. **C'est le gros des 322 commits sans surface
applicative ni migration.** Ce travail a sa valeur, mais il ne concerne pas ce
que voit un chef de piste.

## Ce que cette cartographie change

1. **La file d'attente est trois fois plus petite qu'annoncée.** « 433 commits à
   promouvoir » est faux : 76 % du rail n'a rien à faire en Production. La
   mesure honnête est **79 commits, 105 fichiers, +6152 −872**.
2. **Les lots ne sont pas indépendants.** Le socle identité/fuseau commande le
   service, les carburants et le pointage. Tout ordre de promotion qui ne le
   place pas en premier produit des correctifs verts et inopérants — c'est
   exactement le piège déjà mesuré sur P0-1.
3. **Le conflit est concentré.** Quatre commits de balayage expliquent
   l'essentiel des 32 fichiers en conflit. Les traiter en premier, seuls,
   désamorce la suite.
4. **Rien ne se résorbera tout seul** : 422 des 423 commits n'ont aucun
   équivalent en amont.

## Ce que je n'ai pas mesuré

- **La part de code mort.** Repérer ce qui n'est appelé par rien demande une
  analyse de graphe d'appel, pas un classement de surfaces. Non fait.
- **Le contenu des 30 commits de migration face aux 14 migrations de Production
  absentes du rail.** La dette de topologie reste caractérisée, pas résolue.
- **Si un lot donné passe les gardes une fois isolé.** La cartographie dit
  ce qui est séparable ; elle ne dit pas ce qui est vert.

## STOP

Document de mesure. **Aucune promotion, aucun ordre de fusion n'est proposé
ici** : l'ordonnancement appartient à l'Orchestrateur. Refs au moment de
l'audit, inchangées : `main=a786408`, `production=6c3efcc`,
`handoff-continuite-20260920=f444f3c`.
