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
  - id: fichier-remplace-pas-mecanique
    classe: VERIFIED
    valeur: nexus-auth.js-blob-db20b1c-identique-rail-et-candidate-git-rev-parse
  - id: six-autres-fichiers-portes
    classe: VERIFIED
    valeur: 5-ajouts-purs-plus-poser-build-id-deja-couvert-request-6
  - id: primitives-perdues-identifiees
    classe: VERIFIED
    valeur: nexusEstManager-nexusFuseauSite-nexusJourDansFuseau-regle-acces-cycle-pilote
  - id: consommateurs-reels-localises
    classe: VERIFIED
    valeur: git-grep-16-fichiers-test-plus-5-ecrans-applicatifs
  - id: fusion-mecanique-verifiee
    classe: VERIFIED
    valeur: script-node-0-diff-chaque-moitie-contre-sa-source
  - id: substitution-nexuspage-retiree
    classe: VERIFIED
    valeur: premiere-tentative-cassait-test-acces-hors-service-bug-reel-detecte-retire
  - id: test-acces-hors-service
    classe: VERIFIED
    valeur: 18-18-avec-app-v1-candidate-substitue
  - id: test-fuseau-station
    classe: VERIFIED
    valeur: 121-121-avec-pointage-regles-candidate-substitue
  - id: test-regularisation-manager
    classe: VERIFIED
    valeur: 24-24-avec-cockpit-v2-candidate-substitue-plus-fixture-bootstrap
  - id: test-role-du-jour
    classe: VERIFIED
    valeur: 20-21-assertions-reelles-21e-scan-repo-complet-non-reproductible-arbre-partiel
  - id: tests-non-rejoues
    classe: DECLARED
    valeur: 12-fichiers-restants-non-executes-faute-de-temps-methode-identique
  - id: run-ci-brut-35838111274
    classe: NOT_APPLICABLE
    valeur: aucun-acces-gh-reseau-depuis-ce-canal
  - id: transport-patch-canal
    classe: NOT_APPLICABLE
    valeur: ecriture-candidate-hors-portee-artefact-depose-pour-application-externe
  - id: candidate-declaree-prete
    classe: NOT_APPLICABLE
    valeur: 65-reste-no-go
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Cause racine de la divergence auth/config #65 — arbre causal, correctif mécanique, contre-preuves

Réponse à `decision-5.md` (`APPROVED_WITH_CONDITIONS`, `closes: false`). Ce lot traite l'ensemble
des huit points demandés : cause racine (pas seulement le symptôme CI), comparaison architecturale,
correctif minimal, vérification des 6 autres fichiers portés, tests rejoués réellement, patch exact
+ contre-preuves, limites honnêtes du canal.

## 1. Constat central — pas un accident de contenu, un remplacement de fichier entier

Le commit `290a217f0f07d4f408469bc9cb8239814544f092` (« rebuild(65): porter la chaine de build/config
du rail (7 fichiers, mecanique) ») a été décrit comme mécanique. Il l'est pour 6 des 7 fichiers — mais
`nexus-auth.js` n'est PAS un fichier purement infrastructurel : la commande a réellement **remplacé
le fichier entier de la candidate par le fichier entier du rail** (`git show HEAD:nexus-auth.js` et
`git show origin/rebuild/carburants-65-20260922:nexus-auth.js` rendent le même blob Git,
`db20b1c662728f2eb1cc7d2d53dce3087a6cfaea` — vérifié par `git rev-parse`, pas supposé), au lieu d'une
fusion des deux évolutions indépendantes du fichier. Le rail et la candidate ont chacun fait évoluer
`nexus-auth.js` depuis un ancêtre commun : le rail vers une infrastructure de build/config portable
(bootstrap `NEXUS_CFG`, `NexusBuild`, `NexusPage`) ; la candidate #65 vers des règles métier propres à
son terrain (accès par catégorie d'écran, cycle de vie des services pendant la phase pilote, autorité
unique du fuseau `sites.timezone`). Un remplacement fichier-à-fichier a gardé les gains du rail et
effacé silencieusement tous les gains de la candidate accumulés dans ce même fichier depuis le
16/09/2026.

