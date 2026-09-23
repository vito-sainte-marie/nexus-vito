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
  - id: cause-exacte-65
    classe: VERIFIED
    valeur: tests.yml-pre-refonte-sur-la-branche-appelle-verifier-directement
  - id: nexus-build-js-stale-trackee
    classe: VERIFIED
    valeur: id-20260904-0104-vs-canon-untracked
  - id: correctif-mecanique
    classe: DECLARED
    valeur: git-rm-cached-plus-gitignore-non-execute
  - id: mecanisme-round-trip
    classe: VERIFIED
    valeur: pose-puis-verifier-756-refs-coherentes-arbre-restaure
  - id: nexus-auth-sans-url-en-dur
    classe: VERIFIED
    valeur: lecture-source-post-portage
  - id: isolation-supabase-test-apres-correctif
    classe: NOT_APPLICABLE
    valeur: aucun-acces-cloudflare-depuis-ce-canal
  - id: ecriture-branche-cible
    classe: NOT_APPLICABLE
    valeur: worktree-add-refuse-par-le-harnais
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Cause exacte de la dette #65 identifiée ; correctif mécanique déterminé, non intégré (canal en écriture bloqué)

Réponse au réveil du 23/09/2026 (issue #28), preuve fraîche CI sur `rebuild/carburants-65-20260922`
(tip `290a217f0f07d4f408469bc9cb8239814544f092`, parent `fe36a8e`).

## 1. Cause exacte, confirmée par lecture directe (pas supposée)

Le check `non-regression` qui échoue sur `290a217` n'est PAS le job `tests.yml` canonique actuel
(qui teste le mécanisme dans une copie jetable via `test_build_tracabilite_20260905.js`) : ce
fichier de test n'existe même pas sur cette branche. C'est la version DE `tests.yml` déjà présente
sur `rebuild/carburants-65-20260922` (héritée de `fe36a8e`, antérieure à la refonte du 05/09) qui
tourne, avec son étape « Cohérence des épingles de cache » — `node outils/poser-build-id.js
--verifier` appelé DIRECTEMENT sur l'arbre brut checké-out (`.github/workflows/tests.yml:58-59` sur
cette branche).

Cette vérification lit `nexus-build.js` **committé** sur cette branche (hérité de `fe36a8e`, non
touché par le portage des 7 fichiers) : il porte l'identité **pré-refonte**
`{ id: '20260904-0104', commit: 'b2190e5' }` — un horodatage, pas une empreinte de contenu.
`outils/poser-build-id.js` (version portée, post-refonte) recalcule l'empreinte réelle des 756
actifs référencés et obtient `59d2bdec4dd3` : les deux ne peuvent structurellement jamais
correspondre, quel que soit le contenu du dépôt, puisque l'un est un vestige de l'ancien mécanisme
et l'autre une empreinte du nouveau.

Confirmé par lecture directe : `git show HEAD:nexus-build.js` (rail canonique
`handoff-continuite-20260920`) échoue avec « n'existe pas dans HEAD » — le fichier y est déjà
untracked, avec la règle d'ignorance déjà en place dans `.gitignore` :

```
# Identité de la génération, écrite au build par outils/poser-build-id.js.
# Jamais versionnée : une identité committée peut être périmée — c'est
# exactement le défaut A6 — une identité générée ne le peut pas.
nexus-build.js
```

Le portage mécanique des 7 fichiers (`290a217`) a bien transporté le nouveau mécanisme
(`outils/poser-build-id.js`, `outils/build.sh`, `outils/generer-config.js`, `nexus-auth.js`,
`nexus-page.js`, `nexus-bandeau-environnement.js`, `_headers` — les 7 identiques octet pour octet
au canon, seul le bit exécutable de `build.sh` diffère) mais n'a jamais retiré le fichier généré
pré-existant ni porté la règle d'ignorance qui l'accompagne sur le canon. C'est exactement une
« dette mécanique d'identité de génération après portage » — pas un défaut du mécanisme lui-même.

## 2. Correctif déterministe, conforme au mécanisme existant

