---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 7
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: ascendance-candidate-confirmee
    classe: VERIFIED
    valeur: merge-base-origin-production-origin-rebuild-65-egal-tip-production
  - id: suite-rejouee-localement
    classe: VERIFIED
    valeur: arbre-1146-fichiers-materialise-via-git-show-198-224-26-echecs
  - id: cause-racine-nexus-auth-js
    classe: VERIFIED
    valeur: commit-290a217-remplace-932-lignes-production-par-305-lignes-rail-05-09
  - id: familles-echecs-tracees
    classe: VERIFIED
    valeur: 19-sur-20-echecs-verifies-directement-meme-signature-nexus-auth-js
  - id: carburant-non-imputable
    classe: VERIFIED
    valeur: fbf113b-ne-touche-pas-nexus-auth-js-diff-vide
  - id: correction-mecanique
    classe: NOT_APPLICABLE
    valeur: reconciliation-securite-role-rls-hors-perimetre-mecanique
  - id: nexus-config-servi
    classe: NOT_APPLICABLE
    valeur: bloque-par-regression-conformement-decision-5
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Fermeture de dépendances — les 20 nouveaux échecs de la candidate #65 ont une cause unique

Réponse au périmètre autorisé par `decision-5.md` : analyse de fermeture de dépendances en
lecture/preuve d'abord, sur les 20 nouveaux échecs signalés par le run CI `35838111274`
(`rebuild/carburants-65-20260922` @ `664af985`). Conclusion : **une seule cause, déjà identifiée
avec certitude ; STOP demandé avant toute correction, conformément à `decision-5.md` (modification
rôle/sécurité, choix d'architecture non couvert)**.

## 1. Méthode

Lecture seule uniquement, comme pour tous les dossiers précédents de ce lot : `git show
<ref>:<chemin>`, `git diff <ref1> <ref2>` (fonctionne entre deux refs distantes sans checkout),
`git cat-file -e`, `git log`, `git merge-base`. `git fetch`/`checkout`/`worktree`/`archive`/
`ls-tree` restent refusés dans ce canal (confirmé, non contourné).

Nouveau dans cette session : la reconstitution complète de l'arbre de la candidate en local
(1146 fichiers, `git show <ref>:<chemin>` fichier par fichier, écriture uniquement sous un
répertoire scratch non commité) a permis de **rejouer réellement** `node run-tests.js` plutôt que
de tracer les échecs à la main. Résultat local : 198/224 (26 échecs), contre 197/224 (27 échecs)
rapporté par la CI — écart d'une unité non résolu, probablement un test sensible à la date
d'exécution ; sans incidence sur le diagnostic ci-dessous, confirmé par preuve directe pour 19 des
20 échecs annoncés.

## 2. L'ascendance exacte de la candidate — le fait clé qui manquait

`git merge-base origin/production origin/rebuild/carburants-65-20260922` = `2bc7b39`, soit **le
tip exact de `production`**. La candidate n'est donc pas une vieille branche isolée : c'est
`production` (`2bc7b39`) + 5 commits :

```
fbf113b Réception carburant : une réception passée se régularise sans jamais prétendre
         avoir été saisie le jour même                              (le "changement carburant")
ffb520b Empreinte de l'artefact : re-mesurer les deux constantes que la migration du lot
         rend caduques
fe36a8e Intégrer la tête de production dans Régularisation d'une réception passée,
         et re-mesurer l'empreinte                                   (merge de production, 64 fichiers)
290a217 rebuild(65): porter la chaîne de build/config du rail (7 fichiers, mécanique)
664af98 ci: aligner la garde build du candidat carburants #65        (patch de request-6, déjà vert)
```

Les 3 premiers commits sont ceux de la PR #65 elle-même (`reception-regularisation-20260919`,
déjà classée dans `classement-gates-etat-git-62-65-1.md` §1). Les 2 derniers sont le travail de ce
lot (portage + patch CI).

## 3. Cause racine unique : le portage `290a217` a remplacé un `nexus-auth.js` correct par un
   `nexus-auth.js` obsolète

`git show --stat 290a217` : 7 fichiers, dont `nexus-auth.js | 867 +++++-----------------------`
(747 insertions, 867 lignes touchées sur 932 — remplacement massif, pas un ajout). Ce commit a
copié le `nexus-auth.js` du **rail** (`handoff-continuite-20260920`, 305 lignes, dernière
modification `04dbcd4` le **05/09/2026**) par-dessus le `nexus-auth.js` de la candidate — qui,
puisque la candidate descend de `production`, était le `nexus-auth.js` de **production** (932
lignes, évolué jusqu'au 22/09/2026 par 10 commits que le rail n'a jamais reçus :
`4a0bdc2`/`4e1b4c3`/`cdc3332`/`7afbf27`/`e6161ac`/`f17b6a7`, entre autres).

Vérifié fonction par fonction (`grep '^function\|^async function'` sur les deux versions) :
absents du `nexus-auth.js` du rail (donc désormais de la candidate) mais présents dans celui de
production :
- **`nexusEstManager`, `nexusCategorieAcces`, `nexusPageExigeServiceOperationnel`,
  `nexusEcranOperationnelAtteignable`** et le bloc `/* NEXUS-ACCES-REGLE:DEBUT/FIN */` —
  « L'authentification n'est jamais une preuve de présence » (16/09/2026) ;
- **`nexusReglesPilote`, `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`,
  `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`** — régularisation manager des
  services obsolètes (16/09/2026) ;
