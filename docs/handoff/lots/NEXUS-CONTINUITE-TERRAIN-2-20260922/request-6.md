---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 6
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0-production=2bc7b39-inchangees
  - id: workflow-candidate-legacy
    classe: VERIFIED
    valeur: 123-lignes-8-etapes-declarees-verifier-appele-sans-build-prealable
  - id: poser-build-id-post-refonte-sur-candidate
    classe: VERIFIED
    valeur: blob-dd0deaf-identique-rail-confirme-request-5
  - id: nexus-build-js-perime-committe-candidate
    classe: VERIFIED
    valeur: id-20260904-0104-commit-b2190e5-lu-directement
  - id: echec-deterministe-reproduit-sur-rail
    classe: VERIFIED
    valeur: verifier-echoue-aussi-sur-arbre-brut-du-rail-nexus-build-js-absent
  - id: cause-non-regression-portage
    classe: VERIFIED
    valeur: meme-echec-attendu-sur-tout-arbre-non-construit-portant-le-nouveau-script
  - id: patch-mecanique-expose
    classe: VERIFIED
    valeur: bash-outils-build-sh-avec-identifiants-test-fictifs-deja-eprouves-49-49
  - id: transport-patch-canal
    classe: NOT_APPLICABLE
    valeur: ecriture-workflows-et-branche-candidate-toutes-deux-hors-portee-de-ce-canal
  - id: build-cible-supabase-test-reel
    classe: NOT_APPLICABLE
    valeur: aucune-variable-NEXUS_SUPABASE-presente-dans-ce-canal
  - id: candidate-declaree-prete
    classe: NOT_APPLICABLE
    valeur: explicitement-non-declaree-conformement-a-decision-4
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-conformes
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Diagnostic mécanique — CI candidate rouge (`290a217f`, « Cohérence des épingles de cache »)

Réponse au périmètre autorisé par `decision-4.md` : poursuivre les preuves Test/readiness
objectivement disponibles pour #65, sans déclarer la candidate prête, en s'appuyant sur les faits
GitHub déjà établis (run `35805992451` rouge à « Cohérence des épingles de cache » sur `290a217f`,
workflow candidate legacy).

## 1. Méthode

Lecture seule uniquement : `git show <ref>:<chemin>`, `git cat-file -e <ref>:<chemin>`, `git
rev-parse`, exécution locale de `outils/poser-build-id.js --verifier` sur l'arbre du rail (aucune
écriture Git, aucune tentative de checkout/fetch/push/worktree — toutes refusées comme lors des
sessions précédentes de ce lot, non retentées).

## 2. Cause exacte, confirmée — pas une régression du portage

Trois faits, chacun vérifié directement :

1. **Le workflow de la candidate est bien legacy.** `git show
   origin/rebuild/carburants-65-20260922:.github/workflows/tests.yml` : 123 lignes, un seul job
   (`non-regression`, 8 étapes déclarées). L'étape en cause :
   ```
   - name: Cohérence des épingles de cache
     run: node outils/poser-build-id.js --verifier
   ```
   appelée **directement sur l'arbre committé brut**, sans jamais lancer `outils/build.sh` avant.

2. **`outils/poser-build-id.js` sur la candidate est désormais la version DU RAIL** (post-refonte
   du 05/09/2026), confirmé blob-identique par `request-5.md` (`dd0deaf7d…` des deux côtés). Cette
   version exige, en mode `--verifier`, que `nexus-build.js` existe et que son `id` déclaré
   corresponde exactement à une empreinte de contenu fraîchement calculée — sinon `process.exit(1)`
   immédiat (`outils/poser-build-id.js:180-195`).

3. **La candidate porte encore un `nexus-build.js` COMMITTÉ, périmé** — confirmé par lecture
   directe (`git show origin/rebuild/carburants-65-20260922:nexus-build.js`) :
   ```js
   global.NEXUS_BUILD = { id: '20260904-0104', commit: 'b2190e5' };
   ```
   C'est exactement l'artefact que la refonte du 05/09/2026 a éliminé — le commentaire d'en-tête de
   `outils/poser-build-id.js` le décrit lui-même mot pour mot (« l'identifiant était un
   HORODATAGE... `nexus-build.js` n'est plus versionné : on ne peut plus committer une identité
   périmée »). Un identifiant littéral `'20260904-0104'` ne peut structurellement jamais égaler une
   empreinte de contenu hexadécimale fraîchement calculée : la comparaison `declare !== ID` échoue
   nécessairement.

**Conséquence : `--verifier` échoue de façon déterministe sur n'importe quel arbre non construit
portant cette version de `poser-build-id.js`** — y compris sur le rail lui-même. Vérifié par
exécution réelle : `node outils/poser-build-id.js --verifier` sur l'arbre brut du rail (`c752676`)
échoue avec « `nexus-build.js` est absent : cet arbre n'a pas été construit » — un chemin d'échec
différent (absent, vs id périmé sur la candidate) mais la même cause structurelle et la même
conclusion : **le rail lui-même ne pourrait pas passer cette étape isolée**, ce qui explique
précisément pourquoi `.github/workflows/tests.yml` du rail **ne contient plus cette étape** — il
exerce la vraie chaîne de build dans une copie jetable à la place (`test_build_tracabilite_20260905.js`,
49/49, qui commence par `fs.rmSync(nexus-build.js, {force:true})` avant de lancer `bash
outils/build.sh` avec des identifiants Test fictifs).