Aucune nouvelle règle, aucun affaiblissement de `poser-build-id.js --verifier` : le correctif
consiste à cesser de committer un artefact que ce même outil déclare depuis sa refonte comme
« n'est plus versionné », exactement ce que porte déjà le canon.

```
git checkout rebuild/carburants-65-20260922
git rm --cached nexus-build.js
cat >> .gitignore <<'EOF'

# Configuration d'environnement, générée au build — jamais versionnée.
nexus-config.js

# Identité de la génération, écrite au build par outils/poser-build-id.js.
# Jamais versionnée : une identité committée peut être périmée — c'est
# exactement le défaut A6 — une identité générée ne le peut pas.
nexus-build.js
EOF
git add .gitignore
git commit -m "fix(65): untrack nexus-build.js, aligner .gitignore sur le mecanisme canonique"
git push origin rebuild/carburants-65-20260922
```

(`nexus-config.js` ajouté par la même occasion : il n'est pas tracké sur cette branche non plus,
mais la règle qui l'exclut manque également dans son `.gitignore` — même cause, même moment,
alignement complet sur le canon plutôt que la moitié.)

## 3. Preuve du mécanisme, obtenue sans écriture sur la branche cible

Round-trip réel exécuté sur ce checkout (rail canonique, script identique octet pour octet à celui
porté) : `node outils/poser-build-id.js` puis `node outils/poser-build-id.js --verifier` →
`Génération f0c677f79d36 — 756 référence(s) épinglée(s), toutes cohérentes.` La mutation locale
(756 fichiers pinnés + `nexus-build.js`/`nexus-config.js` générés) a été intégralement restaurée
avant de conclure (`git show HEAD:<fichier>` fichier par fichier, `git status` revérifié propre) —
aucune de ces mutations n'a été committée ni poussée. Ceci prouve que le mécanisme lui-même est
sain avec le contenu exact porté sur `290a217` ; seule la présence du fichier généré pré-existant
casse la cohérence sur cette branche précise.

Vérification statique complémentaire : le nouveau `nexus-auth.js` porté ne contient plus aucune URL
Supabase ni référence de projet en dur — seuls `NEXUS_CFG.supabaseUrl`/`supabaseCle` (venant de
`nexus-config.js`, généré au build) sont utilisés. `outils/generer-config.js` refuse de construire
si `NEXUS_ENV=test` et que l'URL fournie contient la référence Production, et refuse symétriquement
l'inverse — donc le succès du build Cloudflare Pages sur cette branche implique nécessairement une
paire environnement/URL interne cohérente. Ceci ne prouve PAS quelle paire a réellement été utilisée
(aucun accès aux variables Cloudflare depuis ce canal) : la preuve d'isolation Supabase Test exigée
avant recette navigateur profonde reste `NOT_APPLICABLE`, inchangée depuis `request-3.md`.

## 4. Obstacle inchangé : aucune écriture possible sur `rebuild/carburants-65-20260922`

Nouvelle tentative dans cette session (`git worktree add` vers cette branche) refusée par le
harnais, comme les cinq tentatives déjà documentées dans `request-3.md`. Seule la lecture
fonctionne. Le correctif ci-dessus est donc prêt et vérifié dans son principe, mais reste à exécuter
par une session/un humain disposant d'un accès en écriture à cette branche non protégée.

## 5. Ce qui reste bloqué, sans changement

Supabase Preview reste `SKIPPED` (branche Git non associée à une Supabase Branch) — bloqueur
explicite, non levé, pour toute preuve DB/migration sur ce périmètre. Lecture des variables
d'environnement Cloudflare réelles, preuve d'isolation Supabase Test après correctif, recette
navigateur profonde #65 : tout `NOT_APPLICABLE` depuis ce canal, avant et après ce diagnostic.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé, aucun nouveau rôle/RLS, aucune règle métier/UX nouvelle, aucun affaiblissement
du validateur `poser-build-id.js --verifier`, PR #65 elle-même non modifiée, aucun fichier applicatif
touché (diff limité à `docs/handoff/`), aucun contournement des restrictions d'écriture de ce canal,
aucune gate Créateur artificielle introduite.
