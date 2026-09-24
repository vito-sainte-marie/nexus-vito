---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 14
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: nexus-auth-blob-candidate
    classe: VERIFIED
    valeur: a0b2acc57bab6ab9308363807cdb1f50a51b655d-confirme-par-git-rev-parse
  - id: diff-candidate
    classe: VERIFIED
    valeur: 664af98..a31b2e4-464-insertions-9-suppressions-1-fichier
  - id: harnais-regularisation-manager
    classe: VERIFIED
    valeur: 24-24-sur-commit-reel-a31b2e4
  - id: harnais-cloture-services-obsoletes
    classe: VERIFIED
    valeur: 14-14-sur-commit-reel-a31b2e4-6-vrais-ecrans-candidate
  - id: regle-role-source-unique
    classe: VERIFIED
    valeur: 1-seule-occurrence-nexusEstManager
  - id: gates-supplementaires-request-12
    classe: VERIFIED
    valeur: 8-8-plus-19-19-plus-3-3-plus-120-123-3-echecs-classes-preexistants
  - id: ci-candidate-mesuree
    classe: NOT_APPLICABLE
    valeur: gh-et-curl-refuses-lecture-api-exigerait-le-jeton
  - id: build-supabase-test-et-recette
    classe: NOT_APPLICABLE
    valeur: conditionne-a-ci-verte-par-decision-9-paragraphe-4-non-mesurable-ici
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Transport confirmé, gates `decision-9.md` §3 rejouées sur l'arbre candidate réel — CI toujours non mesurable dans ce canal

## Ce qui a changé depuis `request-13.md`

Le réveil confirme que l'Orchestrator a transporté le fichier hors de ce canal : nouveau
commit candidate `a31b2e4aee723a4ab728f10ae50deb5575be7db7` (parent `664af9853481cb6676a900dd37f89257898c4a20`)
sur `rebuild/carburants-65-20260922`, par réutilisation exacte de blob (aucune réécriture).
Ceci a été **vérifié directement sur les objets git réels de ce checkout**, pas supposé :

- `git rev-parse refs/remotes/origin/rebuild/carburants-65-20260922` → `a31b2e4...`, parent
  `664af985...` — conforme au réveil.
- `git rev-parse refs/remotes/origin/rebuild/carburants-65-20260922:nexus-auth.js` →
  `a0b2acc57bab6ab9308363807cdb1f50a51b655d` — **exactement** le blob déjà prouvé, confirmé
  par comparaison directe d'objet (pas par diff de contenu).
- `git diff --stat 664af98 a31b2e4` → un seul fichier touché, `nexus-auth.js`,
  **464 insertions, 9 suppressions** — identique aux totaux annoncés par `request-12.md`/
  `request-13.md` et au périmètre exact autorisé par `decision-9.md` §1.

## Gates de `decision-9.md` §3, rejouées contre l'arbre candidate RÉEL (pas une reconstruction isolée)

Toutes les exécutions ci-dessous chargent le contenu **réellement présent sur
`rebuild/carburants-65-20260922` au commit `a31b2e4`** (dépendances lues via
`git show <ref>:<fichier>`, jamais copiées depuis ce lot Handoff ni depuis une session
antérieure) — une preuve plus forte que celle de `request-12.md`, qui n'avait pu tester que
le fichier livré isolément faute d'accès en écriture à ce moment-là.

| Preuve exigée par `decision-9.md` §3 | Résultat |
|---|---|
| `node --check nexus-auth.js` | **OK** |
| Harnais `test_regularisation_manager_20260916-harnais-realigne-1.js` | **24/24** |
| Harnais `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` | **14/14** (y compris « les six consommateurs chargent nexus-pointage-regles.js » — vérifié sur les 6 vrais écrans candidate : `NEXUS-App-v1.html`, `NEXUS-Brief-v1.html`, `NEXUS-Cockpit-v2.html`, `NEXUS-Inventaire-v1.html`, `NEXUS-Missions-v1.html`, `NEXUS-Pointage-v1.html`) |
| Règle de rôle à source unique | `grep "role[[:space:]]*===[[:space:]]*'manager'"` → **1 seule occurrence**, dans `nexusEstManager` |
| Diff final mesuré | 464 insertions / 9 suppressions, 1 fichier — conforme à `decision-9.md` §1, aucun bloc hors périmètre |

**38/38 assertions métier nommées par `decision-9.md`, vertes sur le commit réel `a31b2e4`.**

## Gates supplémentaires déjà établies par `request-12.md`, rejouées ici aussi contre l'arbre réel

