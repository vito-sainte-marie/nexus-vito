# Gouvernance Autonome v2 — implémentation Guardians backend (2026-09-07)

Statut : **PARTIEL — outillage livré et éprouvé, câblage CI non fait (restriction d'outil), preuve navigateur Test non faite (secrets absents)**
Portée : `outils/`, tests de gouvernance, ce document. Aucun fichier applicatif/métier touché. Aucun fichier du lot Carburants actif touché. `docs/handoff/STATE.json` non modifié.

## 1. PREFLIGHT (obligatoire avant tout travail de lot)

Constat identique aux réveils précédents de l'issue #28 : ce checkout (`claude/issue-28-20260907-0028`) est raciné sur `origin/main` (HEAD hérite de `2ded5215b6f8865ef581397083d884202a3d905f`, dernier commit CI cité dans le réveil), **pas** sur `config-par-environnement` (HEAD réel `219d1366717a03014e642dc22dd4ce023f510195`). `git merge-base --is-ancestor HEAD origin/config-par-environnement` échoue. Par construction, `docs/handoff/`, `docs/gouvernance/`, `docs/adr/`, `docs/learning/`, `outils/handoff.js`, `outils/garde-portee-site.js` sont **absents** de ce répertoire de travail avant toute action.

Ceci est exactement le cas que l'ADR-0002/ENV-001 demande de refuser pour un **lot produit**. Ce lot est cependant un lot de gouvernance/CI explicitement autorisé en parallèle par Frédéric, strictement démontable et disjoint du lot Carburants actif (§8 de la gouvernance v2). J'ai donc :
- matérialisé en lecture les fichiers canoniques nécessaires via `git show config-par-environnement:<chemin>` (jamais de checkout/merge) pour lire les sources et pouvoir exécuter réellement les nouveaux outils ;
- implémenté **le contrôle ENV-001 lui-même** (`preflightHeadCanonique` dans `outils/guardians-router.js`) comme fonction exportée et testée, prête à être appelée par un lanceur de lot avant tout codage produit ;
- **non** consommé ni déposé quoi que ce soit dans `docs/handoff/` (hors périmètre explicite de ce lot), et **non** modifié `docs/handoff/STATE.json`.

## 2. Ce qui a été implémenté (commit voir §7)

### `outils/guardians-router.js`
Routeur Guardians backend silencieux :
- calcule les fichiers changés (`git diff --name-only <base>...<tête>`, repli sur la liste complète si la base est illisible) ;
- déduit les scopes/modules touchés par heuristique de chemin (`supabase/migrations` → security+architecture, `outils/` → development+architecture, `docs/gouvernance|learning|handoff`, `.github/workflows`, `test_*.js` → qa, `carburant` → module `carburants-performance`) ;
- filtre `docs/learning/RULES.json` par scope/module réellement en portée (`reglesEnPortee`) ;
- **Guardian Security & Isolation** : détecte un JWT littéral, une clé `service_role`/`SUPABASE_SERVICE_ROLE_KEY` assignée en dur dans les fichiers changés (silence sur une simple référence à une variable d'environnement) ;
- **Guardian Architecture & Coherence** :
  - `preflightHeadCanonique(...)` — implémente ENV-001 mécaniquement (branche courante = `config-par-environnement` ou ancêtre de son HEAD distant, sinon blocage explicite) ;
  - `identitesGlobalesDeclarees` / `guardianArchitectureCollisions` — généralise le constat réel de l'audit `NEXUS-GUARDIAN-ARCHITECTURE-COHERENCE-1-20260906` (`window.NexusStock`/`global.NexusStock` déclarée par deux fichiers, `nexus-stock.js` et `nexus-stock-moteur.js`) en contrôle automatique et rejouable : toute identité globale (`window.X`/`global.X`) déclarée par plus d'un fichier `.js` à la racine devient un finding. **Vérifié sur le dépôt réel : détecte bien la collision `NexusStock` existante** ;
  - `guardianArchitectureDependances` — refuse qu'un fichier applicatif (hors `outils/`, `docs/`, `test_*.js`, `.github/`) référence `docs/gouvernance`, `docs/learning` ou `require('outils/...')`, conformément à ADR-0002 (« absence de dépendance applicative ») ;
- assemble le tout dans `executer()` et une sortie CLI : **silence total si 0 finding**, liste concise sinon, code de sortie non nul uniquement sur finding.

QA/Regression et Business/Bible ne sont **pas** dupliqués dans ce routeur : la suite existante (`run-tests.js`, `outils/handoff.js verifier`, `npm run simulations`) reste l'source de vérité QA dans `tests.yml`, et aucune règle métier semantique nouvelle n'a été inventée (conforme à l'instruction explicite de ne rendre bloquant que le mécanisable).

### `outils/verifier-apprentissage.js`
Vérification post-lot de la mémoire (§7 gouvernance v2, point 6 ADR-0002) :
- `validerRules` : schéma `nexus-rules/1`, champs obligatoires, format d'id `PREFIXE-NNN`, **id dupliqué détecté**, `severity` hors vocabulaire connu → avertissement (pas bloquant, pour ne pas geler une extension légitime du vocabulaire) ;
- `validerExperience` : chaque ligne JSON valide, champs obligatoires, date lisible, et surtout **`promoted_rule` doit référencer une règle `RULES.json` existante OU un ADR existant** (`ADR-000N`) ;
- **GOV-002 mécanisé** : si `(component, cause)` apparaît ≥ 2 fois dans `EXPERIENCE.jsonl` sans qu'aucune occurrence ne porte `promoted_rule`, avertissement explicite — exactement la règle « un problème résolu deux fois doit être promu avant une troisième analyse humaine identique », rendue vérifiable automatiquement plutôt que déclarative.

**Finding réel obtenu dès le premier passage** (avant l'ajustement décrit ci-dessous) : `EXPERIENCE.jsonl` ligne 3 porte `promoted_rule: "ADR-0002"`, qui n'est pas un id de `RULES.json`. Ce n'est pas une erreur de contenu — `ADR-0002` est une référence légitime à une décision structurante — mais un angle mort de ma première version du contrôle, qui ne savait vérifier que des ids de règles. Corrigé en faisant reconnaître à `promoted_rule` les deux registres valides (`RULES.json` **ou** `docs/adr/000N-*.md` existant). Sur le registre canonique réel du dépôt, le contrôle passe désormais avec 0 erreur (10 règles, aucun doublon, aucun id invalide, aucune récurrence non promue).

### `outils/recette-navigateur-test.js`
Précondition de recette navigateur Test conditionnée aux secrets (`NEXUS_TEST_URL`, `NEXUS_TEST_PIN_MANAGER`, `NEXUS_TEST_PIN_EMPLOYE`) — **noms exacts à provisionner**, jamais des valeurs Production. Si absents : message explicite, **sort en succès (non bloquant)**, conforme à l'instruction « rester non bloquant pour les lots sans UI ». Si présents : vérifie que `npx --yes playwright --version` est exécutable (aucune dépendance Playwright commitée — coût nul tant que personne ne l'active réellement). N'écrit aucun spec applicatif Playwright à la place du lot produit concerné — hors périmètre de ce lot gouvernance/CI.

Vérifié dans ce canal : les trois secrets sont **absents** (confirmé sans les afficher, seulement leur présence/longueur testée), le script se termine proprement en `exit 0` avec le message d'absence.

## 3. Ce qui n'a PAS été fait, et pourquoi

**Câblage dans `.github/workflows/tests.yml`** — non fait. Ce n'est pas un blocage externe au sens d'un accès manquant : c'est une restriction d'outil documentée de cette session (« Modify files in the .github/workflows directory (GitHub App permissions do not allow workflow modifications) »), indépendante de la permission humaine donnée par Frédéric. Le snippet à ajouter (juste avant l'étape « Simulations métier » existante, après la garde ADR-0001) :

```yaml
      - name: Guardians backend (Gouvernance Autonome v2)
        run: node outils/guardians-router.js

      - name: Apprentissage — intégrité RULES/EXPERIENCE
        run: node outils/verifier-apprentissage.js

      - name: Recette navigateur Test (non bloquante si secrets absents)
        env:
          NEXUS_TEST_URL: ${{ secrets.NEXUS_TEST_URL }}
          NEXUS_TEST_PIN_MANAGER: ${{ secrets.NEXUS_TEST_PIN_MANAGER }}
          NEXUS_TEST_PIN_EMPLOYE: ${{ secrets.NEXUS_TEST_PIN_EMPLOYE }}
        run: node outils/recette-navigateur-test.js
```

À ajouter par une session/humain disposant du droit d'édition des workflows, sur `config-par-environnement`.

**Preuve navigateur Test réelle** — non faite : secrets absents de ce canal (confirmé, §2). Le script en rend compte lui-même sans être bloquant.

**Contrôles Business/Bible sémantiques** — volontairement non mécanisés : aucune règle métier nouvelle inventée, conformément à l'instruction. Seul CARB-001 (déjà codifié dans le moteur carburant, hors périmètre de ce lot) reste la seule règle Business mécanisable existante.

## 4. Tests exécutés réellement (pas de trace manuelle)

- `node test_guardians_router_20260907.js` → **9/9**, y compris la détection réelle de la collision `NexusStock` et le cycle mutation vert→rouge→vert sur les detecteurs.
- `node test_verifier_apprentissage_20260907.js` → **9/9**, y compris le test qui exécute `verifier()` contre le registre canonique réel du dépôt (matérialisé depuis `config-par-environnement`).
- `node run-tests.js` (176 fichiers avec les 2 nouveaux) → **167/176**, les 9 échecs restants sont exactement ceux déjà documentés et tolérés dans `.github/workflows/tests.yml` (inventaire, réception, pilotage qualité réceptions, chaîne temporelle carburant) — **aucune régression, aucun nouveau fichier en échec**.
- `node outils/garde-portee-site.js` (inchangé) → toujours 13 VULNERABLE / 3 incohérences / 3 dérogées, identique à l'état canonique connu — non touché par ce lot.
- `node outils/handoff.js verifier` — **non concluant dans ce canal** : ce checkout ne contient que `STATE.json`/`REPRISE.md` matérialisés à la main, pas l'arborescence complète `docs/handoff/lots/*` ; le verifier échoue sur des fichiers `request-*.md`/`decision-*.md` absents de ce répertoire de travail partiel, pas sur une vraie régression du protocole. Non représentatif, donc non retenu comme preuve.

## 5. Coût et dépendances

Zéro dépendance nouvelle committée. `npx playwright` n'est téléchargé qu'à l'exécution réelle de la recette, jamais au clone. Tout le reste est Node natif (`fs`, `path`, `child_process`) — conforme à « GitHub + Node/JSON/JSONL + Actions, gratuite et démontable ». Démontabilité : supprimer les trois fichiers `outils/guardians-router.js`, `outils/verifier-apprentissage.js`, `outils/recette-navigateur-test.js` et leurs deux fichiers de test ne casse aucun fichier applicatif (`guardianArchitectureDependances` vérifie d'ailleurs mécaniquement qu'aucun fichier produit ne dépend de `outils/`, `docs/gouvernance/` ou `docs/learning/`).

## 6. Secrets Test manquants (noms exacts, à provisionner par un humain — jamais par ce canal)

- `NEXUS_TEST_URL`
- `NEXUS_TEST_PIN_MANAGER`
- `NEXUS_TEST_PIN_EMPLOYE`

## 7. Preuve qu'aucun fichier produit/Production n'a été modifié

Fichiers créés par ce lot, tous sous `outils/`, tests à la racine (convention `test_*.js` déjà établie) et ce document :
- `outils/guardians-router.js`
- `outils/verifier-apprentissage.js`
- `outils/recette-navigateur-test.js`
- `test_guardians_router_20260907.js`
- `test_verifier_apprentissage_20260907.js`
- `docs/gouvernance/2026-09-06-governance-autonome-v2-implementation.md` (ce document)

Aucun fichier `nexus-*.js`/`NEXUS-*.html`/`supabase/migrations/*` n'a été créé ou modifié. `docs/handoff/STATE.json` n'a pas été modifié (seulement lu, matérialisé en copie locale pour rendre ce checkout exploitable). Aucun changement sur `main`/`production`, aucune opération Supabase, aucun secret ajouté ou exposé.

## 8. Prochaine étape (hors périmètre de ce lot)

Une session avec (a) droit d'édition de `.github/workflows/tests.yml` sur `config-par-environnement` et (b) les trois secrets Test listés au §6 peut : ajouter le snippet du §3, puis observer le routeur Guardians tourner en CI sur chaque push et la recette navigateur Test s'activer réellement. Le finding `NexusStock` (déclaration dupliquée, `nexus-stock.js` / `nexus-stock-moteur.js`) reste, comme dans `audit-1.md`, un arbitrage en attente : code mort à supprimer, ou fichier à renommer — ce lot ne tranche pas, il rend le constat rejouable automatiquement.