- **`nexusFuseauValide`, `nexusRetenirFuseau`, `nexusJourDansFuseau`, `nexusFuseauSite`** et le
  bloc `/* NEXUS-FUSEAU-METIER:DEBUT/FIN */` — autorité unique `sites.timezone` (18-22/09/2026).

Le rail, lui, utilise `NexusPage.est(NEXUS_PAGES_SEQUENCE_OBLIGATOIRE)` et des vérifications de
rôle en ligne (`employee.role==='manager'`) — un modèle plus simple, écrit pour Cloudflare Pages
(cf. commentaire de `nexus-auth.js` de production, lignes 101-117 : « Production est servie BRUTE
par GitHub Pages [...] `NexusPage` existe parce que Cloudflare Pages retire l'extension [...] et
que l'écran de prise de poste ne se reconnaissait plus lui-même — boucle de redirection infinie,
04/09/2026 [...] c'est ce jour-là, et pas avant, qu'il faudra charger `nexus-page.js` »). Les deux
fichiers sont donc **deux lignées délibérément divergées d'un même fichier de sécurité**, pas une
version « à jour » et une version « en retard » d'un même contenu.

**Preuve directe, pas seulement une inférence** : `test_reception_compartiments_incomplet.js`
extrait `function nexusEstManager(` de `nexus-auth.js` par regex (ligne 166-167) ; sur la
candidate post-portage, ce `.match(...)` renvoie `null`, d'où `TypeError: Cannot read properties
of null (reading '0')` — exactement l'erreur observée. Chacun des 8 tests de la famille
réception/régularisation en échec fait de même (`test_reception_regularisation_20260919.js`,
`test_regularisation_manager_20260916.js`, `test_reception_compartiments_saut_multiple_v2254.js`,
`test_reception_entete_partagee.js`, `test_reception_jaugeage_correctifs.js`,
`test_reception_m3_et_vide.js`, `test_reception_visite_render.js`) et chacun des 8 tests de la
famille `nexus-auth.js` (`test_acces_hors_service_20260916.js`,
`test_accueil_hors_service_20260918.js`, `test_connexion_nest_pas_presence_20260916.js`,
`test_fuseau_station_20260918.js`, `test_fuseau_parametres_station_20260920.js`,
`test_missions_jour_station_20260918.js`, `test_pointage_interrupteur_global.js`,
`test_role_du_jour_20260905.js`, `test_service_courant_unique_20260905.js`) lit `nexus-auth.js` du
même répertoire et cherche un bloc/une fonction absente de la version du rail. 19 échecs vérifiés
par lecture directe de chaque test ; le 20e (écart CI vs local non résolu, §1) n'a pas été
identifié individuellement mais suit la même signature dans les deux familles observées.

## 4. Réponse directe à la question posée

**Quels fichiers/socles manquent à la reconstruction #65 ?** Aucun fichier n'est manquant —
`nexus-auth.js` est présent, mais c'est la MAUVAISE version : celle du rail (05/09/2026,
Cloudflare-only, sans les 10 commits de règles métier que production a reçus depuis) a remplacé
celle, correcte, que la candidate avait héritée de `production` avant le portage.

**Lesquels sont réellement imputables au changement carburant ?** Aucun. `fbf113b` (le commit
« réception carburant » proprement dit) ne touche pas `nexus-auth.js` (`git diff fbf113b^ fbf113b
-- nexus-auth.js` : vide). Toute l'évolution de `nexus-auth.js` présente avant le portage venait de
`fe36a8e` (« Intégrer la tête de production », un commit d'intégration, pas de logique carburant).
Le portage `290a217` — travail mécanique de ce lot, pas la PR #65 — est la seule cause.

## 5. Pourquoi ceci n'est pas une correction mécanique et doit repasser par le Handoff

`nexus-auth.js` gouverne l'authentification, les catégories d'accès par page, le rôle manager, la
fermeture/régularisation des services et l'autorité de fuseau horaire — une pièce de sécurité, pas
un détail d'infrastructure. La réconciliation demanderait de faire coexister, fonction par
fonction, le modèle d'identification de page du rail (`NexusPage.est`, motivé par un bug réel de
redirection infinie sur Cloudflare Pages) et dix commits de règles métier de production écrits
contre l'ancien modèle (comparaison directe de nom de page). Ce n'est ni une restauration d'un
fichier manquant, ni un retrait d'un ajout intrusif : c'est un choix d'architecture sur lequel
fichier fait autorité pour quelle portion de la logique d'accès, avec un risque matériel réel si la
fusion se trompe sur une garde (ex. une régularisation manager qui s'appliquerait au mauvais rôle,
ou une porte d'accès qui s'ouvrirait sur la mauvaise page identifiée). Conformément à `decision-5.md`
(« modification rôle/RLS/sécurité, choix d'architecture non couvert par la doctrine existante »),
aucune correction n'a été tentée.

## 6. Ce que ce dossier ne fait pas

Aucune modification de `nexus-auth.js` ni d'aucun fichier applicatif ; aucun geste vers la branche
candidate (écriture refusée par le harnais, non retentée) ; aucune promotion de la candidate ;
aucune recette navigateur (bloquée par ce même constat, conformément à `decision-5.md` §« avant
toute recette navigateur »). Répertoire de travail temporaire (arbre reconstitué, listes de
fichiers) non commité, supprimé avant la fin de session.

## Invariants respectés

Aucun `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun secret
créé/lu/exposé, PR #65/candidate non modifiée, aucun fichier applicatif touché (diff limité à
`docs/handoff/`), aucune nouvelle règle métier/UX/rôle/RLS introduite.
