---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 16
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: ci-logs-accessibles
    classe: VERIFIED
    valeur: GH_TOKEN-fonctionnel-job-logs-recuperes-premiere-fois-du-fil
  - id: classement-12-echecs
    classe: VERIFIED
    valeur: 7-connus-ECHECS-CONNUS-json-4-classification-acces-1-non-reproduit-isole
  - id: rail-jamais-eu-classification-acces
    classe: VERIFIED
    valeur: confirme-avant-290a217-nexusEcranOperationnelAtteignable-absent-du-rail
  - id: gravite-isole-31-31
    classe: VERIFIED
    valeur: reexecute-avec-3-dependances-exactes-de-1ba8b88-aucun-echec
  - id: harnais-38-38
    classe: VERIFIED
    valeur: deja-verifie-request-15-inchange
  - id: recette-navigateur-authentifiee
    classe: NOT_APPLICABLE
    valeur: aucun-secret-pin-test-disponible-dans-ce-canal-inchange-depuis-06-09
  - id: nouveau-lot-non-ouvert
    classe: VERIFIED
    valeur: verrou-lot-unique-outils-handoff-js-481-verifie-avant-tentative
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Détail CI complet obtenu pour la première fois : les 12 échecs de la suite candidate classés, zéro régression imputable au périmètre propre de #65

## 1. Capacité nouvelle de ce canal — logs de job CI accessibles

