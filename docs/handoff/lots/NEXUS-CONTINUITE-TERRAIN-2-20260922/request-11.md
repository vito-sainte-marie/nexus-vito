---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 11
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: cause-racine-etablie
    classe: VERIFIED
    valeur: 290a217-parent-fe36a8e-identique-octet-a-production-rail-jamais-eu-la-fonctionnalite
  - id: lignee-identifiee
    classe: VERIFIED
    valeur: 4e1b4c3-16-09-cycle-pilote-7afbf27-e6161ac-18-19-09-fuseau-sites-timezone
  - id: plan-construit-et-teste
    classe: VERIFIED
    valeur: merge-4-blocs-plus-consolidation-predicat-manager-763-lignes
  - id: harnais-1-vert
    classe: VERIFIED
    valeur: test_regularisation_manager_20260916-harnais-realigne-1-24-sur-24
  - id: harnais-2-vert
    classe: VERIFIED
    valeur: test_cloture_services_obsoletes_20260916-harnais-realigne-1-14-sur-14
  - id: preuve-negative-avant-consolidation
    classe: VERIFIED
    valeur: echec-mesure-regle-de-role-3-occurrences-avant-correction
  - id: diff-mesure
    classe: VERIFIED
    valeur: 466-insertions-9-suppressions-contre-candidate-actuelle-un-seul-fichier
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: aucune-autorisation-handoff-materialisee-plan-non-applique
  - id: zone-jetable-nettoyee
    classe: VERIFIED
    valeur: git-status-propre-avant-depot
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Cause racine du remplacement de `nexus-auth.js` par `290a217`, et plan de restauration minimal — non appliqué

Investigation demandée en suite de `request-10.md` : « chercher la cause à la racine du remplacement de
`nexus-auth.js` lors du portage `290a217` », établir la lignée qui portait `nexusServiceCourant` et les
fonctions déjà validées avant ce portage, distinguer les blocs de garde build/config des blocs métier
perdus, et préparer le plus petit plan de restauration/fusion — prouvé par diff et tests en zone jetable,
**sans écrire la candidate** tant que la décision correspondante n'est pas matérialisée.

## 1. Cause racine — établie, pas supposée

