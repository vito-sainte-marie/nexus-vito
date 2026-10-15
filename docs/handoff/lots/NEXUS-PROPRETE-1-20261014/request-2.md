---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-PROPRETE-1-20261014
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: ChatGPT
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=dea3ae73 production=50c634a8
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 150-fichiers
  - id: classement-92-branches
    classe: VERIFIED
    valeur: 128 entrees (36+92) ; nouvelles = 4 INTEGREE, 53 HISTORIQUE_SANS_ACTION, 35 A_REPRENDRE
  - id: garde-branches-en-rade
    classe: VERIFIED
    valeur: 0 CLASSEMENT_INVALIDE, 0 REPRISE sur les 92 nouvelles entrees ; test_garde_branches_en_rade 30/30 ; 19 EN RADE preexistantes hors perimetre
  - id: skill-h08-corrige
    classe: VERIFIED
    valeur: recette.js 16/16 ; audit reel du rail : 0 occurrence H08_DOSSIER_SANS_REGISTRE
  - id: suite-tests
    classe: DECLARED
    valeur: run-tests.js : 2 echecs dus a GITHUB_SHA/GITHUB_REF_NAME du bac a sable (main au lieu du HEAD rail) ; 1 test flaky sous charge, stable isole ; aucun lie a ce diff
---
# Classement des 92 branches + correction H08 du skill — exécutés

## Preuve des conditions de decision-1

Les trois conditions cumulatives de `decision-1.md` sont respectées :

1. **« Classer exactement les 92 branches non classées avec une justification
   vérifiable par branche, sans assimiler automatiquement un squash-merge à
   une branche non intégrée »** — fait. Chaque tête est mesurée fichier par
   fichier (`git diff --no-renames --name-status`) contre sa base (merge-base
   avec le rail), puis chaque fichier pertinent est comparé au contenu ACTUEL
   de rail/main/production avant de conclure : 4 `INTEGREE` (contenu
   retrouvé identique malgré l'absence d'ascendance git), 53
   `HISTORIQUE_SANS_ACTION` (aucun fichier hors miroirs Handoff), 35
   `A_REPRENDRE` (au moins un fichier non retrouvé identique). Aucune branche
   n'est classée sur la seule absence d'ascendance.
2. **« Limiter la correction du skill à la lecture de
   `artefacts_hors_registre` et à son épreuve »** — fait et rien de plus :
   `analyserLot` lit le nouveau paramètre `horsRegistre` (vrai si le lot
   figure dans `STATE.json.artefacts_hors_registre`) et n'émet plus
   `H08_DOSSIER_SANS_REGISTRE` dans ce cas ; un scénario dédié (`12e`) couvre
   le cas positif ET le cas négatif (toujours détecté si non déclaré).
3. **« Ne supprimer ni déplacer aucune ref, ne fermer ni fusionner aucune PR,
   et ne toucher ni main, ni production, ni claude.yml, ni secrets ou
   permissions »** — respecté : seuls `docs/handoff/BRANCHES-CLASSEES.json`,
   `docs/handoff/STATE.json` (consommation de la décision), `docs/nexus/BACKLOG.md`
   et trois fichiers de `docs/skills/nexus-lot-reconciler/` sont modifiés.
   Aucune commande git touchant une ref distante autre que le push sur le
   rail lui-même.

## Détail du classement

Pour chaque fichier ajouté/modifié par une branche par rapport à sa base avec
le rail (hors miroirs Handoff `docs/handoff/CURRENT.md`, `DECISION.md`,
`STATE.json`, `lots/**`), l'outil cherche une version identique dans
rail/main/production :

- **4 `INTEGREE`** : tous les fichiers pertinents identiques au canonique.
- **53 `HISTORIQUE_SANS_ACTION`** : zéro fichier pertinent — ces branches ne
  portaient que de l'état Handoff (consommation/publication), remplacé
  depuis par l'état postérieur du rail.
- **35 `A_REPRENDRE`** : au moins un fichier non retrouvé identique (absent
  ou différent du canonique actuel). `renvoi: BRANCHE-001`, nouvelle entrée
  Backlog qui nomme les 35 branches et désigne `BRANCHES-CLASSEES.json` pour
  le détail mesuré par branche (fichiers, commit de base) — condition de
  `garde-branches-en-rade.js` (`validerEntree`), qui refuse un `A_REPRENDRE`
  sans renvoi vérifiable.

## Preuves

- **classement** (VERIFIED) — `docs/handoff/BRANCHES-CLASSEES.json` : 128
  entrées (36 préexistantes + 92 nouvelles) ; 92 nouvelles = 4 INTEGREE + 53
  HISTORIQUE_SANS_ACTION + 35 A_REPRENDRE.
- **garde-branches-en-rade** (VERIFIED) — `node outils/garde-branches-en-rade.js`
  après commit : 0 `CLASSEMENT_INVALIDE`, 0 `REPRISE` sur les 92 nouvelles
  entrées ; `test_garde_branches_en_rade_20260908.js` 30/30. 19 branches
  `claude/*` restent `EN RADE` : préexistant et hors périmètre de ce lot — ce
  sont des ancêtres de `production` mais pas du rail, que `garde-branches-en-rade.js`
  mesure contre le rail seul pour le préfixe `claude/` (`docs/handoff/AUTORITES-DE-BRANCHE.json`),
  indépendamment de ce classement. Publié `BLOCKED` par `tests.yml`, non
  bloquant pour la CI.
- **skill-H08** (VERIFIED) — `node docs/skills/nexus-lot-reconciler/tests/recette.js` :
  16/16. Audit réel du rail (`reconcilier.js registre --rail handoff-continuite-20260920`) :
  0 occurrence de `H08_DOSSIER_SANS_REGISTRE` dans le résumé des anomalies.
- **suite complète** (DECLARED) — `node run-tests.js` : 2 échecs constants
  (`test_executants_fermes_20261014.js`, `test_relais_arbitre_openai_20261007.js`)
  dus à `GITHUB_SHA`/`GITHUB_REF_NAME` du bac à sable pointant sur `main` au
  lieu du HEAD réel du rail — confirmé par lecture directe de `process.env`
  dans ce bac à sable, sans lien avec ce diff. Un troisième test varie à
  chaque exécution complète selon la charge (`test_fixtures_hors_depot_20260910.js`
  ou `test_cablage_incidents_ci_20261014.js`) et passe systématiquement seul
  en isolation.

## Reste hors de ce lot

La revue individuelle des 35 branches `A_REPRENDRE` (rapatriement ou
reclassement avec preuve, branche par branche) n'est pas faite ici — seul
leur classement l'est, conformément à `ACTION_NEXT`. Suppressions de
branches et fermetures de PR restent hors lot, sur gate humaine.