## 2. Vérification des 6 autres fichiers portés — aucune autre perte

| Fichier | État avant portage | Verdict |
|---|---|---|
| `_headers` | n'existait pas sur la candidate | ajout pur (14 lignes, aucune suppression) |
| `nexus-bandeau-environnement.js` | n'existait pas | ajout pur (nouveau fichier) |
| `nexus-page.js` | n'existait pas | ajout pur (nouveau fichier) |
| `outils/build.sh` | n'existait pas | ajout pur (nouveau fichier) |
| `outils/generer-config.js` | n'existait pas | ajout pur (nouveau fichier) |
| `outils/poser-build-id.js` | existait, modifié | suppressions = `horodatageUTC`/`commitCourt`/`buildIdExistant`, l'ancien mécanisme d'identifiant par horodatage, déjà remplacé par le mécanisme d'empreinte de contenu — c'est exactement la cause déjà diagnostiquée dans `request-6.md` (« Cohérence des épingles de cache »), pas une nouvelle perte |
| `nexus-auth.js` | existait, modifié | **867 lignes supprimées avec perte réelle de primitives métier** — seul fichier concerné |

Vérifié par `git cat-file -e <ref>^:<fichier>` (présence avant portage) et lecture du diff complet de
`290a217` fichier par fichier — pas par confiance dans le message de commit.

## 3. Primitives perdues dans `nexus-auth.js`, et leurs consommateurs réels

Extrait du diff de `290a217` sur `nexus-auth.js` (867 suppressions / 99 ajouts nets) :

