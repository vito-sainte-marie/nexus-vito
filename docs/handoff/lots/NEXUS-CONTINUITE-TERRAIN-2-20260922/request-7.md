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
  - id: patch-request6-applique
    classe: VERIFIED
    valeur: 664af985-modifie-uniquement-coherence-epingles-patch-identique-request6
  - id: premiere-execution-reelle-etape3
    classe: VERIFIED
    valeur: etapes-precedentes-toujours-exit1-avant-664af985-jamais-atteinte
  - id: candidate-non-figee-divergence-propre
    classe: VERIFIED
    valeur: diff-stat-501c0c7-664af985-208-fichiers-39371-792
  - id: test-chaine-temporelle-coherent-candidate
    classe: VERIFIED
    valeur: chargerControleJour-3-args-des-deux-cotes-candidate
  - id: test-parcours-depot-boutique-non-concluant
    classe: DECLARED
    valeur: script-unique-fonctions-inline-confirmees-execution-non-etablie
  - id: reconstruction-arbre-complet-candidate
    classe: NOT_APPLICABLE
    valeur: checkout-worktree-archive-fetch-tous-refuses-retentes-cette-session
  - id: lecture-log-run-35838111274
    classe: NOT_APPLICABLE
    valeur: gh-webfetch-refuses-aucun-reseau-ce-canal
  - id: classement-a-b-c
    classe: NOT_APPLICABLE
    valeur: non-resolu-honnetement-voir-corps-section-4
  - id: liste-connus-modifiee
    classe: NOT_APPLICABLE
    valeur: aucune-modification-proposee-sans-preuve
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 32-lots-conformes
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Diagnostic mécanique — `Comparer aux échecs connus` rouge sur `664af985`, en continuation de `request-6.md`

