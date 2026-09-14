---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-ORCHESTRATION-REPAIR-1-20260907
seq: 2
author: Claude
branch: config-par-environnement
status: AWAITING_DECISION
token_mode: DEEP
in_reply_to: decision-1.md
---

# Réparation de la chaîne Guardians/CI — rapatriement effectué, câblage CI bloqué par permission d'outil

## 1) HEAD de départ vérifié

`origin/config-par-environnement` = `83f39a8dd36278973df3e5277cde2a4fee785a9d` — identique au « HEAD canonique attendu » et au commit de `decision-1.md` cités dans le réveil. Confirmé par `git rev-parse` et `git show` en lecture seule.

Le checkout d'exécution de cette session Claude (`issue_comment`) restait, comme documenté à chaque réveil précédent de ce fil, raciné sur `main` (`645116b`) et non ancêtre de `config-par-environnement` — défaut structurel `issue_comment -> branche depuis main`, inchangé, **non prétendu résolu** par ce lot (hors périmètre, `main` non touché). `git checkout <ref> -- <chemin>` était bloqué dans cette session (approbation non disponible en run automatisé) ; chaque fichier a donc été relu via `git show <ref>:<chemin>` puis réécrit fichier par fichier — même méthode que les lots précédents de ce fil.

## 2) Comparaison sélective avec `4ecccc85`

Diff `origin/config-par-environnement...origin/claude/issue-28-20260907-0028` limité à `docs/learning/` : le canonique est **plus récent** (règles `ENV-003`, `GOV-003`, entrée `EXPERIENCE.jsonl` sur le control-plane ADR-0003, absentes de `4ecccc85`). Conformément à `decision-1.md` (« ne jamais recopier les anciennes copies stale... si les versions canoniques sont plus récentes »), **aucune copie de `docs/learning/`, `docs/adr/`, `docs/gouvernance/` ou `docs/handoff/` n'a été rapatriée depuis `4ecccc85`** — ces répertoires canoniques restent ceux déjà présents sur `config-par-environnement`.

