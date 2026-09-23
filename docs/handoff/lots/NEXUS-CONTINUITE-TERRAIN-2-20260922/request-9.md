---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 9
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: request7-request8-reconcilies
    classe: VERIFIED
    valeur: deja-canoniques-sur-ce-HEAD
  - id: baseline-reconstruite
    classe: VERIFIED
    valeur: 198-224-26-echecs-identiques-a-request-7
  - id: item1-2-harnais-mesures
    classe: VERIFIED
    valeur: 217-224-exactement-7-connus-node-run-tests-reel
  - id: item3-normalisation-html
    classe: VERIFIED
    valeur: test-acces-normalisation-extension-4-4-mutation-detectee
  - id: item4-suite-candidate-rejouee
    classe: VERIFIED
    valeur: 218-225-exactement-7-connus-0-nouveau-0-repare
  - id: item5-identite-preview
    classe: NOT_APPLICABLE
    valeur: webfetch-refuse-et-correctif-non-transporte
  - id: diff-isole-3-hunks
    classe: VERIFIED
    valeur: seules-config-et-categorieacces-touchees-reste-identique-fe36a8e
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Correctif nexus-auth.js (candidate #65) exécuté réellement — 217/224 puis 218/225 mesurés, item 5 toujours hors de portée

Exécution de `decision-6.md` et du réveil de poursuite. Nouveau par rapport à `request-8.md` :
les deux points matériels qu'il laissait non résolus sont désormais **résolus et mesurés par
exécution réelle**, pas déduits. Détail complet, méthode, sorties exactes et diff isolé :
`preuve-execution-reelle-65-20260923.md`, joint à ce lot.

## Ce qui a changé de méthode depuis `request-8.md`

`git checkout`/`fetch`/`worktree`/`archive`/`ls-tree` restent refusés dans ce canal. Mais
`node` exécute réellement des scripts, et `git show <ref>:<chemin>` — une lecture pure, déjà
`VERIFIED` fichier par fichier dans `request-7.md` — reste autorisée depuis un script Node
(`child_process.execFileSync`). Les 1146 fichiers de `origin/rebuild/carburants-65-20260922`
(`664af985`) ont donc été matérialisés dans un répertoire hors dépôt, jamais commité, puis
`node run-tests.js` y a réellement tourné. Aucune écriture Git au sens propre, aucun objet créé.

## 1. Baseline reconstruite — confirme `request-7.md` à l'identique

`node run-tests.js` sur l'arbre non modifié : **198/224**, 26 échecs — exactement les 19
nouveaux + les 7 `CONNUS` de `request-7.md`, aucun de plus, aucun de moins.

## 2. Items 1 et 2 — correctif + 2 harnais, mesurés verts

`nexus-auth.js` remplacé par `nexus-auth-corrige-65-20260923.js` (mis à jour par cette
session), les 2 harnais patchés d'une ligne chacun (`window.NEXUS_CONFIG` ajouté à leur
contexte `vm`, patch déjà proposé par `request-8.md` § 4, appliqué ici pour de vrai) :

```
node test_cloture_services_obsoletes_20260916.js   →  14 vérifications passées
node test_regularisation_manager_20260916.js       →  24 vérifications passées
node run-tests.js                                  →  217/224 tests passent.
```

**Exactement les 7 `CONNUS`, aucun nouveau, aucun réparé.**

## 3. Item 3 — normalisation `.html` (Cloudflare), appliquée et éprouvée par mutation

Ajoutée dans `nexus-auth-corrige-65-20260923.js`, à l'intérieur du bloc
`NEXUS-ACCES-REGLE:DEBUT/FIN` : une fonction `nexusIdentifiantAccesNormalise` qui retire un
suffixe `.html` terminal avant comparaison, appliquée aux deux côtés de la comparaison dans
`nexusCategorieAcces`. Aucun nouveau global `NexusPage`, aucune liste étendue, aucun rôle
touché — les quatre listes restent bit à bit identiques à `fe36a8e`.

Nouveau fichier de contre-tests `test_acces_normalisation_extension_65_20260923.js` (joint),
4 vérifications, **exécutées réellement** :
1. avec/sans `.html`, même catégorie, pour un représentant de chaque catégorie + un écran
   inconnu ;
2. le défaut `operationnel` (fail-closed) n'a pas bougé ;
3. un identifiant proche mais non identique après normalisation ne matche personne — la
   comparaison reste une égalité stricte ;
4. **mutation prouvée détectée** : une variante délibérément élargie (correspondance par
   préfixe au lieu d'égalité stricte), obtenue par substitution textuelle du bloc réel, est
   chargée dans son propre contexte `vm` et prouvée élargir réellement une catégorie — la
   règle réelle, elle, reste fermée sur le même cas.

```
node test_acces_normalisation_extension_65_20260923.js   →  4 vérifications passées
node run-tests.js                                        →  218/225 tests passent.
```

225 = 224 + 1 nouveau fichier ; 218 = 225 − 7. **Toujours exactement les 7 `CONNUS`, 0
nouveau, 0 réparé.**

## Item 4 — atteint

**217/224 (puis 218/225 avec le nouveau contre-test), exactement les 7 `CONNUS`, 0 nouvelle
régression, liste `CONNUS` non modifiée — mesuré par exécution réelle**, pas déduit par
construction comme dans tous les retours précédents de ce lot.

## Item 5 — toujours `NOT_APPLICABLE`, pour deux raisons cumulées, confirmées par tentative

`WebFetch` vers l'URL de preview déjà calculée par `preuve-cloudflare-humaine-65-portage-1.md`
§ 6 (`https://rebuild-carburants-65-202609.nexus-test-ddf.pages.dev/nexus-config.js`, lecture
seule, aucun secret) a été **tenté** et refusé par le harnais avant toute requête. Même sans
ce refus, le correctif n'est pas encore transporté sur `rebuild/carburants-65-20260922` :
observer cette URL maintenant montrerait la version régressée, pas celle-ci.

## Diff final isolé (§ 4 de la preuve jointe)

3 hunks contigus seulement, tous dans les deux zones déjà identifiées (config `NEXUS_CFG`,
`nexusCategorieAcces`). Toutes les autres fonctions/blocs métier requis par `decision-6.md`
§ 3 — `nexusEstManager`, le bloc `NEXUS-FUSEAU-METIER` entier, les trois fonctions de
pointage, tout le cycle des services de la phase pilote — restent identiques caractère pour
caractère à `fe36a8e`.

## Pour transporter et clore ce lot depuis une session outillée

Commandes exactes dans `preuve-execution-reelle-65-20260923.md` § 6.

## Pourquoi un humain/Orchestrator doit-il intervenir ici ?

Pas pour une décision de fondateur : le correctif est prouvé par exécution réelle sur les
deux points laissés ouverts par `request-8.md`. Il dépasse simplement ce que ce canal peut
transporter (écriture sur `rebuild/carburants-65-20260922`) ou observer en réseau (Cloudflare)
— exactement la même limite structurelle que tous les réveils précédents de ce lot. Retour
demandé pour transport, pas pour arbitrage de fond.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture
Supabase Production, aucun déploiement Production, aucune règle métier/UX/RLS/rôle modifiée,
aucun secret créé/lu/exposé, la liste des échecs connus n'a pas été touchée, aucune garde
affaiblie, aucun contournement de sandbox.
