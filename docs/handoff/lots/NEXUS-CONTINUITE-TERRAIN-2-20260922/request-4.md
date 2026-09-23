---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: commit-rebuild-verifie
    classe: VERIFIED
    valeur: 290a217f parent fe36a8e, 7 fichiers exacts, contenu identique au rail sauf mode build.sh sans effet
  - id: pr65-non-modifiee
    classe: VERIFIED
    valeur: tip reception-regularisation-20260919 reste fe36a8e
  - id: ci-checks-observes
    classe: NOT_APPLICABLE
    valeur: git fetch, ls-remote, gh, WebFetch tous refuses, aucun acces reseau
  - id: build-cloudflare-observe
    classe: NOT_APPLICABLE
    valeur: aucun acces Cloudflare depuis ce canal
  - id: isolation-supabase-test-apres-portage
    classe: NOT_APPLICABLE
    valeur: necessite lecture du build reellement servi
  - id: recette-navigateur
    classe: NOT_APPLICABLE
    valeur: non lancee
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Preuve externe `rebuild/carburants-65-20260922` vérifiée ; CI/Cloudflare hors de portée du canal

Réponse au réveil du 23/09/2026 (issue #28, commentaire `5787344493`). Frédéric rapporte avoir
exécuté lui-même, via GitHub, le geste mécanique documenté dans `request-3.md` /
`preuve-cloudflare-humaine-65-portage-1.md` §6, hors de ce canal. Ce dossier vérifie ce geste et
rapporte honnêtement ce que ce canal ne peut pas observer ensuite.

## 1. Vérification Git — tout confirmé, rien supposé

- `rebuild/carburants-65-20260922` = `290a217f0f07d4f408469bc9cb8239814544f092` (`git rev-parse`
  sur le ref local, déjà présent dans ce checkout).
- Parent unique du commit : `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb` (`git show -s --format=%P`)
  — identique au SHA candidat #65 cité dans `preuve-cloudflare-humaine-65-portage-1.md`. Un seul
  parent : avance en fast-forward, jamais un merge, `force=false` cohérent avec un ff.
- `git diff --name-status fe36a8e 290a217` : **exactement** les 7 fichiers annoncés, aucun autre —
  `_headers` (A), `nexus-auth.js` (M), `nexus-bandeau-environnement.js` (A), `nexus-page.js` (A),
  `outils/build.sh` (A), `outils/generer-config.js` (A), `outils/poser-build-id.js` (M). Confirmé
  une seconde fois par `git show --stat` (789 insertions/819 suppressions sur ces 7 fichiers, 0
  ailleurs).
- Contenu comparé directement au rail (`git diff 290a217 origin/handoff-continuite-20260920 -- <7
  fichiers>`) : **identique**, sauf un écart de mode sur `outils/build.sh` seul (100644 sur le
  commit, 100755 sur le rail) — sans effet fonctionnel, puisque le geste Cloudflare rapporté
  invoque explicitement `bash outils/build.sh` : l'interpréteur passé en argument ignore le bit
  d'exécution du fichier lui-même. Aucune ligne de contenu ajoutée/retirée par ce diff.
- PR #65 (`reception-regularisation-20260919`) non modifiée : son tip reste `fe36a8e`, seul
  `rebuild/carburants-65-20260922` a reçu ce commit — conforme à `decision-2.md` (« pas
  `reception-regularisation-20260919` elle-même »).

## 2. Ce que ce canal ne peut pas observer — confirmé par tentative réelle, pas supposé

Quatre tentatives réelles dans cette session, chacune refusée par le harnais avant toute
exécution : `git fetch origin ...`, `git fetch origin` (sans ref), `git ls-remote --heads origin
...` (lecture réseau pure, aucune mutation locale), `gh --version`, `WebFetch` vers l'API GitHub
publique (`api.github.com/repos/.../commits/...`). Les quatre : refus d'approbation, comme
documenté dans ce fil depuis le 06/09/2026 — confirmé ici pour la première fois sur une opération
de lecture réseau pure (`git ls-remote`) et sur `WebFetch`, pas seulement sur une écriture.

Conséquence directe :
- **run CI "Tests"** (`.github/workflows/tests.yml`, déclenché par `push: branches: ['**']`, donc
  en principe déclenché par ce push) : existence probable, résultat **non observable** depuis ce
  canal.
- **journal de build Cloudflare Pages** pour ce commit : **non observable**.
- **variables d'environnement réellement scopées** au niveau du projet Cloudflare : **non
  observables** — inchangé depuis `etude-isolation-test-candidats-web-1.md` §4.

## 3. Ce qui n'a délibérément pas été fait

Conformément à l'instruction du réveil : **aucune recette navigateur lancée**, **aucune
qualification de l'isolation Supabase Test**. Aucun fichier applicatif touché dans cette session
(diff limité à `docs/handoff/`). Aucun accès Production, aucune opération Supabase, aucune
nouvelle règle métier/UX.

## 4. Prochain fait externe requis, précisément

Un accès Cloudflare/GitHub Actions humain (ou une session outillée avec réseau) doit rapporter,
dans cet ordre :

1. le résultat du run GitHub Actions "Tests" déclenché par le push de `290a217f` sur
   `rebuild/carburants-65-20260922` ;
2. le journal de build Cloudflare Pages pour ce même commit sur ce même projet : le build
   atteint-il désormais `generer-config.js` et déploie-t-il, ou échoue-t-il encore — avec la cause
   exacte si oui ;
3. si le déploiement réussit, la lecture du `nexus-config.js` réellement servi (ou du bandeau
   d'environnement affiché) sur `https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/`,
   pour confirmer qu'il ne pointe que vers Supabase Test — condition explicitement posée par
   `decision-2.md` avant toute recette navigateur.

Tant que ces trois faits ne sont pas rapportés : l'obstacle **mécanique** (fichiers manquants sur
la branche candidate) est levé et vérifié ; l'effet sur le **build/déploiement réel** reste non
observé depuis ce canal, ni positif ni négatif.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucune règle métier/UX nouvelle, PR #65 elle-même non modifiée, aucun
fichier applicatif touché (diff limité à `docs/handoff/`), aucun contournement des restrictions
d'écriture/réseau de ce canal.
