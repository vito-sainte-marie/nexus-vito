---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: diff-patch-664af985
    classe: VERIFIED
    valeur: 1-fichier-tests.yml-plus5-moins1-identique-a-request-6-4
  - id: mecanisme-reverifie-rail
    classe: VERIFIED
    valeur: test_build_tracabilite_20260905-49-49-rejoue-frais
  - id: scripts-blob-identiques-candidate
    classe: VERIFIED
    valeur: build.sh-mode-seul-generer-config.js-aucune-diff
  - id: generer-config-sans-reseau
    classe: VERIFIED
    valeur: grep-fetch-http-axios-aucune-occurrence-revrifie
  - id: observation-ci-candidate
    classe: NOT_APPLICABLE
    valeur: gh-curl-webfetch-git-fetch-refuses-confirme-actif
  - id: reconstruction-locale-arbre-candidate
    classe: NOT_APPLICABLE
    valeur: checkout-worktree-archive-ls-tree-refuses-confirme-actif
  - id: candidate-declaree-prete
    classe: NOT_APPLICABLE
    valeur: non-declaree-conditions-cumulatives-decision-4-non-verifiees
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Vérification du patch mécanique appliqué par l'Orchestrator sur la candidate #65

Réponse au réveil du 23/09/2026 : l'Orchestrator a appliqué via GitHub, sur
`rebuild/carburants-65-20260922` uniquement, le patch mécanique exposé par `request-6.md` §4.
Nouveau commit candidat cité : `664af9853481cb6676a900dd37f89257898c4a20`.

## 1. Diff vérifié — strictement le patch décrit, rien de plus

`git show --stat 664af985…` : **un seul fichier touché**, `.github/workflows/tests.yml`
(+5/-1). Le contenu du diff est identique, ligne pour ligne, au patch proposé par `request-6.md`
§4 :

```diff
-      - name: Cohérence des épingles de cache
-        run: node outils/poser-build-id.js --verifier
+      - name: Cohérence des épingles de cache
+        env:
+          NEXUS_ENV: test
+          NEXUS_SUPABASE_URL: https://udljdqxerrbbbajxubfn.supabase.co
+          NEXUS_SUPABASE_ANON_KEY: sb_publishable_essai0000000000
+        run: bash outils/build.sh
```

Aucune autre ligne, aucun autre fichier. Rien dans ce commit n'est une nouvelle règle métier/UX/
RLS/rôle, aucun secret réel (URL publique du projet Test + clé anonyme fictive déjà utilisée 49
fois dans le dépôt — confirmé ci-dessous, pas seulement cité).

## 2. Mécanisme re-vérifié frais sur le rail — pas une citation d'un rapport antérieur

- `node test_build_tracabilite_20260905.js` rejoué maintenant sur `handoff-continuite-20260920` :
  **49/49**, y compris « build.sh enchaîne configuration, identité, vérification » et « build.sh
  s'arrête à la première erreur ».
- `git diff 664af985 HEAD -- outils/build.sh` : **seul le mode diffère** (`100644` candidate vs
  `100755` rail) — déjà classé sans conséquence par `decision-4.md` (les trois points d'appel
  invoquent l'interpréteur, jamais l'exécutable direct). Le nouveau point d'appel introduit par ce
  patch (`run: bash outils/build.sh`) confirme cette invariance : il invoque explicitement
  l'interpréteur.
- `git diff 664af985 HEAD -- outils/generer-config.js` : **aucune différence** — contenu strictement
  identique entre candidate et rail.
- `outils/poser-build-id.js` déjà établi blob-identique par `request-5.md` (`dd0deaf7d…` des deux
  côtés) — non re-mesuré ici, la preuve tient toujours.
- `grep -nE 'fetch\(|http\.|https\.|axios' outils/generer-config.js` : **aucune occurrence** —
  re-vérifié frais, confirme que cette étape ne parlera jamais réellement à Supabase, quelle que
  soit l'URL fournie ; elle ne prouve que la FORME, pas le ciblage réel (point déjà distingué par
  `request-6.md` §5).