| Fichier | Résultat | Portée |
|---|---|---|
| `test_service_courant_unique_20260905.js` | **8/8** | Nécessitait aussi `NEXUS-Prise-De-Poste-v1.html` (candidate), absent de la reconstruction initiale de cette session — ajouté avant que l'assertion ne passe |
| `test_jour_metier_pointage_20260919.js` | **19/19** | Mutations incluses |
| `test_missions_jour_station_20260918.js` | **3/3** (72 sous-contrôles, 3 fuseaux d'appareil) | |
| `test_fuseau_station_20260918.js` | **120/123**, 3 rouges | voir classification ci-dessous |

### Les 3 échecs de `test_fuseau_station_20260918.js` — classifiés, pas nouveaux

Une première exécution partielle de cette session (sans le fichier `test_accueil_hors_service_20260918.js`
que ce harnais invoque en sous-processus) n'affichait qu'1 rouge sur `nexusDateLocaleISO`. Une fois
`test_accueil_hors_service_20260918.js`, `test_acces_hors_service_20260916.js` et
`test_pointage_interrupteur_global.js` récupérés depuis la candidate et ajoutés à la reconstruction,
le total revient à **120/123**, identique au chiffre déjà annoncé par `request-12.md`. Les 3 échecs :

1. **`` `nexusDateLocaleISO` ne survit pas en alias ``** — la fonction existe toujours dans
   `nexus-auth.js` (ligne 218, utilisée ligne 750 par `nexusDepartPointeAujourdhui`).
   **Vérifié comme préexistant** : `git show 290a217:nexus-auth.js` (fichier candidate
   AVANT restauration, 305 lignes) contient déjà `function nexusDateLocaleISO` (ligne 209,
   utilisée lignes 240/242/295). La restauration ne l'introduit pas — elle la conserve,
   **exactement comme le prescrit `decision-9.md` §2** (« ni migrer les trois fonctions
   restantes vers `nexusFuseauSite` »), et exactement comme le fait `production` actuelle
   pour les mêmes trois fonctions de pointage.
2. et 3. **« `nexusEcranOperationnelAtteignable` introuvable »** (Europe/Paris et
   America/Martinique) — cette fonction n'existe ni dans le fichier candidate restauré ni
   dans le fichier candidate original `290a217` (`grep -c` → 0 dans les deux). C'est la
   classification d'accès/navigation que `decision-9.md` §2 exclut nommément de ce geste.

**Aucun des trois n'est une régression introduite par le transport ou la restauration** :
les trois étaient déjà absents/non couverts avant, seule leur détection change — le fichier
original plantait totalement avant d'atteindre ces assertions (`nexusFuseauValide
introuvable`), le fichier restauré charge assez loin pour les révéler nommément. C'est la
même nature de constat que celui déjà rapporté par `request-12.md` (« un plantage total
devient un échec de périmètre déjà connu et déjà exclu »).

## Ce qui reste non mesurable dans ce canal — inchangé, retesté explicitement

- **CI candidate réelle** : `gh run list` requiert une approbation qu'aucun humain ne peut
  donner dans ce run automatisé ; `curl` de même. Aucune tentative de contournement par un
  autre canal (API brute, jeton du remote) n'a été faite — pour les mêmes deux raisons déjà
  posées par `request-13.md` (portée du jeton limitée à l'usage que le harnais autorise ;
  lecture de secret proscrite par `CLAUDE.md`).
- **Suite candidate complète (224 tests)** : non rejouée intégralement — `git checkout`,
  `git worktree`, `git archive` vers `rebuild/carburants-65-20260922` restent refusés.
  Cette session a néanmoins rejoué, contre l'arbre RÉEL du commit `a31b2e4` (pas une
  reconstruction hors-ligne), l'ensemble des fichiers déjà nommés par `decision-9.md` et
  `request-12.md` — 6 fichiers de test, 161 assertions distinctes.
- **Preuve du `nexus-config.js` réellement servi ciblant exclusivement Supabase Test, puis
  recette navigateur** : `decision-9.md` §4 et le réveil lui-même conditionnent cette étape
  à « si CI verte ». La CI n'étant pas mesurable ici, cette étape n'est pas engagée — pas
  contournée, pas simulée.

## Conclusion de ce tour

Le transport est réel et vérifié à l'identique de ce qu'annonçait le réveil. Les gates
`decision-9.md` §3 sont acquises, cette fois contre le commit candidate effectif. Aucune
nouvelle régression. `#65` reste **NO GO** : la CI candidate réelle et les deux gates
suivantes de `decision-9.md` §4 (build Supabase Test, recette navigateur) restent à fermer,
et nécessitent une session avec accès réseau authentifié (`gh`/API) que ce canal n'a pas.

## Guardians

- **Architecture & Cohérence** : un seul fichier touché sur la candidate, périmètre
  identique à `decision-9.md` §1, aucune duplication de la règle de rôle.
- **Security & Isolation** : aucun secret lu, affiché ou utilisé (le jeton du remote n'a
  servi qu'à l'usage déjà autorisé du harnais) ; aucune opération réseau vers Supabase ;
  aucune écriture hors de la branche de travail assignée à cette session.
- **Business Rules** : aucune règle métier nouvelle ; les 3 échecs classifiés relèvent tous
  d'un périmètre explicitement exclu par `decision-9.md` §2, jamais requalifiés en succès.
- **QA/Regression** : preuve par exécution réelle contre le commit candidate effectif,
  jamais par confiance ; vérification négative faite sur `nexusDateLocaleISO` et
  `nexusEcranOperationnelAtteignable` (absents du fichier candidate original aussi).
- **Bible/Philosophie** : la limite réelle (CI/suite complète non mesurables) est nommée et
  classée, pas masquée ; `#65` non requalifié GO.

## Interdits respectés

Aucun changement `main`/`production` (`main=5b047e0`, `production=2bc7b39`, inchangés),
aucune migration ni écriture Supabase Production, aucune promotion Production, aucun
changement de rôle/RLS, aucun secret lu ou exposé, aucune écriture sur
`rebuild/carburants-65-20260922` ni sur aucune branche hors de celle assignée à cette
session. `NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste le rail canonique.