`290a217` (« rebuild(65): porter la chaîne de build/config du rail (7 fichiers, mécanique ») a pour parent
`fe36a8e` (« Intégrer la tête de production dans Régularisation d'une réception passée »). Vérifié :

- `fe36a8e:nexus-auth.js` est **octet pour octet identique** à `origin/production:nexus-auth.js` (932
  lignes) — `fe36a8e` est un merge (`ffb520b` + `2bc7b39` = tête de `production` à ce moment) qui n'a
  produit aucun conflit sur ce fichier.
- `290a217:nexus-auth.js` (305 lignes) est **octet pour octet identique** au `nexus-auth.js` du rail
  `handoff-continuite-20260920` **et** à celui de la candidate actuelle
  (`origin/rebuild/carburants-65-20260922`, HEAD `664af98`, aucun commit ultérieur ne retouche ce fichier).
- Recherche de séquence (`git log -S`) sur `handoff-continuite-20260920` : `nexusServicesOuvertsDuSite`
  n'apparaît **à aucun moment** de l'histoire propre du rail. Le rail n'a donc jamais porté cette
  fonctionnalité — ce n'est pas une régression du rail, c'est une fonctionnalité qui a évolué **ailleurs**.

**Ce que `290a217` a réellement fait** : le commit décrit un portage « mécanique » de la chaîne
build/config. Il a bien ajouté les gardes `NEXUS_CONFIG`/`NexusBuild`/`NexusPage`. Mais en copiant
`nexus-auth.js` **depuis le rail**, il a remplacé le contenu métier que la candidate venait de recevoir
une commit plus tôt (`fe36a8e`, tête de `production`) par la version du rail — qui n'a jamais eu cette
fonctionnalité. Un fichier qui mélange gardes d'infrastructure et logique métier ne se porte pas en bloc.

## 2. La lignée qui portait le comportement déjà validé

Deux fonctionnalités, développées sur des branches séparées, **jamais fusionnées dans le rail**, mais
fusionnées dans `production` et donc présentes dans `fe36a8e` :

- **16/09/2026** — `4e1b4c3` (« Régularisation manager des services obsolètes (volet D) »), ancêtre de
  `origin/production`. Introduit `nexusEstManager`, `nexusReglesPilote`, `nexusAppliquerCloturePilote`,
  `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`, et
  fait dépendre `nexusServiceCourant` de la fermeture automatique des services obsolètes. Dépend de
  `nexus-pointage-regles.js` (`MOTIF_CLOTURE_PILOTE`, `SOURCE_CLOTURE_PILOTE`, `servicesObsoletes`).
- **18-19/09/2026** — `7afbf27` puis `e6161ac` (branche `accueil-employes-20260918`, ancêtres de
  `origin/production`). Font de `sites.timezone` l'unique autorité du jour métier
  (`nexusFuseauSite`/`nexusJourDansFuseau`/`nexusFuseauValide`/`nexusRetenirFuseau`), suppriment
  `nexusDateLocaleISO` et le repli `America/Martinique`, et font dépendre `nexusServiceCourant` de cette
  primitive au lieu de la date locale de l'appareil.

Ces deux fonctionnalités ont leur propre historique de commits, leurs propres tests (`git log --all` sur
`test_acces_hors_service_20260916.js` les situe sur `acces-hors-service-20260916`/`accueil-employes-20260918`,
jamais sur le rail), et sont aujourd'hui en Production. Ce n'est pas une nouvelle règle métier : c'est du
comportement déjà validé et exploité, absent du rail par défaut de fusion, jamais par décision.

## 3. Gardes build/config à conserver — inchangées, non touchées

Confirmé par lecture, non retouché dans le plan : le bloc `NEXUS_CFG`/`window.NEXUS_CONFIG` (échec fermé
sans configuration), la garde `NexusBuild.versionner`, la garde `NexusPage`, et tout le chargeur
d'extensions Inventaire qui s'appuie sur `NexusPage.est(...)`/`NexusBuild.versionner(...)`. Ce sont
exactement les gardes que `decision-8.md` a validées et que les deux harnais réalignés exercent déjà avec
succès. Le plan ne modifie aucune ligne de ce bloc.

## 4. Périmètre du plus petit plan — et ce qui en est délibérément exclu

**Inclus** (strictement ce qui est nécessaire pour que les deux harnais déjà réalignés atteignent leurs
assertions métier, et rien de plus) :

1. `nexusEstManager(employee)` — définition centrale, copiée telle quelle de `origin/production`
   (lignes 324-331).
2. Le bloc d'autorité de fuseau (`nexusFuseauxSite`, `nexusFuseauValide`, `nexusRetenirFuseau`,
   `nexusJourDansFuseau`, `nexusFuseauSite`), copié tel quel (lignes 609-774, commentaire historique
   inclus).
3. Le bloc « cycle de vie des services pendant la phase pilote » (`nexusReglesPilote`,
   `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`,
   `nexusRegulariserServicesObsoletes`), copié tel quel (lignes 350-579).
4. Le `nexusServiceCourant` mis à jour (lignes 775-869), qui dépend des deux blocs précédents.
5. **Consolidation minimale, exigée par le harnais lui-même** (voir §5) : les deux occurrences
   résiduelles de `employee.role==='manager'||employee.role==='gerant'` dans `nexusPointageArriveeManquant`
   et `nexusPriseDePosteManquante` (déjà présentes sur le rail, non touchées jusqu'ici) sont remplacées par
   `nexusEstManager(employee)` — même prédicat, aucun comportement nouveau, mais une seule définition au
   lieu de trois.

**Explicitement exclu** — plus grand, distinct, non requis par les deux harnais nommés dans `request-9`/
`request-10` :

- La classification d'accès « consultation / opérationnel / publique / séquence »
  (`nexusCategorieAcces`, `NEXUS_PAGES_CONSULTATION`, `NEXUS_PAGES_OPERATIONNELLES`,
  `NEXUS_PAGES_PUBLIQUES`, `nexusPageExigeServiceOperationnel`, `nexusEcranOperationnelAtteignable`) —
  développée sur `acces-hors-service-20260916`, c'est un changement de navigation/redirection sur
  cinquante écrans. Ni l'un ni l'autre harnais ne l'exerce (vérifié par recherche dans les deux fichiers).
  L'introduire ici constituerait une nouvelle règle UX au sens de l'interdiction du mandat, même si elle
  est elle-même déjà validée ailleurs.
- La migration de `nexusPointageArriveeManquant`/`nexusPriseDePosteManquante`/
  `nexusDepartPointeAujourdhui` vers `nexusFuseauSite` (elles restent sur la date locale de l'appareil,
  comme sur le rail aujourd'hui) : cette migration, dans `production`, est **couplée** à la classification
  d'accès ci-dessus (`nexusPageExigeServiceOperationnel`) — la restaurer isolément fabriquerait un
  comportement qui n'existe nulle part tel quel.

Ces deux points restent un écart réel entre le rail et `production` (deux définitions du jour métier
coexisteraient dans le fichier restauré : `nexusDateLocaleISO` pour les trois fonctions non touchées,
`nexusJourDansFuseau` pour `nexusServiceCourant`). Ce n'est pas corrigé silencieusement ici — c'est nommé
en §6 pour arbitrage séparé, pas résolu par ce lot.

## 5. Preuve — construite et exécutée réellement, en zone jetable, jamais poussée

Zone de travail : un fichier fusionné construit par script (jamais à la main) à partir de trois sources
lues en lecture seule (`git show`) — le rail (base inchangée), `origin/production` (blocs listés en §4),
aucune écriture sur aucune branche. Étapes réellement exécutées dans cette session :

1. **Premier assemblage, sans la consolidation §4.5** : `node --check` passe, mais le harnais
   `test_regularisation_manager_20260916-harnais-realigne-1.js`, rejoué contre ce fichier, échoue sur une
   assertion précise et non anticipée : *« la règle de rôle ne doit exister qu'à un seul endroit de ce
   fichier »* (`3 !== 1`). C'est le harnais lui-même qui a détecté que laisser les deux fonctions
   inchangées, une fois `nexusEstManager` réintroduite, viole la garde de source unique que `production`
   avait déjà établie. Ce n'est pas une hypothèse : c'est un échec mesuré.
2. **Correction appliquée** (§4.5) : les deux occurrences remplacées par `nexusEstManager(employee)`.
   Re-exécution : le même harnais passe intégralement.
3. **Exécution réelle des deux harnais**, dans le répertoire de ce lot, avec les dépendances réelles de la
   candidate (`nexus-pointage-regles.js` et les six écrans consommateurs — `NEXUS-Pointage-v1.html`,
   `NEXUS-Missions-v1.html`, `NEXUS-Inventaire-v1.html`, `NEXUS-Cockpit-v2.html`, `NEXUS-Brief-v1.html`,
   `NEXUS-App-v1.html` — lus depuis `origin/rebuild/carburants-65-20260922`, **non modifiés**, aucun
   besoin de les toucher) :
   - `test_regularisation_manager_20260916-harnais-realigne-1.js` → **24/24**.
   - `test_cloture_services_obsoletes_20260916-harnais-realigne-1.js` → **14/14**.
   - **38/38 assertions métier au vert**, dont les cinq fonctions nommées par `request-10` et le
     comportement à jour de `nexusServiceCourant` (fuseau du site, fermeture automatique sans heure
     inventée, aucune régression sur les cas « ne pas refermer »).
4. **Diff mesuré** contre le `nexus-auth.js` actuel de la candidate (`origin/rebuild/carburants-65-20260922`,
   305 lignes) : **466 insertions, 9 suppressions** (763 lignes au total) — un seul fichier applicatif
   touché. `nexus-pointage-regles.js`, `NEXUS-Cockpit-v2.html` et les six écrans consommateurs sont déjà
   corrects sur la candidate et **ne demandent aucun changement**.
5. Toute la zone de travail (fichiers copiés dans le répertoire du lot pour l'exécution, script de
   construction) a été supprimée avant la fin de cette session — `git status` confirmé propre sur
   `docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/` et sur l'arbre entier avant ce dépôt.

## 6. Ce qui reste à arbitrer, nommé et non tranché ici

- **Le périmètre exclu (§4)** — restaurer aussi la classification d'accès et la migration fuseau des
  trois fonctions non touchées est un lot plus grand, séparé, déjà validé sur `production` mais qui
  change une redirection UX sur cinquante écrans. À ouvrir séparément si voulu, pas dans ce lot.
- **La cible d'écriture** — ce plan est prouvé contre le contenu de la candidate
  (`origin/rebuild/carburants-65-20260922`). Il n'est pas écrit s'il doit aller sur la candidate
  seule, ou aussi sur le rail `handoff-continuite-20260920` pour qu'un futur portage mécanique ne
  reproduise pas la même perte. Question ouverte, pas tranchée unilatéralement ici.
- **Transport** — `git push`/`git fetch`/`git worktree add`/`git archive` vers/depuis
  `rebuild/carburants-65-20260922` restent refusés dans ce canal (retesté implicitement par l'absence de
  toute tentative d'écriture distante dans cette session). Si l'écriture est autorisée, le même obstacle
  de transport que `request-9`/`request-10` s'appliquera : diff persisté sur le rail, transport par
  l'Orchestrator.

## Guardians

- **Architecture & Cohérence** : un seul fichier applicatif modifié par le plan proposé
  (`nexus-auth.js`) ; les blocs copiés le sont tels quels depuis une source déjà validée, aucune logique
  réinventée ; la consolidation du prédicat manager réduit une duplication au lieu d'en introduire une.
- **Security & Isolation** : aucun secret, aucune opération réseau/Supabase — le banc de test lève sur
  tout `fetch` ; zone de travail entièrement supprimée avant la fin de la session ; rien poussé sur
  aucune branche.
- **Business Rules** : aucune règle métier nouvelle — chaque bloc porte la date et le commit de sa propre
  validation antérieure (16/09, 18/09, 19/09/2026) ; la classification d'accès, elle-même une règle déjà
  validée mais plus large, est explicitement exclue plutôt qu'introduite silencieusement.
  35 000 L / calendrier n'est pas concerné par ce lot.
- **QA/Regression** : preuve par échec puis succès mesuré (§5.1-5.2), pas seulement par succès — le
  harnais a réellement intercepté une omission avant correction. 38/38 assertions métier réelles,
  aucune assertion affaiblie ou contournée.
- **Bible/Philosophie** : préférence donnée à nommer précisément ce qui est exclu (§4, §6) plutôt qu'à
  élargir silencieusement le périmètre pour restaurer « tout » en une fois ; aucune candidate écrite sans
  décision.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase Production/NEXUS Production, aucun
secret/PIN/service_role, aucune règle métier/UX/RLS/rôle ajoutée, **aucune écriture sur la candidate ni
sur le rail** — ce dépôt est une investigation et un plan prouvé en zone jetable, pas une exécution.
Gates identité Test / Cloudflare de `decision-7.md` inchangées, non retouchées ici.