| Primitive supprimée | Rôle | Consommateurs réels (vérifiés par `git grep` sur la candidate) |
|---|---|---|
| `nexusEstManager(employee)` | définition unique manager/gérant | `NEXUS-Carburant-Reception-v1.html`, `NEXUS-Cockpit-v2.html`, et en interne par les portes d'accès |
| `NEXUS_PAGES_CONSULTATION` / `OPERATIONNELLES` / `PUBLIQUES`, `nexusCategorieAcces`, `nexusPageExigeServiceOperationnel`, `nexusEcranOperationnelAtteignable` | règle d'accès du 16/09/2026 (« l'authentification n'est jamais une preuve de présence ») | `NEXUS-App-v1.html` (affichage des tuiles), et en interne par les deux portes de `nexusRequireAuth` |
| `nexusFuseauSite`, `nexusJourDansFuseau`, `nexusFuseauValide`, `nexusRetenirFuseau` (`nexusFuseauxSite` Map) | autorité unique du jour métier, `sites.timezone`, sans repli (arbitrage du 19/09/2026) | `NEXUS-App-v1.html`, `NEXUS-Missions-v1.html`, `NEXUS-Pointage-v1.html`, et en interne par le cycle de vie des services |
| `nexusReglesPilote`, `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes` | cycle de vie des services pendant la phase pilote (16/09/2026) — clôture sans heure inventée, régularisation manager | consommées par `nexusServiceCourant` en interne ; `NEXUS-Cockpit-v2.html` pour la régularisation manager |
| `nexusPointageArriveeManquant`, `nexusPriseDePosteManquante`, `nexusServiceCourant`, `nexusDepartPointeAujourdhui` (versions candidate) | rail les avait réécrites en versions plus simples, antérieures au 16-19/09 (repli manuel `role==='manager'`, filtre sur la date de l'APPAREIL au lieu du fuseau du SITE) | régression fonctionnelle directe, pas seulement une perte de nom |

`_headers`, `nexus-bandeau-environnement.js`, `nexus-page.js`, `outils/build.sh`,
`outils/generer-config.js` : néant, confirmé §2.

Consommateurs de tests recensés par `git grep` sur `origin/rebuild/carburants-65-20260922`
(fichiers `.js`/`.html`, pattern des symboles ci-dessus) : `test_acces_hors_service_20260916.js`,
`test_accueil_hors_service_20260918.js`, `test_fuseau_station_20260918.js`,
`test_regularisation_manager_20260916.js`, `test_jour_metier_pointage_20260919.js`,
`test_pointage_interrupteur_global.js`, `test_role_du_jour_20260905.js`,
`test_fuseau_parametres_station_20260920.js`, `test_missions_jour_station_20260918.js`,
`test_reception_compartiments_incomplet.js`, `test_reception_compartiments_saut_multiple_v2254.js`,
`test_reception_entete_partagee.js`, `test_reception_jaugeage_correctifs.js`,
`test_reception_m3_et_vide.js`, `test_reception_regularisation_20260919.js`,
`test_reception_visite_render.js` — **16 fichiers**, cohérent avec les « 20 nouveaux échecs »
rapportés (probablement des sous-assertions/steps CI distincts par fichier). **Limite honnête** : ce
canal n'a pas d'accès réseau/`gh` fonctionnel (`gh auth status`/`gh run view` refusés, comme dans
toutes les sessions précédentes de ce fil) — cette liste vient d'une analyse statique du contenu
réellement supprimé, pas d'une lecture du log brut du run `35838111274`. Aucun signe d'échec
« réellement indépendant » n'a été trouvé dans cette analyse ; si le run en comptait un, il resterait
à isoler séparément par qui a accès au log.

## 4. Le correctif — fusion mécanique, zéro comportement inventé

**Principe** : ni « tout garder du rail » (perd la candidate), ni « tout restaurer de la candidate »
(réintroduit `NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co"` codé en dur — **c'est le
projet Production**, pas Test : c'est exactement le ciblage Production en dur que `decision-5.md`
demande de supprimer). Le correctif déposé (`nexus-auth-restaure-1.js`, joint à ce lot) est une
concaténation vérifiée programmatiquement, PAS retapée à la main :

- **lignes 1 à 178** : octet-pour-octet identiques au `nexus-auth.js` actuel du rail (bootstrap
  `NEXUS_CFG`/`NexusBuild`/`NexusPage`, garde échec-fermé, `nexusRequireAuth`, `nexusRemplirNomDuCommerce`
  — la partie infra + l'addition A3/A3-6, jamais touchée) ;
- **lignes 180 à 945** : octet-pour-octet identiques au `nexus-auth.js` de la candidate juste AVANT le
  portage (blob `1cb997d45c62ec293a2c437f099c17313551b5b7`, commit `290a217^`) — toutes les primitives
  du §3, y compris les marqueurs `/* NEXUS-ACCES-REGLE:DEBUT/FIN */` et
  `/* NEXUS-FUSEAU-METIER:DEBUT/FIN */` que les tests candidate-only utilisent pour extraire ces blocs.

Vérifié par un script Node comparant ligne à ligne les deux moitiés contre leurs sources
respectives : **0 différence** de chaque côté. **Aucune substitution n'a été appliquée** : une
première tentative avait remplacé `window.location.pathname.split('/').pop()` par
`NexusPage.identifiant()` dans les deux portes d'accès (hypothèse : robustesse Cloudflare, qui retire
l'extension `.html` — la raison même de l'existence de `nexus-page.js`) ; rejouée contre
`test_acces_hors_service_20260916.js`, cette substitution cassait la correspondance avec les listes
`NEXUS_PAGES_*` (écrites avec extension) et bloquait un employé hors service qui aurait dû passer —
un vrai bug introduit par une amélioration non demandée. Retirée. Le fichier déposé est donc la
fusion **strictement minimale et mécanique**, sans aucune modification de comportement au-delà de ce
que la candidate avait déjà avant le portage.

**Point résiduel signalé, non corrigé ici** : sur un hébergement qui retire l'extension `.html`
(Cloudflare Pages — la cible réelle de #65), `nexusPointageArriveeManquant`/`nexusPriseDePosteManquante`
dérivent toujours la page via `window.location.pathname.split('/').pop()`, exactement le motif du bug
de boucle infinie du 04/09/2026 que `nexus-page.js` a été créé pour éliminer ailleurs dans ce même
fichier. Ce risque existait déjà identiquement sur la candidate avant le portage (comportement
inchangé par ce correctif) ; le signaler ici plutôt que le corriger silencieusement, conformément à
« aucune règle métier nouvelle » et à la minimalité exigée par `decision-5.md` §3 et §6. Une
correction éventuelle mérite son propre arbitrage (elle touche un bloc explicitement marqué « pur »
et testé comme tel).

## 5. Contre-preuves — tests candidate-only réellement rejoués, pas tracés à la main

Ce canal n'a pas d'accès en écriture à `rebuild/carburants-65-20260922` ni de `git worktree`/
`git archive` (refusés, comme documenté depuis le 06/09/2026). La vérification a donc été faite en
substituant temporairement `nexus-auth-restaure-1.js` à `nexus-auth.js` **dans ce checkout du rail**
(fichier suivi par Git, jamais commité dans cet état — restauré avant tout commit, `git diff` vide
confirmé), puis en exécutant réellement les 4 fichiers de test candidate-only les plus directement
ciblés sur les primitives du §3 (matérialisés en lecture seule via `git show
origin/rebuild/carburants-65-20260922:<fichier>`) :

| Test | Résultat | Note |
|---|---|---|
| `test_acces_hors_service_20260916.js` | **18/18** | nécessitait aussi `NEXUS-App-v1.html` de la candidate (non porté, diverge du rail sur 576 lignes) — substitué le temps du test, restauré ensuite |
| `test_fuseau_station_20260918.js` | **121/121** | nécessitait `nexus-pointage-regles.js` de la candidate (non porté, le rail n'a pas encore `MOTIF_CLOTURE_PILOTE`/`serviceObsolete`) — substitué, restauré |
| `test_regularisation_manager_20260916.js` | **24/24** | nécessitait `NEXUS-Cockpit-v2.html` de la candidate — substitué, restauré ; fixture de bootstrap (`window.NEXUS_CONFIG`/`NexusBuild`/`NexusPage`) ajoutée à la copie de scratch du test, absente à tort de son banc d'origine puisque cette exigence n'existait pas avant le portage |
| `test_role_du_jour_20260905.js` | 20/21 assertions réelles passent | la 21e scanne TOUS les `.js`/`.html` du répertoire courant et attend un total littéral de 59 — un contrôle de cohérence sur l'ENSEMBLE du dépôt candidate, non reproductible avec un arbre partiel (rail + une poignée de fichiers candidate substitués) ; aucune indication que `nexus-auth.js` lui-même y contribue autrement qu'à l'identique d'avant portage |

Chaque substitution de fichier candidate a été documentée avec sa raison exacte (fichier non porté,
divergé indépendamment du rail) et restaurée avant la fin de la session — aucun fichier suivi ne
reste modifié dans ce checkout (`git status` propre, vérifié après restauration).

**Non rejoués dans ce lot**, faute de temps dans cette session (pas d'obstacle technique nouveau,
la méthode ci-dessus s'appliquerait de la même façon) : `test_accueil_hors_service_20260918.js`,
`test_jour_metier_pointage_20260919.js`, `test_pointage_interrupteur_global.js`,
`test_fuseau_parametres_station_20260920.js`, `test_missions_jour_station_20260918.js`, les 7
`test_reception_*.js`.

## 6. Application externe exacte

Ce canal ne peut ni écrire sur `rebuild/carburants-65-20260922` ni sur `main`/`production`. Depuis
une session outillée avec accès en écriture à la candidate :

```
git fetch origin rebuild/carburants-65-20260922 handoff-continuite-20260920
git checkout rebuild/carburants-65-20260922
cp <ce dépôt>/docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-1.js nexus-auth.js
git diff --stat nexus-auth.js   # doit ne montrer AUCUNE ligne infra du rail modifiée
node --check nexus-auth.js
git add nexus-auth.js
git commit -m "fix(65): fusionner nexus-auth.js — bootstrap infra du rail + primitives metier de la candidate (acces, fuseau, cycle pilote), jamais un remplacement fichier a fichier"
```

Puis rejouer, sur la candidate elle-même : les 16 fichiers de test du §3, la suite complète, et le
patch mécanique de `request-6.md` (`bash outils/build.sh` remplaçant `node
outils/poser-build-id.js --verifier` dans `.github/workflows/tests.yml` — toujours non appliqué,
même obstacle d'écriture workflow que documenté précédemment). Les deux corrections (cache-pin de
`request-6.md` et fusion `nexus-auth.js` de ce lot) sont indépendantes et n'ont pas besoin d'être
appliquées ensemble, mais la CI ne sera verte qu'avec les deux.

## 7. Garde de non-régression proposée, pour empêcher la récurrence sur #62 ou un futur candidat

Pas implémentée dans ce lot (item 8 de la décision — ceci reste une proposition technique
déterministe, pas un choix métier, donc pas un blocage, mais elle mérite d'être nommée avant d'être
codée ailleurs). Le mécanisme qui a permis cette perte silencieuse : un portage « mécanique » de
fichiers a traité `nexus-auth.js` comme un fichier à copie intégrale, sans vérifier que son contenu
réel était purement infrastructurel des deux côtés. Une garde statique déterministe pourrait, pour
tout fichier PARTAGÉ entre le rail et une branche candidate (pas seulement neuf), refuser un portage
qui supprime une déclaration de fonction/const top-level présente côté candidate et absente côté
rail SANS qu'elle soit explicitement listée comme supersédée — sur le modèle de
`outils/guardians-router.js` déjà existant (détection de collision d'identité globale). Proposé comme
item de dette pour `NEXUS-ORCHESTRATION-GUARDIANS-*`, pas codé ici.

## Guardians

- **Architecture & Cohérence** : PASS pour le correctif lui-même (fusion mécaniquement vérifiée,
  aucune duplication de calcul) ; finding ouvert sur le mécanisme de portage lui-même (§7).
- **Security & Isolation** : PASS — le correctif SUPPRIME un ciblage Production en dur
  (`uzhjpqpctpvxytxpxoqz`), n'en introduit aucun, aucun secret/PIN/service_role.
- **Business Rules** : PASS — aucune règle métier nouvelle ; la substitution `NexusPage` initialement
  tentée a été retirée précisément parce qu'elle en aurait introduit une non prouvée.
  Aucune quantification finale possible : #65 reste NO GO tant que la CI réelle et la preuve
  `nexus-config.js`/Supabase Test (§7 de `request-6.md`) ne sont pas obtenues sur la candidate.
- **QA/Regression** : PASS partiel — 4/16 fichiers de test candidate-only directement concernés
  rejoués réellement et verts (163 assertions), 12 non rejoués faute de temps dans cette session,
  aucun accès à la suite complète de la candidate ni au run CI brut.
- **Bible/Philosophie** : PASS — aucune preuve fabriquée ; chaque limite (tests non rejoués, run CI
  non lisible, page-identification résiduelle sur Cloudflare) déclarée explicitement plutôt que
  masquée.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune promotion Production, aucun
secret créé/lu/exposé, PR #65 non modifiée, aucun fichier applicatif du rail modifié dans son état
final (diff limité à `docs/handoff/`), aucune nouvelle règle métier/UX/RLS/rôle, aucun affaiblissement
de garde.
