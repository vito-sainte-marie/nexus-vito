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
  - id: diagnostic-nexus-build-legacy
    classe: VERIFIED
    valeur: contenu compare via git show, id declare 20260904-0104 vs empreinte reelle 59d2bdec4dd3
  - id: doctrine-etablie
    classe: VERIFIED
    valeur: .gitignore canonique exclut deja nexus-build.js et nexus-config.js
  - id: nuance-workflow-legacy
    classe: VERIFIED
    valeur: tests.yml rebuild 123 lignes, verifier appele sans build.sh prealable
  - id: correctif-applique
    classe: NOT_APPLICABLE
    valeur: git checkout rebuild refuse par le harnais
  - id: identite-environnement-servi
    classe: NOT_APPLICABLE
    valeur: WebFetch refuse par le harnais
  - id: remesure-checks
    classe: NOT_APPLICABLE
    valeur: gh refuse par le harnais
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune requete, aucun merge, aucun deploiement
---
# Diagnostic précis de l'échec `non-regression` sur #65 ; correctif identifié, écriture bloquée par ce canal

Réponse au réveil du 23/09/2026 (issue #28), poursuite de `request-3.md` (toujours `ATTENTE_DECISION`,
aucune décision consommée entre-temps).

## 1. Diagnostic confirmé par lecture directe, pas supposé

`node outils/poser-build-id.js --verifier` échoue sur `rebuild/carburants-65-20260922` (commit
`290a217`) parce que **`nexus-build.js` reste versionné** sur cette branche, avec un contenu
legacy pré-refonte (`id: '20260904-0104'`, `commit: 'b2190e5'`, format simple sans
`commitCourt`/`environnement`/`construitLe`/`coherent`/`versionner` — antérieur à la refonte du
05/09/2026 portée par le fichier `outils/poser-build-id.js` lui-même, déjà ported par le commit
mécanique). `--verifier` recalcule l'empreinte réelle du contenu servi (`59d2bdec4dd3`, exactement
la valeur rapportée dans le réveil) et la compare à l'identité déclarée dans le fichier committé
(`20260904-0104`) : divergence, échec.

Le build Cloudflare réussit parce que `outils/build.sh` régénère `nexus-build.js` (étape 2/3) AVANT
de le vérifier (étape 3/3) — toujours cohérent avec lui-même dans ce chemin.

## 2. Confirmation : doctrine déjà établie, aucune nouvelle règle

Le `.gitignore` canonique (`handoff-continuite-20260920`) exclut déjà explicitement `nexus-build.js`
et `nexus-config.js`, avec le motif exact : « Identité de la génération, écrite au build par
`outils/poser-build-id.js`. Jamais versionnée : une identité committée peut être périmée — c'est
exactement le défaut A6 — une identité générée ne le peut pas. » Le fichier `outils/poser-build-id.js`
lui-même, déjà ported sur la branche rebuild par le commit mécanique `290a217`, porte le même
principe dans son en-tête (§ « CE QUI CHANGE », point 3). Ce n'est donc pas un arbitrage nouveau :
c'est un écart de portage — le `.gitignore` de `rebuild/carburants-65-20260922` n'a pas reçu les
deux lignes d'exclusion lors du port mécanique des 7 fichiers (le `.gitignore` n'en faisait pas
partie).

## 3. Nuance trouvée, non triviale : le retrait seul ne suffit pas sur cette branche

Le `.github/workflows/tests.yml` de `rebuild/carburants-65-20260922` est lui-même une version
**legacy** (123 lignes, antérieure à la refonte de traçabilité du 05/09/2026). Son job
`non-regression` appelle directement `node outils/poser-build-id.js --verifier` sur l'arbre brut
du checkout CI (ligne 59), **sans exécuter `outils/build.sh` au préalable**. Sur la version
canonique du même workflow, cette étape a été remplacée par `test_build_tracabilite_20260905.js`,
qui construit dans une copie jetable — précisément parce que, comme le dit le commentaire canonique
en tête de cette section, « `nexus-build.js` n'est plus versionné : le vérifier sur le dépôt brut
n'aurait plus de sens ».

