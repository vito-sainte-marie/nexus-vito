# Étude — isolation Test des candidats web (#62, #65)

Portée : §2.1 de `request-1.md`. Étude seulement, conformément à la réserve posée par
`request-1.md` (« l'étude est portée au dossier avant toute modification »). Aucun fichier
applicatif touché par ce document ; aucune branche candidate modifiée.

## 1. Ce qui existe déjà et qu'il ne faut pas recréer

Le rail (`handoff-continuite-20260920`) résout DÉJÀ ce problème pour lui-même, mesuré le
22/09/2026 (`outils/recette-navigateur-test.js`, section « OÙ EST NEXUS TEST ») :

- Cloudflare Pages construit chaque branche poussée sur le projet `nexus-test-ddf.pages.dev`,
  à une adresse dérivée du nom de branche : `https://<alias>.nexus-test-ddf.pages.dev/`, alias
  calculé par `aliasCloudflare(nomDeBranche)` — minuscules, non-alphanumérique → tiret, 28
  caractères au plus.
- Ce projet Cloudflare est déjà scopé Test : la mesure du 22/09 confirme `environnement: test`
  et `Supabase udljdqxerrbbbajxubfn` (le projet Test) pour l'alias de `handoff-continuite-20260920`.
  Rien n'indique que ce soit propre à cette branche : l'environnement se fixe au niveau du
  projet Cloudflare, pas par branche.
- L'adresse ne se recopie jamais en dur : `urlTestDuRail()` la dérive du rail déclaré dans
  `docs/handoff/STATE.json` via `node outils/handoff.js rail`, la même commande que la CI.

**Conséquence directe : le mécanisme d'adressage Test n'a pas besoin d'être inventé.**
`aliasCloudflare()` prend déjà n'importe quel nom de branche en argument — rien dans sa
signature n'est spécifique au rail. Seule `urlTestDuRail()` est câblée sur la seule source
« rail du registre » ; c'est le seul point à généraliser, et à la marge (voir §3).

## 2. Ce qui manque réellement sur #62 et #65 — deux causes indépendantes, déjà mesurées

Mesuré dans `dossier-decision-pr-62.md` et `dossier-decision-pr-65.md` (lot 1, 22/09/2026),
confirmé par lecture directe des deux fichiers depuis ce lot :

1. **`nexus-auth.js` est la version pré-refonte (932 lignes)** sur `fe4e9a2` (#62) et `fe36a8e`
   (#65) : elle code `uzhjpqpctpvxytxpxoqz.supabase.co` — Supabase **Production** — en dur, et
   n'interroge jamais `window.NEXUS_CONFIG`. Les deux candidats sont antérieurs à la refonte du
   04/09/2026 (`config-par-environnement`) qui a introduit l'indirection.
2. **Aucune chaîne de build sur ces branches** : ni `outils/build.sh`, ni
   `outils/generer-config.js`, ni `nexus-page.js`, ni `nexus-bandeau-environnement.js` n'existent
   sur ces lignées. Sans eux, même en supposant l'environnement Cloudflare correctement scopé
   Test, rien ne génère `nexus-config.js` au build : l'ancien `nexus-auth.js` ignorerait de
   toute façon `window.NEXUS_CONFIG`, qui n'existerait même pas.

**Ce que cela implique, et qu'il faut dire sans l'arrondir : le risque n'est pas qu'un
déploiement Cloudflare existant écrive dans Production aujourd'hui.** Le check GitHub
`Cloudflare Pages` est mesuré rouge sur `fe4e9a2` et `fe36a8e` (et, selon `dossier-decision-pr-62.md`
§3, « rouge sur *toutes* les branches du dépôt depuis toujours, et n'a jamais publié quoi que ce
soit ») : aucune page servie aujourd'hui, aucune écriture possible aujourd'hui. Le risque est
conditionnel — formulé au conditionnel dans `dossier-decision-pr-65.md` §8.2 (« un déploiement
de branche [...] **servirait** une page parlant à Production ») et non au présent — mais
`request-1.md` l'a formulé au présent (« sert donc une page qui parle à Production »). Cet écart
de formulation est noté ici comme un écart, pas silencieusement aligné sur l'une ou l'autre
version : ce que les deux dossiers mesurent réellement, c'est qu'aucune page n'est actuellement
servie pour ces deux SHA précis, et que la raison du rouge Cloudflare sur ces branches n'a pas
été établie (config Cloudflare non lisible depuis ce canal — voir §4).

Cela ne change rien à la conclusion opérationnelle de `request-1.md` : la recette navigateur
reste indisponible pour ces deux candidats tant que les deux causes ci-dessus ne sont pas
levées, et il ne faut pas la lancer avant qu'elles le soient — un déploiement qui recommencerait
à publier (le check passant au vert) le ferait avec l'ancien `nexus-auth.js`, donc vers
Production.

## 3. Ce que « mécanisme minimal » devrait vouloir dire

Deux volets distincts, et ils ne se traitent pas au même endroit :

### 3.1 Généraliser l'adressage (volet outillage, sur le rail — sûr, réversible)

`urlTestDuRail()` ne sait dériver que l'adresse du rail du registre. Ajouter, à côté d'elle et
sans la modifier, une fonction du type `urlTestDeBranche(nomDeBranche)` qui applique directement
`aliasCloudflare(nomDeBranche)` — sans passer par `handoff.js rail` — permettrait à une recette
manuelle de viser explicitement un candidat, sans jamais coder son nom en dur dans un fichier
versionné : le nom de branche resterait un paramètre d'appel (CLI ou variable d'environnement
nommée explicitement, jamais une constante). C'est une extension de trois lignes, pas un nouveau
module, et elle ne change le comportement d'aucun appelant existant.

### 3.2 Porter la chaîne de configuration sur les candidats (volet branches, hors de ce dépôt de travail)

Les quatre fichiers qui manquent sur #62/#65 existent déjà, identiques, sur le rail :
`outils/build.sh`, `outils/generer-config.js`, `nexus-page.js`, `nexus-bandeau-environnement.js`,
et le `nexus-auth.js` de 305 lignes qui lit `window.NEXUS_CONFIG`. Le porter sur chaque candidat
est un remplacement mécanique de ces fichiers précis par leur version du rail — **pas** une
réécriture, **pas** une refonte de configuration : c'est exactement l'objet déjà tranché et non
rouvert ici (la refonte du 04/09/2026). Le reste de chaque candidat — son propre delta métier
(FDJ pour #62, Carburants pour #65) — resterait intact.

Ce geste modifie des branches candidates existantes (`rebuild/fdj-62-20260922`,
`rebuild/carburants-65-20260922`), pas ce lot de travail. Il n'a pas été exécuté dans cette
étude : au-delà de la réserve explicite de `request-1.md` (étude d'abord), le comprendre
correctement demande de savoir CE QUE Cloudflare sert réellement aujourd'hui sur ces branches
(§4) avant de changer quoi que ce soit dessus — sans quoi une correction pourrait être postée
sans que personne ne sache si elle change le verdict du check rouge, ou seulement son contenu.

## 4. Ce que ce canal ne peut pas mesurer

Aucun accès réseau sortant et aucun identifiant Cloudflare dans ce canal (confirmé par
construction : `.github/workflows/claude.yml` ne les expose pas, cohérent avec toute la série de
réveils précédents sur cette issue). Trois faits externes restent donc non vérifiables d'ici, et
ne doivent pas être supposés :

1. la cause exacte pour laquelle le check GitHub `Cloudflare Pages` est rouge sur `fe4e9a2` et
   `fe36a8e` (échec de build faute de `outils/build.sh` ? intégration GitHub↔Cloudflare cassée
   indépendamment du contenu de la branche ? autre chose ?) ;
2. si les variables d'environnement Cloudflare (`NEXUS_ENV`, `NEXUS_SUPABASE_URL`,
   `NEXUS_SUPABASE_ANON_KEY`) sont réellement scopées Test au niveau du **projet**
   `nexus-test-ddf.pages.dev` pour toute branche, ou seulement pour certaines ;
3. si un déploiement de branche pour ces deux candidats, une fois le §3.2 appliqué, répondrait
   effectivement (le rouge pourrait persister pour une tout autre raison).

## 5. Ce que cette étude recommande, sans le faire elle-même

1. Ajouter `urlTestDeBranche()` (§3.1) — sûr, réversible, n'affecte aucune preuve existante.
   Candidat à une exécution immédiate dans ce lot, sans nouvel arbitrage : outillage pur, aucun
   secret, aucune Production, aucune modification de `main`.
2. NE PAS porter les fichiers de configuration sur #62/#65 (§3.2) avant d'avoir au moins observé,
   depuis un poste avec accès Cloudflare, ce qui est réellement construit et servi aujourd'hui
   pour une branche candidate — faute de quoi la correction se ferait à l'aveugle sur un système
   dont l'état actuel n'est pas mesuré depuis ce canal.
3. Traiter le §3.2 comme un geste distinct, séquencé après cette observation, avant que la
   demande 3 (dossier #62) puisse rejouer une recette navigateur réelle.

Aucune modification `main`/`production`, aucune opération Supabase Production.