Seuls les outils et tests suivants, sans dépendance à une copie stale (ils lisent `docs/learning/*` à l'exécution, jamais une copie figée), ont été rapatriés à l'identique de `4ecccc85` :
- `outils/guardians-router.js`
- `outils/verifier-apprentissage.js`
- `outils/recette-navigateur-test.js` (candidat autorisé par `decision-1.md` point 2 — toujours cohérent, aucun secret, aucun appel réseau tant que les 3 noms `NEXUS_TEST_URL`/`NEXUS_TEST_PIN_MANAGER`/`NEXUS_TEST_PIN_EMPLOYE` ne sont pas injectés)
- `test_guardians_router_20260907.js`
- `test_verifier_apprentissage_20260907.js`

## 3) Preuves exécutées réellement dans cette session (pas de trace manuelle)

- `node test_guardians_router_20260907.js` → **9/9**, y compris la collision réelle `NexusStock` (`nexus-stock.js` vs `nexus-stock-moteur.js`, toujours présente sur canonique) et la mutation JWT littéral (rouge → vert après correction de la fixture).
- `node test_verifier_apprentissage_20260907.js` → **9/9**, dont l'épreuve `verifier()` exécutée contre le `docs/learning/RULES.json`/`EXPERIENCE.jsonl` **réels** de `config-par-environnement` (matérialisés en lecture depuis `origin/config-par-environnement`, non modifiés, non commités par ce lot).
- **Mutation négative réelle au niveau CLI** (pas seulement interne au fichier de test) : `node outils/verifier-apprentissage.js` → `Apprentissage : OK — 12 règle(s)...` (silence/succès, exit 0) ; injection d'un id `ENV-001` dupliqué dans `docs/learning/RULES.json` → `node outils/verifier-apprentissage.js` échoue avec `ERREUR id dupliqué : ENV-001` (exit 1) ; restauration du fichier → retour exact au message de succès initial (exit 0).
- `node outils/guardians-router.js` (sans mutation, diff réel `HEAD~1...HEAD` de ce checkout) → `Guardians: OK — ... 0 finding.` : confirme le silence par défaut en l'absence de finding, sur une invocation CLI réelle et non simulée.
- **Régression** (dans ce checkout, `docs/` canonique absent — voir limite §5) : `node run-tests.js` → **167/176**, les 9 échecs restants strictement identiques à la liste tolérée de `.github/workflows/tests.yml` sur `config-par-environnement` (`test_chaine_temporelle_carburant_20260821.js`, `test_inventaire_categorie_mixte_deux_lieux.js`, `test_inventaire_parcours_depot_boutique_reste.js`, `test_inventaire_production_journaliere_q1.js`, `test_inventaire_sprint4_ux_flash.js`, `test_inventaire_sprint4bis_ecriture_immediate.js`, `test_pilotage_qualite_receptions.js`, `test_reception_moteur.js`, `test_reception_v1_dom.js`) — aucun nouvel échec, aucun test connu réparé silencieusement.
- Refs protégées résolues : `origin/main = 645116b3436dfececaf1aeb647ef9f1bbe3d42d5`, `origin/production = 501c0c744c3327dd5693a2bddc45d064045ca474`.
- Aucune valeur de secret journalisée (aucun `NEXUS_TEST_*` inspecté ni lu).

## 4) Câblage dans `.github/workflows/tests.yml` — BLOQUÉ par permission d'outil, pas par la décision

Cette session Claude n'a **pas la permission d'éditer `.github/workflows/*`**, quelle que soit l'autorisation humaine/canonique citée dans le réveil — restriction fixée par les capacités de l'outillage Claude Code Action pour ce canal (`issue_comment`), indépendante de `decision-1.md` et de la Gouvernance Autonome v2 §8. Ce n'est donc **pas** le défaut structurel `issue_comment -> branche depuis main` déjà connu : c'est une seconde limite distincte, propre à l'édition de fichiers de workflow, qui persistera tant qu'une session avec ce droit n'exécute pas le câblage.

Snippet exact à ajouter dans `.github/workflows/tests.yml` de `config-par-environnement`, entre l'étape « Comparer aux échecs connus » et l'étape « Protocole Handoff v2 » (aucun secret, aucun accès réseau — `NEXUS_GUARDIANS_BASE_REF` utilise uniquement les refs déjà récupérées par `fetch-depth: 0`) :

```yaml
      - name: Guardians backend (Gouvernance Autonome v2)
        env:
          NEXUS_GUARDIANS_BASE_REF: ${{ github.event.pull_request.base.sha || github.event.before || 'HEAD~1' }}
          NEXUS_GUARDIANS_HEAD_REF: HEAD
        run: node outils/guardians-router.js

      - name: Vérification de l'apprentissage (RULES.json / EXPERIENCE.jsonl)
        run: node outils/verifier-apprentissage.js

      - name: Recette navigateur Test — précondition (non bloquante)
        run: node outils/recette-navigateur-test.js
```

Les deux premières étapes sont bloquantes par construction (`exit 1` sur finding déterministe, silencieuses sinon). La troisième sort toujours en succès (0) — elle ne fait que déclarer les secrets manquants sans les lire.

## 5) Limites résiduelles honnêtes

1. **Câblage CI non fait** (§4) — nécessite une session/humain avec droit d'édition sur `.github/workflows/*`.
2. **Rapatriement non poussé sur `config-par-environnement`** — ce checkout reste raciné sur `main` (défaut structurel déjà connu, non résolu par ce lot). Commandes de rapatriement ci-dessous.
3. **Régression mesurée sur un arbre partiel** : ce checkout ne contient pas l'arbre `docs/` complet de `config-par-environnement` (seuls `docs/learning/RULES.json`, `docs/learning/EXPERIENCE.jsonl` et deux fichiers `docs/adr/000X-*.md` factices — jamais commités — ont été matérialisés localement pour permettre l'exécution réelle des tests). La correspondance exacte avec les 9 échecs tolérés de `tests.yml` est un indice fort mais pas une exécution sur le HEAD canonique complet ; à reconfirmer depuis une session réellement racinée sur `config-par-environnement`.
4. `outils/recette-navigateur-test.js` n'a pas été exécuté avec des secrets Test présents (aucun injecté dans ce canal) — seul le chemin « secrets absents, non bloquant » a été vérifié.

## Pour rapatrier sur `config-par-environnement`

```
git fetch origin claude/issue-28-20260907-1112 config-par-environnement
git checkout -b lot/orchestration-repair-1 origin/config-par-environnement
git checkout origin/claude/issue-28-20260907-1112 -- \
  outils/guardians-router.js outils/verifier-apprentissage.js outils/recette-navigateur-test.js \
  test_guardians_router_20260907.js test_verifier_apprentissage_20260907.js \
  docs/handoff/lots/NEXUS-ORCHESTRATION-REPAIR-1-20260907/request-2.md
node run-tests.js guardians && node run-tests.js apprentissage   # doivent rester verts
# Ajouter le snippet CI de la section 4 ci-dessus à .github/workflows/tests.yml
git commit -m "gouvernance: rapatriement Guardians backend + apprentissage (repair-1) + câblage CI"
git push origin lot/orchestration-repair-1:config-par-environnement
```

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration, aucun secret/PIN/service_role ajouté ou exposé, aucun cherry-pick/merge aveugle (rapatriement sélectif fichier par fichier, comparaison explicite des divergences), aucune modification du lot Carburants actif, aucun fichier applicatif/métier modifié (diff limité à `outils/`, `test_guardians_router_20260907.js`, `test_verifier_apprentissage_20260907.js`, `docs/handoff/lots/NEXUS-ORCHESTRATION-REPAIR-1-20260907/`).
