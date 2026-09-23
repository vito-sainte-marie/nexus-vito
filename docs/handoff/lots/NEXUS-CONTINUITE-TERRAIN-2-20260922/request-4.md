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
  - id: cause-exacte-confirmee
    classe: VERIFIED
    valeur: nexus-build.js verse et fige sur la cible, declarait 20260904-0104/b2190e5
  - id: recalcul-outillage-canonique
    classe: VERIFIED
    valeur: CF_PAGES_COMMIT_SHA=290a217f node outils/poser-build-id.js, generation 59d2bdec4dd3, 760 refs
  - id: verifier-post-recalcul
    classe: VERIFIED
    valeur: node outils/poser-build-id.js --verifier, toutes coherentes
  - id: patch-eprouve-aller-retour
    classe: VERIFIED
    valeur: patch -p1 applique sur copie fraiche, 0 divergence sur 91 fichiers, verifier rejoue vert
  - id: ecriture-branche-cible
    classe: NOT_APPLICABLE
    valeur: git checkout -b et git push refuses par le canal, aucun contournement
  - id: isolation-supabase-test
    classe: NOT_APPLICABLE
    valeur: aucun acces Cloudflare/reseau depuis ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Garde cache rouge sur #65 (`290a217f`) diagnostiquée et corrigée mécaniquement ; patch fourni, écriture bloquée par ce canal

Réponse au réveil du 23/09/2026 (issue #28). Détail complet :
`garde-cache-pins-290a217-1.md` (ce lot). Patch éprouvé : `cache-pins-290a217.patch` (ce lot).

## 1. Cause exacte (point 1 du réveil)

Sur `rebuild/carburants-65-20260922` (tip `290a217f`), `nexus-build.js` reste **versionné** (lignée
antérieure à la refonte du 05/09/2026, où l'outil a cessé de le committer) et déclare toujours
`id: '20260904-0104', commit: 'b2190e5'` — figé depuis longtemps. La garde CI de cette branche
(`node outils/poser-build-id.js --verifier`, sans étape de build préalable) recalcule l'empreinte
réelle du contenu et la compare : divergence certaine, aucune logique métier en cause. L'outil
lui-même est déjà la version canonique post-refonte sur ce candidat (un des 7 fichiers portés) —
vérifié byte-identique au rail, aucun changement d'outillage nécessaire.

## 2. Recalcul (point 1) — reconstruction fidèle hors dépôt

Les 174 fichiers `.html`/`.js` de racine balayés par l'outil ont été reconstruits par lecture seule
(`git show <ref>:<chemin>`), hors dépôt (`.scratch65/`, jamais indexé). Exécution réelle :
`CF_PAGES_COMMIT_SHA=290a217f... node outils/poser-build-id.js` produit la génération
`59d2bdec4dd3` (760 références), puis `--verifier` confirme la cohérence. 91 fichiers changent,
uniquement la substitution `?v=20260904-0104` → `?v=59d2bdec4dd3` et la réécriture de
`nexus-build.js` au nouveau format — aucune ligne métier touchée (détail des diffs dans le patch).

## 3. Patch fourni et éprouvé (point 2)

`cache-pins-290a217.patch` (joint), appliqué réellement (`patch -p1`, pas seulement `--dry-run`) à
une copie fraîche de l'arbre `290a217f` non modifié : résultat identique octet pour octet à la
reconstruction attendue sur les 91 fichiers, puis `--verifier` rejoué sur l'arbre patché confirme
« toutes cohérentes ». Commandes exactes de matérialisation (avec ou sans le fichier `.patch`,
deux voies équivalentes) dans `garde-cache-pins-290a217-1.md` §4.

## 4. Obstacle réel, confirmé de nouveau, aucun contournement

`git checkout -b ... origin/rebuild/carburants-65-20260922` et
`git push --dry-run origin HEAD:rebuild/carburants-65-20260922` refusés dans cette session — même
obstacle déjà rapporté dans `request-3.md` (cinq tentatives distinctes alors). Aucune tentative de
contournement (pas de `git hash-object`, pas de `GIT_INDEX_FILE`, pas de `git worktree`).

## 5. Ce qui reste bloqué (points 3 à 6 du réveil)

Observer la CI réelle sur le SHA obtenu, lire les variables d'environnement Cloudflare et prouver
que `nexus-config.js` servi pointe exclusivement Supabase Test, toute recette navigateur, le
dossier de gate Production — tous `NOT_APPLICABLE` depuis ce canal (aucune écriture réelle, aucun
accès Cloudflare/réseau). Rien de tout cela n'a été fabriqué ni supposé.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé (la clé anonyme utilisée pour la reconstruction hors dépôt est une
valeur fictive locale, jamais committée, jamais celle d'un vrai projet), aucune règle métier/UX
nouvelle, aucun contournement des restrictions d'écriture de ce canal, PR/branche cible non
modifiée directement (patch déposé au Handoff, pas poussé).