**Ce n'est donc pas une régression introduite par le portage des 7 fichiers** : c'est une
incompatibilité structurelle entre le workflow legacy de la candidate (antérieur à la refonte) et
le nouveau `poser-build-id.js` qu'elle vient de recevoir. Le portage l'a rendue visible, pas
créée — avant le portage, l'ancienne version de `poser-build-id.js` (sans cette exigence) passait
trivialement cette même étape (confirmé pour #62/`fe4e9a2` dans `dossier-decision-pr-62.md` §3,
étape 4 verte).

## 3. Ce que ce canal ne peut pas mesurer plus précisément

L'ID de contenu exact attendu par `--verifier` sur la candidate n'a pas été recalculé (nécessiterait
de lister tous les fichiers `.html`/`.js` racine de la candidate — `git ls-tree`/`git archive`
refusés par le harnais dans ce canal, comme les opérations d'écriture). Non nécessaire pour le
diagnostic : que l'échec porte sur « absent » ou sur « id périmé », les deux branches mènent au même
`process.exit(1)`, pour la même cause racine.

## 4. Patch mécanique minimal — déposé, non appliqué

**Hors de portée d'écriture de ce canal, sur deux plans distincts** : (a) `.github/workflows/*.yml`
n'est pas modifiable par cet agent, quelle que soit la branche ; (b) l'écriture Git vers
`rebuild/carburants-65-20260922` reste refusée par le harnais (confirmé à nouveau non retenté,
conformément à `preuve-cloudflare-humaine-65-portage-1.md` §5). Conformément à `decision-4.md`, ce
patch est donc déposé tel quel, sans sollicitation de Frédéric pour ce seul transport technique.

Remplacer, dans `.github/workflows/tests.yml` de la candidate, l'étape :
```yaml
      - name: Cohérence des épingles de cache
        run: node outils/poser-build-id.js --verifier
```
par :
```yaml
      - name: Cohérence des épingles de cache
        env:
          NEXUS_ENV: test
          NEXUS_SUPABASE_URL: https://udljdqxerrbbbajxubfn.supabase.co
          NEXUS_SUPABASE_ANON_KEY: sb_publishable_essai0000000000
        run: bash outils/build.sh
```

Justification de chaque choix, pas une nouveauté :

- exécute la **vraie** chaîne (`generer-config.js` → `poser-build-id.js` pose → `--verifier`) au
  lieu d'appeler `--verifier` seul sur un arbre jamais construit — la étape se contrôle donc
  elle-même sur ce qu'elle vient de produire, jamais sur un reliquat committé ;
- `NEXUS_SUPABASE_URL` est le **vrai** projet Supabase Test (`udljdqxerrbbbajxubfn`, nexus-test),
  déjà cité comme tel dans toute la Continuité ; la clé anonyme est fictive
  (`sb_publishable_essai0000000000`) — exactement la paire déjà utilisée 49/49 fois par
  `test_build_tracabilite_20260905.js` sur le rail (`ENV_VALIDE`, ligne 49-52), jamais un secret
  réel, jamais une valeur nouvelle inventée ici ;
- `generer-config.js` ne fait aucun appel réseau (vérifié : aucune occurrence de `fetch`/`http`/
  `axios` dans le fichier) — cette étape ne parlera jamais réellement à Supabase, Test ou
  Production, quelle que soit l'URL fournie ; elle valide seulement la FORME de l'URL/clé ;
  ce n'est donc PAS la preuve de ciblage Supabase Test réel exigée avant navigation (§5.4
  `request-5.md`), seulement la preuve que le mécanisme de traçabilité fonctionne sur cette
  candidate précise — un niveau, pas l'autre, comme déjà distingué par `decision-3.md`/`decision-4.md` ;
- `nexus-build.js` périmé n'a pas besoin d'être supprimé séparément : l'étape « pose » de
  `build.sh` (`poser-build-id.js` sans `--verifier`) l'écrase inconditionnellement avant que
  `--verifier` ne le relise — auto-guérison, pas une étape supplémentaire à ajouter. Le retirer du
  suivi Git de la candidate resterait néanmoins cohérent avec la doctrine du rail (« n'est plus
  versionné ») ; recommandé, non bloquant.

## 5. Ce que ceci ne prouve toujours pas

Ce patch, une fois appliqué et rejoué, prouverait le mécanisme de traçabilité sur cette candidate
précise — pas le ciblage Supabase Test réel (fait n°2 de `etude-isolation-test-candidats-web-1.md`
§4, toujours non mesuré pour #65), ni ce qu'un déploiement Cloudflare réel de cette candidate
servirait (fait n°3, idem). **La candidate n'est PAS déclarée prête** : la CI candidate reste rouge
tant que ce patch n'est pas appliqué par une session outillée, et même une fois verte, l'identité/
l'environnement réellement servi restera à prouver avant toute navigation, conformément à
`decision-4.md`.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé (les seules valeurs Supabase mentionnées sont l'URL publique du projet Test
et une clé anonyme fictive déjà utilisée 49 fois dans le dépôt, jamais une valeur nouvelle ou
réelle), aucune nouvelle règle métier/UX/RLS/rôle, PR #65 non modifiée, aucun fichier applicatif
touché (diff limité à `docs/handoff/`), aucune tentative d'écriture Git superflue, aucune
sollicitation de Frédéric pour le transport technique du patch.