Conséquence : retirer `nexus-build.js` du suivi Git sans rien d'autre changerait seulement le
message d'échec (« `nexus-build.js` est absent : cet arbre n'a pas été construit », au lieu de
« périmé ») — le check `non-regression` resterait rouge sur cette branche tant que son workflow
CI lui-même n'est pas aligné sur la doctrine moderne (construire avant de vérifier). Cet
alignement toucherait `.github/workflows/tests.yml`, hors de la portée de tout agent Claude Code
sur ce dépôt, quelle que soit la branche (restriction d'outillage, pas de permission Git).

## 4. Correctif mécanique identifié (n'a pas pu être appliqué)

Sur `rebuild/carburants-65-20260922` uniquement, jamais PR #65/`main`/`production` :
1. `git rm nexus-build.js` (retrait du suivi ; le fichier redevient un artefact de build, généré et
   ignoré, exactement comme sur le rail canonique) ;
2. ajouter au `.gitignore` de cette branche les deux lignes déjà présentes sur le rail canonique
   (`nexus-config.js`, `nexus-build.js`, avec leur commentaire) — alignement mécanique, aucune
   ligne métier touchée.

Aucun autre fichier applicatif concerné. Aucune règle métier, aucun rôle, aucune policy RLS.

## 5. Obstacle réel, pas contourné

Tenté dans cette session : `git checkout -b tmp-rebuild-probe origin/rebuild/carburants-65-20260922`
— refusé par le harnais (« this command requires approval », aucune approbation possible en run
automatisé), même schéma que les cinq tentatives déjà documentées dans `request-3.md` de ce lot.
Cette session est structurellement limitée à pousser sur sa propre branche
`claude/issue-28-20260923-0156` ; le correctif ci-dessus n'a donc **pas** été appliqué, et ne
pouvait matériellement pas l'être depuis ce canal.

`WebFetch` vers la preview Cloudflare (`https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/`)
a été tenté pour vérifier l'identité/environnement effectivement servi avant toute recette
navigateur — refusé par le harnais (approbation requise). `gh` (pour re-mesurer les checks après
correctif) également refusé. Aucune de ces trois vérifications n'a donc pu être faite ; aucune
n'a été simulée ou supposée.

## 6. Ce qui reste à faire, dans l'ordre, depuis une session avec écriture réelle

```
git fetch origin rebuild/carburants-65-20260922
git checkout rebuild/carburants-65-20260922
git rm nexus-build.js
cat >> .gitignore <<'EOF'

# Configuration d'environnement, générée au build — jamais versionnée.
nexus-config.js

# Identité de la génération, écrite au build par outils/poser-build-id.js.
# Jamais versionnée : une identité committée peut être périmée — c'est
# exactement le défaut A6 — une identité générée ne le peut pas.
nexus-build.js
EOF
git add .gitignore
git commit -m "rebuild(65): retirer nexus-build.js du suivi, aligner .gitignore sur le rail canonique"
git push origin rebuild/carburants-65-20260922
```

Puis re-mesurer le check `non-regression`. Si le job `non-regression` de cette branche reste rouge
après ce commit (attendu, cf. §3 — « nexus-build.js est absent »), la cause n'est plus un défaut de
portage mais le workflow CI legacy lui-même : décision à prendre séparément (aligner
`.github/workflows/tests.yml` de cette branche sur la version canonique, ou accepter ce rouge comme
connu et non bloquant pour la suite du diagnostic #65). Aucune de ces deux options n'a été choisie
ici — ni appliquée, ni recommandée comme tranchée.

Ensuite seulement : vérifier via la preview Cloudflare que `nexus-config.js` généré au build
déclare bien `NEXUS_ENV=test` et une URL Supabase de Test (jamais la référence Production
`uzhjpqpctpvxytxpxoqz`, nommée en dur dans `outils/generer-config.js` précisément pour ce refus),
avant toute recette navigateur. Supabase Test reste non prouvé — aucune preuve fabriquée ici.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production,
aucun secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune règle métier/UX nouvelle, PR #65
elle-même non modifiée, aucun fichier applicatif touché (diff limité à `docs/handoff/` sur cette
branche), aucun contournement des restrictions d'écriture/réseau de ce canal.