Réponse au réveil du 23/09/2026 (issue #28), sous l'autorisation déjà accordée par `decision-4.md`
(« poursuis uniquement les preuves Test/readiness objectivement disponibles... reviens par le rail »,
sans nouvel arbitrage pour un obstacle technique déterministe). Ne clôt pas `request-6.md` (aucune
décision n'y répond encore) : ce dépôt l'étend avec les faits obtenus depuis, sur le même lot.

## 1. Ce qui est confirmé, par preuve directe

**Le patch mécanique de `request-6.md` a bien été appliqué, et lève le premier blocage.** Lu
directement sur `origin/rebuild/carburants-65-20260922` (`664af9853481cb6676a900dd37f89257898c4a20`,
disponible localement dans ce canal — `git cat-file -e` confirme l'objet, contrairement aux sessions
précédentes de ce lot où seule la candidate antérieure `290a217f` était lisible) :

```yaml
      - name: Cohérence des épingles de cache
        env:
          NEXUS_ENV: test
          NEXUS_SUPABASE_URL: https://udljdqxerrbbbajxubfn.supabase.co
          NEXUS_SUPABASE_ANON_KEY: sb_publishable_essai0000000000
        run: bash outils/build.sh
```

Identique, mot pour mot, au patch proposé en §4 de `request-6.md`. Confirme la preuve GitHub citée
par le réveil (run `35838111274` : cette étape SUCCESS).

## 2. Ce que la lecture directe du workflow candidate établit — recadrage important

**Ce n'est PAS une régression du portage, et ce n'est probablement pas non plus une régression
métier introduite par `664af985` : c'est la PREMIÈRE exécution réelle de l'étape `Comparer aux
échecs connus` sur cette candidate.** Avant ce commit, la CI s'arrêtait systématiquement à l'étape 1
(`process.exit(1)` sur `--verifier`, cf. `request-6.md` §2) — l'étape 3 n'avait donc jamais tourné
jusqu'au bout sur cette branche. La liste figée dans le YAML (7 noms, ci-dessous) est un ARTEFACT
LEGACY jamais rejoué depuis son écriture, pas une liste entretenue au fil de l'eau comme
`docs/qa/ECHECS-CONNUS.json` sur le rail (qui, elle, est le SEUL lecteur de `run-tests.js` et se
corrige à chaque run — cf. `.github/workflows/tests.yml:135-146` du rail).

```yaml
CONNUS="test_inventaire_categorie_mixte_deux_lieux.js
test_inventaire_production_journaliere_q1.js
test_inventaire_sprint4_ux_flash.js
test_inventaire_sprint4bis_ecriture_immediate.js
test_pilotage_qualite_receptions.js
test_reception_moteur.js
test_reception_v1_dom.js"
```
Logique exacte (lue directement, `git show 664af985:.github/workflows/tests.yml`) :
```bash
ACTUELS=$(grep -oE 'test_[a-z0-9_]+\.js' /tmp/sortie.txt | sort -u || true)
ATTENDUS=$(echo "$CONNUS" | sed 's/^ *//' | sort -u)
NOUVEAUX=$(comm -13 <(echo "$ATTENDUS") <(echo "$ACTUELS") || true)   # dans ACTUELS, pas dans ATTENDUS
REPARES=$(comm -23 <(echo "$ATTENDUS") <(echo "$ACTUELS") || true)    # dans ATTENDUS, pas dans ACTUELS
```

## 3. Ce que ce canal a pu vérifier par preuve directe (pas par hypothèse)

`origin/rebuild/carburants-65-20260922` diverge de `origin/production` au commit `501c0c7`
(confirmé, objet lisible localement) — **PAS** un instantané figé : `git diff --stat 501c0c7
664af985` montre **208 fichiers changés, +39371/-792 lignes**, une évolution propre et substantielle
de PR #65 (pointage par service, planning source officielle, accueil hors service, etc.) qui court
jusqu'au 20/09/2026, indépendante du rail `handoff-continuite-20260920`. La liste `CONNUS` de 7 noms
n'est donc pas nécessairement fausse, mais rien ne prouve qu'elle ait jamais été vérifiée contre
cette évolution.

**Vérifié positivement, par lecture directe des deux côtés (signature + tous les appels)** : le test
`test_chaine_temporelle_carburant_20260821.js` — qui FIGURE dans la liste `ECHECS-CONNUS.json`
courante du rail, mais est ABSENT de la liste `CONNUS` de la candidate — est cohérent sur candidate,
donc ne peut pas produire un NOUVEAU échec sur cette étape :
- `nexus-carburant-donnees.js` sur `664af985` déclare `chargerControleJour(client, siteId, date)`
  — **3 paramètres**, jamais 4. Le durcissement qui exige un `timezone` (cause du échec sur le rail,
  `docs/qa/ECHECS-CONNUS.json`, motif établi 09/09/2026) n'existe pas dans cette version.
- Les 3 appels dans `test_chaine_temporelle_carburant_20260821.js` côté candidate passent tous
  exactement 3 arguments (`creerClientReel(), 'vito-sainte-marie', '2026-08-21'`).
- Contrat et appelant concordent : cette exclusion de la liste candidate est donc justifiée, pas une
  omission dangereuse.

**Non concluant, dans le temps disponible** : `test_inventaire_parcours_depot_boutique_reste.js`
(même famille, absent lui aussi de la liste candidate). Lecture directe confirme que
`NEXUS-Inventaire-v1.html` côté candidate porte bien exactement 1 `<script>` inline (condition
stricte du test) et que `estComptageDeuxLieuxEmploye`/`ordonnerParcoursDepotBoutiqueReste`/
`depotEntierementTermine` sont bien définies DANS ce même bloc inline (contrairement au défaut
« test par découpe » du rail) — signe favorable, mais insuffisant pour certifier que rien d'autre
dans les ~1700 lignes de ce bloc ne casse à l'exécution (ex. `NexusStation.quartConfigureDuMoment`
référencé ligne 568, dans une fonction dont ce test n'a pas pu établir depuis ce canal si elle est
appelée par le chemin exercé).

## 4. Ce que ce canal ne peut PAS établir — obstacle réel, pas un refus de chercher

Établir la liste RÉELLE de `ACTUELS` exige d'exécuter `node run-tests.js` sur l'arbre COMPLET de
`664af985` (224 fichiers `test_*.js` à la racine, chacun dépendant potentiellement d'un sous-ensemble
des ~500 autres fichiers de l'arbre). Ce canal ne dispose, comme documenté à chaque session
précédente de ce lot (`request-4.md`, `preuve-cloudflare-humaine-65-portage-1.md`,
`etude-isolation-test-candidats-web-1.md`), d'AUCUN moyen de matérialiser cet arbre :
`git checkout`/`git worktree add`/`git archive`/`git fetch` sont tous refusés par le harnais
(retentés explicitement dans cette session — `git worktree add`, `git archive --format=tar`,
tous refusés à nouveau, non contournés). La lecture du run `35838111274` lui-même (le log exact de
l'étape, qui afficherait littéralement `NOUVEAUX`/`REPARES` en un coup d'œil) est également hors de
portée : aucun accès réseau (`gh run view`, `WebFetch` — tous deux refusés dans cette session).
Reconstruire l'arbre fichier par fichier via des centaines d'appels `git show <ref>:<chemin>`
individuels pour couvrir la fermeture transitive de dépendances des 224 tests serait matériellement
possible en théorie mais n'est PAS une méthode fiable dans le temps disponible : une seule dépendance
oubliée fausserait le verdict, exactement le type de preuve non vérifiée que ce protocole interdit de
présenter comme certaine.

**Classement (a)/(b)/(c) : NON RÉSOLU, honnêtement.** Un item de la famille (`chaine_temporelle`) est
prouvé cohérent (candidate ne le liste pas, et il ne casserait pas s'il tournait). Aucun élément
disponible depuis ce canal ne permet de confirmer ou d'infirmer qu'un AUTRE test — parmi les 224,
potentiellement affecté par les 208 fichiers de divergence propre à PR #65 — échoue réellement sans
être dans la liste `CONNUS` (cas a), ou que l'un des 7 listés est désormais réparé (cas b).

## 5. Prochaine étape minimale, exacte, pour trancher en une seule mesure

Aucune reconstruction n'est nécessaire : le step `Comparer aux échecs connus` du run `35838111274`
sur `664af985`, une fois relu (interface GitHub Actions, ou `gh run view 35838111274 --log-failed`
depuis une session avec réseau), affiche verbatim l'un des deux blocs `::error::` de la §2 —
`Nouveaux tests en échec :` (cas a) ou `Ces tests ne sont plus en échec` (cas b) — avec les noms
exacts. C'est la preuve la plus rapide et la plus sûre, déjà produite par le run lui-même, qu'aucune
reconstruction locale ne peut égaler en fiabilité. Alternative équivalente : `git checkout
664af9853481cb6676a900dd37f89257898c4a20 && node run-tests.js` depuis une session outillée.

**Aucune modification de la liste `CONNUS` n'est proposée ici** : la corriger sans preuve du contenu
réel de `ACTUELS` serait exactement « modifier la liste pour rendre la CI verte sans preuve »,
interdit par le réveil. Si la cause s'avère (a) un vrai nouveau défaut applicatif, ce lot reste
`NON PRÊTE` et remonte par un nouveau `request-N.md` avec la description exacte pour arbitrage (le
risque matériel éventuel n'est pas encore qualifié). Si (b) ou (c) purement mécanique, le patch
consiste à ajouter/retirer un nom dans `CONNUS=` du workflow candidate — même obstacle de transport
que §4 de `request-6.md` (écriture Git vers `rebuild/carburants-65-20260922` refusée par ce canal,
patch à déposer ici pour application externe, jamais à imposer sans la preuve du run).

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé (mêmes valeurs Test déjà citées 49 fois dans le dépôt), aucune nouvelle règle
métier/UX/RLS/rôle, PR #65 non modifiée, aucun fichier applicatif touché (diff limité à
`docs/handoff/`), aucune tentative d'écriture Git superflue (`git checkout`/`worktree`/`archive`
retentés une fois chacun comme demandé, refusés, non recontournés), aucune sollicitation de Frédéric
pour ce blocage technique déterministe, aucune déclaration de candidate prête, aucune modification de
la liste des échecs connus sans preuve de son contenu réel.
