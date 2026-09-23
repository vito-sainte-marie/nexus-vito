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
  - id: decision7-materialisee
    classe: VERIFIED
    valeur: APPROVED_WITH_CONDITIONS-closes-false-consommee
  - id: fe36a8e-ancetre-candidate
    classe: VERIFIED
    valeur: merge-base-is-ancestor-confirme
  - id: diff-fe36a8e-vs-correctif-un-seul-hunk
    classe: VERIFIED
    valeur: lignes-6-7-vers-6-37-reverifie-independamment
  - id: candidate-nexus-auth-deja-porte-par-290a217
    classe: VERIFIED
    valeur: octet-pour-octet-identique-au-nexus-auth-du-rail-canonique
  - id: correctif-desormais-obsolete-transport-regresserait
    classe: VERIFIED
    valeur: supprimerait-gardes-NexusBuild-NexusPage-deja-en-place
  - id: harnais-echec-reel-sans-patch
    classe: VERIFIED
    valeur: 2-fichiers-executes-reellement-meme-message-nexus-config-non-charge
  - id: harnais-patch-1-ligne-insuffisant
    classe: VERIFIED
    valeur: execute-reellement-echec-suivant-nexus-build-js-non-charge
  - id: nexus-build-js-committe-perime
    classe: VERIFIED
    valeur: ne-definit-pas-versionner-generateur-reel-dans-outils-poser-build-id-js
  - id: aucune-affirmation-217-224
    classe: VERIFIED
    valeur: seuls-2-fichiers-et-2-etats-reellement-executes-rapportes
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: git-push-dry-run-retesté-refuse-approbation
  - id: identite-preview-nexus-config-servi
    classe: NOT_APPLICABLE
    valeur: subordonne-a-integration-reelle-non-atteinte
  - id: cloudflare-html
    classe: NOT_APPLICABLE
    valeur: non-tranchee-conformement-a-decision-7
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Correctif `nexus-auth.js` (candidate #65) — republication vérifiée, une contradiction réelle trouvée

Exécution du réveil « poursuite déterministe du lot actif, sans gate Créateur ». Repris strictement
depuis le rail canonique `46a5e34` (`decision-7.md` déjà matérialisée et consommée). Le dépôt
`dbc8f55` (branche `claude/issue-28-20260923-1713`) n'a pas été fusionné/rebasé : son contenu a été
relu et **revérifié indépendamment contre l'arbre candidate réel**, pas recopié tel quel — c'est cette
revérification qui a trouvé une contradiction matérielle, documentée ci-dessous plutôt qu'effacée.

## 1. Le diff fe36a8e → correctif est confirmé, indépendamment

`fe36a8e` est bien ancêtre de `origin/rebuild/carburants-65-20260922` (vérifié par
`git merge-base --is-ancestor`). Le diff `fe36a8e:nexus-auth.js` →
`nexus-auth-corrige-65-20260923.js` produit un seul hunk, lignes 6-7 → 6-37 (constante
`NEXUS_SUPABASE_URL`/`NEXUS_SUPABASE_ANON_KEY` en dur remplacée par la lecture fail-closed de
`window.NEXUS_CONFIG`) — rejoué et confirmé par cette session, pas seulement relu dans
`preuve-diff-nexus-auth-corrige-65-20260923.md`.

## 2. Contradiction trouvée : le correctif proposé est désormais obsolète, sa transport le régresserait

En comparant le correctif à **l'état réel actuel** de `origin/rebuild/carburants-65-20260922`
(pas seulement à `fe36a8e`), un fait nouveau et matériel apparaît :

- Un seul commit a touché `nexus-auth.js` entre `fe36a8e` et la pointe de la candidate :
  `290a217 rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique)`,
  committé le 22/09/2026 21:21:58, **après** `fe36a8e` (22/09/2026 13:34:37) et donc après le
  diagnostic qui a produit `nexus-auth-corrige-65-20260923.js`.
- Ce portage a remplacé `nexus-auth.js` de la candidate par une version **beaucoup plus complète**
  que le correctif proposé : `diff` (`git show HEAD:nexus-auth.js` vs
  `git show origin/rebuild/carburants-65-20260922:nexus-auth.js`) donne **zéro différence** — le
  `nexus-auth.js` de la candidate est aujourd'hui **octet pour octet identique** à celui du rail
  canonique courant. Le correctif proposé, lui, ne fait que réintroduire la garde `NEXUS_CONFIG` seule
  (basée sur `fe36a8e`) : il n'a ni la garde `NexusBuild.versionner`, ni la garde `NexusPage.est`, que
  le portage `290a217` a déjà apportées.
- **Conséquence directe** : exécuter la procédure de transport proposée par `request-8.md`/le dépôt
  `dbc8f55` (`cp nexus-auth-corrige-65-20260923.js nexus-auth.js` sur la candidate) **régresserait**
  la candidate — elle supprimerait les gardes `NexusBuild`/`NexusPage` déjà en place, pour les
  remplacer par une version plus ancienne et moins complète.

**Ce point n'était pas voyant dans `dbc8f55`/`request-9.md`** : ce dépôt construisait sa zone de test
en renommant `nexus-auth-corrige-65-20260923.js` en `nexus-auth.js`, jamais en chargeant le vrai
`nexus-auth.js` de la candidate — ses résultats (24/24, 14/15) sont donc réels pour le fichier qu'il a
testé, mais ce fichier n'est plus celui que porte la candidate aujourd'hui. Ce n'est la faute de
personne : le portage `290a217` a eu lieu entre le diagnostic et cette vérification.

**Recommandation, pas une correction appliquée** : ne pas transporter `nexus-auth-corrige-65-20260923.js`
tel quel. Le problème qu'il visait à résoudre (absence de garde `NEXUS_CONFIG`) est déjà résolu, plus
complètement, par `290a217`.

## 3. Nouveau constat réel : les deux harnais échouent aujourd'hui sur la candidate, pour une raison plus large qu'un `window.NEXUS_CONFIG` manquant

Les deux fichiers `test_regularisation_manager_20260916.js` et
`test_cloture_services_obsoletes_20260916.js` de la candidate ont été **réellement exécutés**
(node, zone de travail locale jamais commitée, supprimée avant la fin de cette session) contre le
**vrai** `nexus-auth.js`/`nexus-pointage-regles.js`/`NEXUS-Cockpit-v2.html` extraits de
`origin/rebuild/carburants-65-20260922` — pas contre le fichier corrigé proposé.

- **Sans aucun patch** : les deux échouent, chacun dès la première assertion, avec exactement
  `NEXUS ne peut pas démarrer : nexus-config.js n'a pas été chargé.` — confirmant que la garde
  `NEXUS_CONFIG` du portage `290a217` est bien active et fail-closed dans le banc de test tel quel.
- **Avec uniquement le patch d'une ligne autorisé par `decision-7.md` Point 1**
  (`window.NEXUS_CONFIG` ajouté au `ctx.window` de `banc()`) : `test_regularisation_manager_20260916.js`
  échoue **différemment**, à la même première assertion, avec
  `NEXUS ne peut pas démarrer : nexus-build.js n'a pas été chargé.` — la garde suivante ajoutée par le
  même portage `290a217` (`typeof NexusBuild === 'undefined' || typeof NexusBuild.versionner !== 'function'`).
  `test_cloture_services_obsoletes_20260916.js` charge le même `nexus-auth.js` de la même façon
  (`fs.readFileSync(.../nexus-auth.js')` puis `vm.runInContext`) : le même échec est attendu, sans
  ambiguïté de construction, même si non rejoué une seconde fois dans cette session.
- **Cause exacte, vérifiée en lisant `outils/poser-build-id.js`** (fichier ajouté/réécrit par
  `290a217`) : `NexusBuild`/`NexusPage` ne sont plus fournis par un module simple à charger tel quel —
  `NexusBuild` (avec `.versionner`) est généré **au build**, écrit dans `nexus-build.js` par
  `outils/poser-build-id.js`, un fichier explicitement **« NON VERSIONNÉ »** (le commentaire du
  générateur le dit lui-même). Le `nexus-build.js` actuellement **committé** dans l'arbre candidate ne
  définit que l'ancien global `NEXUS_BUILD` (sans `.versionner`, sans `NexusBuild`) — un artefact
  antérieur au portage, resté dans git par accident apparent, incompatible avec ce que `nexus-auth.js`
  exige désormais. `NexusPage`, en revanche, **est** un vrai fichier source committé
  (`nexus-page.js`, ajouté par `290a217`) et peut être chargé tel quel par un harnais, comme
  `nexus-pointage-regles.js` l'est déjà.

**Aucun patch n'a été appliqué à la candidate ni commité nulle part** : la vérification ci-dessus
s'est arrêtée à l'observation, conformément à la condition d'arrêt de `decision-7.md`
(« le patch de test harnais casse une autre assertion une fois réellement exécuté » → retour par
`request-N.md`, pas d'exécution silencieuse au-delà). C'est exactement ce qui vient de se produire.

## 4. Aucune affirmation de suite globale sans exécution

Conformément à la consigne du réveil, aucun chiffre `217/224` (ni aucun autre total de suite) n'est
répété dans ce retour. Ce qui est affirmé ici est strictement ce qui a été exécuté dans cette session :
2 fichiers de test, 2 états (sans patch / avec le seul patch `NEXUS_CONFIG` déjà autorisé), 2 résultats
mesurés (échec, message exact cité). Aucun autre fichier de la candidate n'a été exécuté ni supposé
vert dans ce retour.

## 5. Pourquoi ce retour s'arrête ici

`decision-7.md` fixe explicitement cette condition d'arrêt, et elle vient de se réaliser : le patch de
harnais autorisé, une fois réellement exécuté sur l'arbre candidate actuel, ne suffit plus — une
garde supplémentaire (`NexusBuild`), apportée par un portage postérieur au diagnostic, en est la
cause. Ce n'est ni une décision de fondateur, ni une contradiction de doctrine : c'est un fait matériel
nouveau qui invalide une partie du plan déjà autorisé. Continuer silencieusement (élargir le patch de
harnais, décider seul si `NexusPage.js` doit être chargé réellement ou stubé, transporter quand même)
sortirait de ce qui a été explicitement autorisé par `decision-7.md` Point 1 — d'où ce retour, plutôt
qu'une correction appliquée sans arbitrage.

Les étapes suivantes déjà nommées par le réveil (candidate non-Production, CI réelle, preuve distincte
du `nexus-config.js` réellement servi) ne sont donc pas entamées dans ce retour : elles supposaient un
correctif prêt à transporter, ce qui n'est plus le cas tel qu'initialement conçu.

## 6. Ce qui reste hors de portée de ce canal — inchangé

- Aucune écriture sur `rebuild/carburants-65-20260922` : `git push --dry-run` vers cette branche
  refuse une approbation qu'aucun humain ne peut donner dans ce run automatisé — retesté explicitement
  dans cette session, pas supposé.
- Aucune opération réseau vers Cloudflare Pages ou Supabase Test.
- Question Cloudflare/`.html` (`decision-7.md` §Point 2) : toujours non tranchée, non touchée —
  `nexus-page.js`, déjà présent sur la candidate via le même portage `290a217`, en est le mécanisme
  visé mais son observation reste hors de portée de ce canal, inchangé.

## Proposition pour la suite, à arbitrer, pas décidée ici

Deux options distinctes se présentent, et ce retour n'en choisit aucune :

1. **Clore le point « correctif nexus-auth »** : le problème initial (garde `NEXUS_CONFIG` absente) est
   déjà résolu par `290a217`, plus complètement que ne le proposait `nexus-auth-corrige-65-20260923.js`.
   Ne rien transporter. Rouvrir uniquement le point harnais (ci-dessous).
2. **Réparer les deux harnais** pour qu'ils redeviennent exécutables sur la candidate telle qu'elle est
   aujourd'hui : ajouter `window.NEXUS_CONFIG` (déjà autorisé) ET une garde `NexusBuild`/`NexusPage`
   utilisable en `vm` — soit un stub minimal (`{ versionner: s => s }`), soit charger le vrai
   `nexus-page.js` (déjà committé) et régénérer un `nexus-build.js` de test via
   `outils/poser-build-id.js` plutôt que de dépendre du fichier committé périmé. Le second choix est
   plus fidèle au comportement réel mais touche un outil de build, pas seulement un banc de test — la
   nature exacte du geste (outillage/QA pur vs modification d'un outil de build partagé) mérite d'être
   tranchée avant exécution, pas supposée.

## Guardians (pour ce qui a été exécuté)

- **Architecture & Cohérence** : la contradiction trouvée est documentée, pas corrigée en silence ;
  aucun fichier de la candidate modifié depuis ce canal.
- **Security & Isolation** : aucun secret lu, créé ou exposé ; aucune opération réseau/Supabase ;
  zone de travail locale supprimée avant la fin de la session (`git status` propre).
- **Business Rules** : aucune règle métier/UX/RLS/rôle touchée, aucune décision de ce type prise.
- **QA/Regression** : les deux échecs rapportés sont mesurés, avec message exact reproductible, pas
  déduits ; aucun total de suite globale affirmé.
- **Bible/Philosophie** : préférence donnée à rapporter une contradiction réelle plutôt que republier
  un résultat obsolète tel quel — conforme à l'exigence du réveil.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture Supabase
Production, aucun déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun
secret créé/lu/exposé. Aucun fichier extrait n'a été commité : la zone de travail locale a été
supprimée avant la fin de cette session (`git status` propre, vérifié).