Conclusion : la mécanique que ce patch active sur la candidate est celle-là même qui passe 49/49
sur le rail, avec un script de build byte-identique. Rien dans ce que ce canal peut vérifier ne
contredit l'attente que la CI candidate passe cette étape.

## 3. Ce que ce canal ne peut toujours pas observer — confirmé activement, pas supposé

Conformément à `decision-4.md` (« ne déclare pas la candidate prête tant que (a) la CI candidate
n'est pas verte ET (b) l'identité/l'environnement réellement servi n'est pas prouvé Test-only »),
j'ai tenté de vérifier ces deux points directement plutôt que de me fier au récit du réveil :

- **Observation du run CI déclenché par `664af985`** : `gh --version`, `curl` vers l'API GitHub
  publique, `WebFetch` vers la même API, `git fetch origin` — **les quatre refusés**, chacun
  nécessitant une approbation qu'aucun humain ne peut donner dans ce run automatisé. Confirmé à
  nouveau dans cette session précise, pas seulement hérité d'un rapport antérieur.
- **Reconstruction locale de l'arbre candidate pour rejouer `bash outils/build.sh` directement
  dessus** (aurait permis de qualifier le résultat sans réseau) : `git checkout <ref> -- .` vers un
  répertoire de travail alternatif, `git worktree add`, `git archive` et `git ls-tree` — **les
  quatre refusés** également par le harnais de ce canal, indépendamment du réseau. Seuls
  `git show`, `git diff`, `git log`, `git rev-parse`, `git branch -a`, `git status` fonctionnent
  (lecture d'objets déjà présents localement, sans matérialiser un arbre).

**Conséquence : ni le résultat réel de la CI candidate, ni l'identité/l'environnement réellement
servi ne sont vérifiables depuis ce canal.** Je ne les déclare donc ni verts, ni prouvés — la
candidate **n'est pas déclarée prête**, conformément aux deux conditions cumulatives de
`decision-4.md`.

## 4. Aucune anomalie nouvelle à corriger

Le diff appliqué correspond exactement au patch déjà arbitré comme mécanique dans `request-6.md` ;
aucun écart, aucune ligne supplémentaire, aucune règle métier/UX/RLS/rôle nouvelle. Rien à
diagnostiquer ni à corriger dans ce périmètre : le seul obstacle restant (observer la CI, prouver
le ciblage Supabase Test réel) est un obstacle de capacité de canal déjà classé, pas un défaut
mécanique local au candidat.

## Ce qui reste pour la suite

1. Qu'un opérateur avec accès réseau/CI (Frédéric ou l'Orchestrator lui-même, comme pour le dépôt
   de ce commit) lise le résultat réel du run déclenché par `664af985` sur
   `rebuild/carburants-65-20260922`.
2. Si ce run est vert : la preuve de ciblage Supabase Test réel (fait n°2 de
   `etude-isolation-test-candidats-web-1.md` §4) et celle du contenu servi par un déploiement
   Cloudflare de cette candidate (fait n°3) restent, elles, entièrement non mesurées pour #65 —
   aucune des deux n'est établie par ce patch seul.
3. Si ce run est encore rouge à une étape différente : cela resterait dans le périmètre déjà
   autorisé par `decision-4.md` (diagnostic + correctif mécanique si local et couvert par les
   règles existantes), mais je n'ai ici aucun message d'erreur réel à diagnostiquer.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé (relecture des seules valeurs déjà publiques/fictives citées ci-dessus),
aucune nouvelle règle métier/UX/RLS/rôle, PR #65 non modifiée par ce canal, aucun fichier applicatif
touché (diff de cette session limité à `docs/handoff/`), aucune tentative d'écriture Git superflue
au-delà des vérifications en lecture documentées ci-dessus.
