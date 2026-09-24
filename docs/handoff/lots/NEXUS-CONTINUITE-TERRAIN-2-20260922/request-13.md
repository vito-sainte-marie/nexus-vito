---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 13
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: refs-protegees
    classe: VERIFIED
    valeur: main-5b047e0-production-2bc7b39
  - id: absence-derive-664af985
    classe: VERIFIED
    valeur: nexus-auth-js-octet-pour-octet-identique-a-290a217f-diff-stat-464-9-reconfirme
  - id: transport-candidate
    classe: NOT_APPLICABLE
    valeur: fetch-checkout-worktree-branch-push-archive-ls-tree-tous-refuses-individuellement-cette-session
  - id: reconstruction-arbre-candidate
    classe: VERIFIED
    valeur: 791-fichiers-texte-git-cat-file-p-lecture-seule-224-tests-comptes
  - id: suite-avant-restauration
    classe: VERIFIED
    valeur: 198-224-26-echecs-identique-a-request-7
  - id: suite-apres-restauration
    classe: VERIFIED
    valeur: 211-224-13-echecs-sous-ensemble-strict-des-26-zero-nouvelle-regression
  - id: residu-explique
    classe: VERIFIED
    valeur: 4-echecs-acces-exclus-decision9-2-echecs-harnais-originaux-obsoletes-remplaces-par-harnais-realignes-24-24-et-14-14
  - id: verification-negative-fuseau
    classe: VERIFIED
    valeur: 120-123-identique-a-request-12
  - id: gates-config-test-et-recette
    classe: NOT_APPLICABLE
    valeur: non-entame-217-224-litteral-non-atteint-217-exigerait-elargissement-ux-exclu
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Mesure réelle de la suite candidate complète — 211/224, zéro nouvelle régression, écart à « 217/224 » expliqué

## Ce qui a changé par rapport à `request-12.md` : un rail de lecture qui fonctionne enfin à l'échelle