Toutes les sessions précédentes de ce fil (`request-6` à `request-15`) ont buté sur
`GET .../actions/jobs/<id>/logs` → `403 — Must have admin rights to Repository`, y compris via
l'API REST publique non authentifiée. Cette session dispose d'un `GH_TOKEN` fonctionnel
(`gh auth`/`git push` restent refusés comme avant — seule l'API REST authentifiée en lecture a été
essayée). Requête `GET /repos/.../commits/1ba8b88.../check-runs` → `200`, puis
`GET /repos/.../actions/jobs/107618732366` (job `non-regression`, run `35995316868`) → `200` avec
le détail des étapes, puis `GET .../logs` → redirection `302` suivie vers le stockage de blobs,
contenu réel récupéré (17958 octets). Aucun jeton, secret ou PIN n'a été affiché ni journalisé ;
seul le contenu du log CI (déjà public dans son principe, juste inaccessible depuis ce canal
jusqu'ici) a été lu.

## 2. Le détail exact, enfin lisible

Étape « Suite de non-régression » : **212/224 tests passent, 12 en échec**. Étape suivante
« Comparer aux échecs connus » (liste `CONNUS` figée dans le workflow de la branche candidate,
7 entrées) : **5 échecs classés « Nouveaux »**, distincts des 7 déjà connus.

## 3. Classement des 12 échecs — chacun vérifié, aucun laissé à la spéculation

**7 déjà connus, dette QA préexistante du rail (`docs/qa/ECHECS-CONNUS.json`, mesurée le
09/09/2026, source unique lue par `run-tests.js`)** : `test_inventaire_categorie_mixte_deux_lieux.js`,
`test_inventaire_production_journaliere_q1.js`, `test_inventaire_sprint4_ux_flash.js`,
`test_inventaire_sprint4bis_ecriture_immediate.js`, `test_pilotage_qualite_receptions.js`,
`test_reception_moteur.js`, `test_reception_v1_dom.js`. Chacun porte dans ce registre une cause
nommée sans rapport avec `nexus-auth.js` (fonctions extraites manquantes, simulacre DOM incomplet,
API de module refondue) — aucun défaut applicatif, déjà classé avant ce lot.

**4 tracés à la classification d'accès/navigation, gap réel mais déjà nommé et explicitement
exclu de la restauration minimale par `decision-9.md` §2** : `test_acces_hors_service_20260916.js`
(« le bloc de règle d'accès a disparu de nexus-auth.js »), `test_accueil_hors_service_20260918.js`
et `test_fuseau_station_20260918.js` (« function nexusEcranOperationnelAtteignable( introuvable »),
`test_pointage_interrupteur_global.js` (même bloc). Vérifié par lecture directe, pas supposé :
- `1ba8b88:nexus-auth.js` (le candidate réel évalué par ce CI) ne contient ni
  `nexusEcranOperationnelAtteignable`, ni `nexusCategorieAcces`, ni `NEXUS_PAGES_OPERATIONNELLES` —
  cohérent avec le périmètre explicitement exclu par `decision-9.md` §2.
- `origin/production:nexus-auth.js` contient les trois — Production a cette classification.
- `origin/handoff-continuite-20260920:nexus-auth.js` (le rail, **avant tout portage #65**) ne
  contient AUCUNE des trois — le rail ne l'a jamais eue. Ce n'est donc pas #65 qui a détruit cette
  classification : le rail portait déjà ce manque avant le portage `290a217`.
- Les quatre fichiers de test eux-mêmes : 4 absents purement et simplement du rail
  (`git cat-file -e origin/handoff-continuite-20260920:<fichier>` échoue pour 3 d'entre eux ;
  `test_pointage_interrupteur_global.js` existe sur le rail mais avec un **contenu différent** de
  celui du candidat — diff de 83 lignes — sa version rail **passe** contre le rail actuel
  (`node run-tests.js pointage_interrupteur` → 1/1), c'est la version **Production** héritée par
  #65 qui exige le bloc `NEXUS-ACCES-REGLE` absent du candidat).
- Ce gap est déjà nommé par `request-11.md` §4/§6 (« développée sur `acces-hors-service-20260916` »,
  « réel mais distinct », « nommé pour arbitrage séparé, pas résolu par ce lot ») — cette session
  n'invente rien, elle confirme avec la preuve CI qui manquait jusqu'ici que ce gap nommé est
  exactement, et seulement, la cause de ces 4 échecs.

**1 réexécuté isolément avec ses dépendances exactes du candidat — passe intégralement, cause
réelle non reproduite** : `test_gravite_ecart_source_unique_20260916.js` (rapporté « sortie non
nulle »). Absent du rail lui-même (vérifié). Extrait (`git show 1ba8b88:<fichier>`) avec ses trois
dépendances exactes (`NEXUS-Mon-Evolution-v1.html`, `nexus-verify-moteur.js`,
`NEXUS-Verify-v1.html`) dans une zone de travail jetable de ce checkout (jamais commitée, supprimée
avant la fin de cette session, `git status` vérifié propre après) : exécution réelle,
**31 réussite(s), 0 échec(s)**. Ce fichier ne touche ni `nexus-auth.js` ni aucun des deux fichiers
portés par le transport `1ba8b88` (`test_regularisation_manager_20260916.js`,
`test_cloture_services_obsoletes_20260916.js`). Sa cause d'échec dans la suite complète (probable
effet de bord de la parallélisation à 4, ou interaction avec un autre fichier absent de cette
reproduction minimale) **n'est pas confirmée** — rejouer la suite complète de 224 fichiers reste
hors de portée de ce canal (obstacle reconfirmé identique à `request-14.md`/`request-15.md` :
`git checkout <ref> --`, `git worktree`, boucles Bash sont refusés). Mais structurellement, ce
fichier n'a aucun lien avec le périmètre `#65`.

## 4. Conclusion sur l'attribution

**Zéro des 12 échecs n'est une régression nouvelle ou inexpliquée imputable au périmètre propre de
`#65`** — c'est-à-dire aux deux harnais réalignés transportés par `1ba8b88`
(`test_regularisation_manager_20260916.js`, `test_cloture_services_obsoletes_20260916.js`, 38/38
vérifiés par `request-15.md`) et à la restauration minimale autorisée par `decision-9.md` §1
(`nexusEstManager`, autorité de fuseau, cycle pilote, `nexusServiceCourant`). Chaque échec restant
retombe dans l'une de trois catégories déjà nommées et sourcées : dette QA préexistante du rail
(§3a), gap de classification d'accès déjà exclu du périmètre par `decision-9.md` §2 (§3b), ou
anomalie non reproduite isolément sans lien structurel avec `#65` (§3c).

## 5. Ce que cette session NE fait PAS

Ne requalifie aucune décision existante. Ne modifie aucun fichier de la branche candidate ni du
rail (zone de travail jetable supprimée avant la fin, diff nul sur ce dépôt). N'ouvre aucun nouveau
lot Handoff (le registre refuse `demande` sur un `lot_id` distinct tant que ce lot reste en statut
actif — vérifié dans `outils/handoff.js:481` avant d'essayer). Ne déclare pas `#65` `GO` ni même
`CI candidate verte` au sens strict de `decision-9.md` §4 — le job `non-regression` reste
littéralement rouge sur `1ba8b88`, et `decision-10.md` (brouillon non canonique, jamais consommé,
retenu ici seulement comme trace de doctrine cohérente) avertit explicitement de ne pas
« requalifier une CI rouge comme acceptable au seul motif que l'échec préexistait ». Cette session
pose la question d'arbitrage plutôt que d'y répondre elle-même.

## 6. Proposition — lot racine distinct pour la dette de classification d'accès

Déposée séparément : `proposition-lot-classification-acces-rail-1.md`, dans ce même répertoire.
Décrit le périmètre exact (porter `NEXUS_PAGES_CONSULTATION`/`OPERATIONNELLES`/`PUBLIQUES`,
`nexusCategorieAcces`, `nexusPageExigeServiceOperationnel`, `nexusEcranOperationnelAtteignable`
depuis Production vers le rail, et la migration couplée des trois fonctions résiduelles vers
`nexusFuseauSite`), avec ses cinquante écrans concernés et son changement de navigation/
redirection — **non ouvert dans ce lot**, une proposition écrite pour que le prochain arbitrage
puisse l'ouvrir en connaissance de cause, sans qu'un geste supplémentaire de reconstruction soit
nécessaire.

## 7. Gate qui reste hors de portée de ce canal, inchangée

`decision-9.md` §4 exige aussi la recette navigateur authentifiée avant tout GO. Comme dans
**toutes** les sessions de ce fil depuis le 06/09/2026 : `NEXUS_TEST_MANAGER_PIN`,
`NEXUS_TEST_CREATEUR_PIN`, `NEXUS_TEST_EMPLOYEE_A_PIN`, `NEXUS_TEST_EMPLOYEE_B_PIN`,
`NEXUS_TEST_PIN` sont tous absents de ce canal (vérifié par test booléen de présence, jamais de
lecture de valeur). C'est le blocage réel, structurel et non résoluble depuis ce canal : `#65` ne
peut donc pas être déclaré fermable pour un GO dans cette session, quelle que soit l'issue de
l'arbitrage sur l'attribution CI ci-dessus.

## 8. Question d'arbitrage posée

1. Le classement des 12 échecs ci-dessus est-il retenu comme « aucune régression imputable au
   périmètre propre de `#65` » au sens de `decision-9.md` §4 ?
2. Si oui, la boucle de vérification harnais/candidate de ce lot peut-elle être considérée close
   sur ce point précis (sans que cela vaille `GO` Production, qui reste soumis à la recette
   navigateur du §7 et aux autres gates de `decision-9.md`/`classement-gates-etat-git-62-65-1.md`),
   avec ouverture séquencée d'un lot racine distinct pour la dette de classification d'accès une
   fois ce lot refermé ?
3. La recette navigateur authentifiée demeure-t-elle le seul geste restant avant tout GO, réservé
   à une session disposant des secrets Test ?

## Interdits respectés

Aucun changement `main`/`production`, aucune migration ni écriture Supabase, aucune promotion
Production, aucun secret lu ou exposé, aucune nouvelle règle métier/UX/rôle/RLS, aucun test masqué
ou neutralisé (le fichier `test_gravite_ecart_source_unique_20260916.js` reste rouge dans la CI
candidate telle qu'elle est ; cette session documente une reproduction isolée qui passe, elle ne
modifie ni le fichier ni son statut CI), aucune écriture sur `rebuild/carburants-65-20260922` ni
sur aucune branche hors de celle assignée à cette session. `NEXUS_BASE_BRANCH=handoff-continuite-20260920`
reste le rail canonique.
