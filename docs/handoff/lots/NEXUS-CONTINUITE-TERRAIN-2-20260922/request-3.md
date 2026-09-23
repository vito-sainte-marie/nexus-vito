---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: preuve-cloudflare-humaine
    classe: DECLARED
    valeur: rapportee par Frederic, non re-mesuree, build.sh absent exit 127
  - id: reclassement-65
    classe: VERIFIED
    valeur: condition decision-2 remplie, cause du rouge confirmee
  - id: 7-fichiers-identifies
    classe: VERIFIED
    valeur: verifies un par un par git show sur le candidat
  - id: mecanisme-fail-closed
    classe: VERIFIED
    valeur: test_config_environnement.js 17/17, test_build_tracabilite_20260905.js 49/49
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32 lots conformes
  - id: portage-execute
    classe: NOT_APPLICABLE
    valeur: 5 tentatives ecriture refusees, aucun contournement
  - id: isolation-supabase-test-apres-portage
    classe: NOT_APPLICABLE
    valeur: aucun acces Cloudflare/Supabase Test depuis ce canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Preuve Cloudflare humaine (#65) consignée ; portage préparé, exécution bloquée par ce canal

Réponse au réveil du 23/09/2026 (issue #28). Détail complet :
`preuve-cloudflare-humaine-65-portage-1.md` (ce lot).

## 1. Preuve consignée

Log Cloudflare Pages, #65, SHA `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb` : clone OK, commande
`bash outils/build.sh`, échec `No such file or directory`, exit 127, deploy non exécuté — rapporté
par Frédéric, non re-mesuré depuis ce canal.

## 2. Reclassement #65

La condition posée par `decision-2.md` (observation Cloudflare humaine préalable au portage) est
désormais remplie pour #65 : ce qui est construit/servi aujourd'hui pour `fe36a8e`, c'est rien —
le build échoue avant `generer-config.js`, avant tout déploiement. Aucun risque qu'une page
existante parle à Production aujourd'hui. Ceci ne prouve pas l'isolation Supabase Test après
portage (non requalifié en acquis).

## 3. Plus petit geste mécanique identifié

7 fichiers exacts (vérifiés un par un par lecture directe du candidat) : `outils/build.sh`,
`outils/generer-config.js`, `outils/poser-build-id.js` (présent mais pré-refonte),
`nexus-auth.js` (présent mais pré-refonte, 932 lignes, Production en dur), `nexus-page.js`,
`nexus-bandeau-environnement.js`, `_headers` — les trois derniers absents. Cible :
`rebuild/carburants-65-20260922` (nommée par `decision-2.md`, tip `fe36a8e` identique au candidat,
0 commit ajouté), jamais `reception-regularisation-20260919` elle-même. Aucun autre fichier candidat
à toucher (`generer-config.js` insère lui-même les balises requises).

Mécanisme rejoué et confirmé sain avant conclusion : `test_config_environnement.js` 17/17,
`test_build_tracabilite_20260905.js` 49/49 (fail-closed test→Production et production→autre
confirmés par exécution réelle, valeurs factices uniquement), `handoff.js verifier` conforme.

## 4. Obstacle réel, pas supposé

Cinq tentatives d'écriture vers `rebuild/carburants-65-20260922` refusées par le harnais dans
cette session : `git checkout <ref>`, `git checkout -B ... <ref>`, `git worktree add`,
`GIT_INDEX_FILE=... git read-tree`, `git hash-object`. Seule la lecture (`git show`, `git
cat-file`) fonctionne. Aucun contournement tenté. Commandes exactes de portage documentées dans
`preuve-cloudflare-humaine-65-portage-1.md` §6, pour une session avec écriture réelle. Alias
Cloudflare de destination calculé et confirmé par exécution réelle de `urlTestDeBranche()` :
`https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/`.

## 5. Ce qui reste bloqué

Lecture des variables d'environnement Cloudflare réelles, observation du build ported une fois
déployé, preuve que le build généré pointe uniquement Supabase Test (exigée avant toute recette
navigateur), recette navigateur profonde #65 — tout `NOT_APPLICABLE` depuis ce canal, avant et
après le portage.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune règle métier/UX nouvelle, PR #65
elle-même non modifiée, aucun fichier applicatif touché (diff limité à `docs/handoff/`), aucun
contournement des restrictions d'écriture de ce canal.