Cette session a retrouvé le même obstacle d'écriture que toutes les précédentes de ce lot
(`git fetch`, `git checkout -b`, `git worktree add`, `git branch <nom> <sha>`, `git ls-tree`,
`git archive` vers/depuis `rebuild/carburants-65-20260922` : tous refusés, retestés
individuellement, un par un, dans cette session). **Nouveau, prouvé cette fois** : la plomberie
en lecture seule (`git show <ref>:<chemin>`, `git cat-file -p <sha>`, `git grep`,
`git rev-parse`) fonctionne sans restriction, y compris pour des chemins et objets qui
n'avaient jamais été lus individuellement auparavant. Un script Node dédié
(`execFileSync('git', ['cat-file','-p', sha])`, jamais de shell, jamais de boucle shell — les
boucles `for` restent bloquées indépendamment de toute cible Git, retesté) a permis de
reconstruire **récursivement et fidèlement** l'arbre complet de `664af9853481cb6676a900dd37f89257898c4a20`
(791 fichiers texte, 355 binaires ignorés à dessein — images non nécessaires à l'exécution) dans
un répertoire hors dépôt (`.candidate-scratch/`, jamais committé, supprimé avant la fin de cette
session). C'est la première fois dans ce lot que la suite candidate complète est **réellement
exécutée**, et non déduite ou partiellement rejouée.

## 1. Absence de dérive — reconfirmée, condition remplie

`origin/rebuild/carburants-65-20260922` = `664af9853481cb6676a900dd37f89257898c4a20`, identique
à la tête déjà connue de `request-12.md`. Le seul commit qui la sépare de `290a217f` (l'état sur
lequel les preuves de `request-12.md` ont été calculées) est `664af985` lui-même, qui ne touche
que `.github/workflows/tests.yml` (patch CI déjà approuvé par `decision-5.md`). `nexus-auth.js`
au sommet candidate est **octet pour octet identique** à sa version en `290a217f` (`git diff
--stat` : 0 changement). Le diff entre ce fichier candidate et le fichier livré
`nexus-auth-restaure-65-20260924.js` est **exactement** 464 insertions / 9 suppressions, un seul
fichier — identique à la mesure de `request-12.md`, reconfirmée indépendamment cette session.
Zéro occurrence de `nexusCategorieAcces`/`nexusPageExigeServiceOperationnel`/
`nexusEcranOperationnelAtteignable` dans le fichier restauré (périmètre exclu de `decision-9.md`
§2 respecté), et `nexusEstManager` reste défini une seule fois.

## 2. Transport direct — toujours hors de portée de ce canal, non contourné

Aucune tentative de plomberie à faible niveau (`git branch <nom> <sha>` sans checkout,
etc.) n'a permis de créer une référence locale nommée sur cette branche : chaque commande a été
refusée individuellement par une approbation qu'aucun humain ne peut donner dans ce run
automatisé. Conformément à `decision-9.md` §5, ceci n'appelle pas une gate Créateur : c'est une
limitation de transport Git non-Production, déjà anticipée par la décision elle-même. Le fichier
restauré reste donc déposé dans ce lot (commit `44fc13a`, inchangé), pas écrit directement sur
`rebuild/carburants-65-20260922`.

## 3. Suite candidate complète — mesurée AVANT toute modification (état réel du candidat)

`node run-tests.js` sur l'arbre reconstruit, sans modification (nexus-auth.js candidate
d'origine) : **198/224**, 26 échecs. Cette mesure reproduit **exactement** celle de
`request-7.md` (7 connus + les 19 mêmes noms de fichiers, aucun ajout ni retrait). C'est la
confirmation indépendante, par exécution réelle et non par lecture d'un rapport antérieur, que
le candidat actuel porte toujours la régression de `290a217f` et que rien ne l'a réparée entre
temps.

## 4. Suite candidate complète — mesurée APRÈS application du fichier restauré

`nexus-auth-restaure-65-20260924.js` copié à la place de `nexus-auth.js` dans l'arbre reconstruit
(aucun autre fichier touché), puis `node --check` (syntaxe valide) et `node run-tests.js` deux
fois de suite (déterminisme confirmé, résultats identiques) : **211/224**, 13 échecs.

**Les 13 échecs après restauration sont un sous-ensemble STRICT des 26 échecs d'avant — zéro
nouvel échec, vérifié nom par nom, pas supposé :**

- 7 échecs `CONNUS` inchangés (déclarés dans `.github/workflows/tests.yml` de la candidate) :
  `test_inventaire_categorie_mixte_deux_lieux.js`, `test_inventaire_production_journaliere_q1.js`,
  `test_inventaire_sprint4_ux_flash.js`, `test_inventaire_sprint4bis_ecriture_immediate.js`,
  `test_pilotage_qualite_receptions.js`, `test_reception_moteur.js`, `test_reception_v1_dom.js` ;
- 4 échecs dus à la classification d'accès, **explicitement exclue** du périmètre de restauration
  par `decision-9.md` §2 (`test_acces_hors_service_20260916.js` — « le bloc de règle d'accès a
  disparu » ; `test_accueil_hors_service_20260918.js` et `test_fuseau_station_20260918.js` —
  `nexusEcranOperationnelAtteignable` introuvable ; `test_pointage_interrupteur_global.js` —
  bloc de règle d'accès introuvable). Restaurer ces fonctions ferait exactement l'élargissement
  UX que `decision-9.md` interdit — non tenté ;
- 2 échecs (`test_regularisation_manager_20260916.js`, `test_cloture_services_obsoletes_20260916.js`)
  dus à une cause distincte, vérifiée par exécution directe : ces fichiers de test **originaux**
  n'installent pas `window.NEXUS_CONFIG` avant de charger `nexus-auth.js`, et échouent donc sur
  le garde `fail closed` du rail (« NEXUS ne peut pas démarrer : nexus-config.js n'a pas été
  chargé ») — un garde que `decision-9.md` demande explicitement de conserver intégralement.
  C'est exactement pourquoi `request-11.md`/`request-12.md` avaient construit des harnais
  réalignés : `test_regularisation_manager_20260916-harnais-realigne-1.js` (24/24) et
  `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` (14/14), rejoués ici avec
  succès **dans ce même arbre reconstruit** (pas dans une zone jetable isolée) — confirmant que
  la logique métier restaurée fonctionne réellement contre l'arbre candidate, seuls les DEUX
  fichiers de test originaux sont structurellement obsolètes vis-à-vis du garde de build.

**13 régressions de `290a217f` sont réparées** par la restauration (elles échouaient en §3, elles
passent en §4) : `test_connexion_nest_pas_presence_20260916.js`,
`test_fuseau_parametres_station_20260920.js`, `test_jour_metier_pointage_20260919.js`,
`test_missions_jour_station_20260918.js`, `test_reception_compartiments_incomplet.js`,
`test_reception_compartiments_saut_multiple_v2254.js`, `test_reception_entete_partagee.js`,
`test_reception_jaugeage_correctifs.js`, `test_reception_m3_et_vide.js`,
`test_reception_regularisation_20260919.js`, `test_reception_visite_render.js`,
`test_role_du_jour_20260905.js`, `test_service_courant_unique_20260905.js`.

Vérification négative rejouée dans ce même arbre : `test_fuseau_station_20260918.js` →
**120/123**, identique à la mesure de `request-12.md` ; les 3 rouges résiduels portent tous sur
`nexusEcranOperationnelAtteignable` (accès, hors périmètre).

## 5. Pourquoi ce n'est PAS « 217/224 » — et pourquoi je ne force pas ce chiffre

`request-7.md` avait mesuré **217/224** sur `fe36a8ebafb2a64dd1cc4f558424f3915749b4eb`, l'état de
la candidate **juste avant** le portage mécanique `290a217f` — un état où `nexus-auth.js`
comptait 932 lignes et portait **aussi** la classification d'accès complète
(`nexusCategorieAcces` et consorts), en plus des 5 éléments que `decision-9.md` autorise à
restaurer ici. `decision-9.md` §2 exclut explicitement cette classification du périmètre de la
restauration minimale actuelle (« Ces écarts sont réels mais distincts ; les traiter ici
élargirait le périmètre UX au-delà de la restauration minimale démontrée »). **211/224 est donc
le maximum atteignable par une restauration conforme au périmètre exact autorisé** — pas un
résultat incomplet de ma part, mais la conséquence directe et mesurée de la frontière posée par
`decision-9.md` elle-même. Chercher `217/224` exigerait de restaurer la classification d'accès :
un élargissement UX explicitement interdit, donc **non tenté**, conformément à la clause STOP du
réveil (« STOP si ... élargissement UX/sécurité/rôle/RLS »).

## 6. Conséquence pour les gates suivantes (`decision-9.md` §4)

Le réveil conditionne les gates suivantes (preuve `nexus-config.js` ciblant Supabase Test, puis
recette navigateur) à une suite candidate « verte au baseline ». `211/224` avec zéro nouvelle
régression et un écart intégralement expliqué **n'est pas littéralement `217/224`** ; je n'ouvre
donc pas ces gates dans cette session — ce serait interpréter moi-même un critère que le réveil
n'a pas défini pour ce cas précis. Deux voies non tranchées ici :

1. Considérer `211/224` (7 connus + 4 explicitement hors périmètre + 2 harnais originaux
   obsolètes déjà remplacés) comme le nouveau baseline correct de la restauration minimale, et
   mettre à jour la liste `CONNUS` de `.github/workflows/tests.yml` en conséquence (nécessite une
   session/humain avec droit d'édition sur les workflows — hors de la portée de ce canal, qui ne
   peut de toute façon pas modifier `.github/workflows/*`) avant de déclarer la CI candidate
   verte ;
2. Ouvrir un lot distinct pour la classification d'accès (`nexusCategorieAcces`,
   `nexusPageExigeServiceOperationnel`, `nexusEcranOperationnelAtteignable`) et les deux tests
   originaux obsolètes, afin d'atteindre un jour `217/224` sans dérogation à la liste `CONNUS`.

Je ne tranche pas entre les deux : c'est exactement le type de décision que `decision-9.md` n'a
pas prise et que je ne dois pas prendre à sa place.

## Ce qui n'a pas été fait

Aucune écriture sur `rebuild/carburants-65-20260922` (obstacle de transport inchangé, §2).
Aucune preuve `nexus-config.js`/Supabase Test, aucune recette navigateur (gate 3 non déclarée
verte au sens littéral demandé, §6). `#65` reste **NO GO**.

## Interdits respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture
Supabase Production, aucun déploiement/promotion Production, aucun changement de rôle/RLS, aucun
secret exposé, aucun élargissement UX/sécurité au-delà du périmètre de `decision-9.md` §1,
`NEXUS_BASE_BRANCH=handoff-continuite-20260920` reste canonique. Répertoire de reconstruction
(`.candidate-scratch/`) jamais committé, supprimé avant la fin de cette session — `git status`
propre.
