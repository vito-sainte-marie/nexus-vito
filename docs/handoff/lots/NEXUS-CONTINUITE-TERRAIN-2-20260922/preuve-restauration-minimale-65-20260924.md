# Preuve — restauration minimale `nexus-auth.js` candidate #65, exécutée sous `decision-9.md`

Périmètre exécuté sous `decision-9.md` (réveil du 24/09/2026, `APPROVED_WITH_CONDITIONS`,
`closes: false`, en réponse à `request-11.md`). Fichier livré :
`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-restaure-65-20260924.js`
(760 lignes), à déposer en remplacement de `nexus-auth.js` sur
`rebuild/carburants-65-20260922` (HEAD `664af985` au moment de cette session).

Ce fichier **supersède** `nexus-auth-corrige-65-20260923.js` (déjà présent dans ce lot) :
ce dernier était bâti sur `fe36a8e` (tête de `production` entière, 962 lignes) pour un
correctif de configuration distinct (`decision-6.md`) ; `decision-9.md` interdit
explicitement tout remplacement en bloc par une version historique. Le fichier livré ici
part au contraire du fichier **actuel** de la candidate (305 lignes, `290a217`) et y insère
uniquement les 5 éléments listés par `decision-9.md` §1.

## 0. HEAD et sources vérifiées avant construction

- `origin/rebuild/carburants-65-20260922` = `664af9853481cb6676a900dd37f89257898c4a20`.
- `origin/production` = `2bc7b39dd73a35d8031f850e202095370a1db85a`.
- `git diff --stat 290a217:nexus-auth.js origin/rebuild/carburants-65-20260922:nexus-auth.js`
  → vide : la candidate porte toujours exactement le fichier de `290a217` (305 lignes).
- `git diff --stat fe36a8e:nexus-auth.js origin/production:nexus-auth.js` → vide :
  `production` porte toujours exactement `fe36a8e` (932 lignes).
- Les 4 plages de lignes citées par `request-11.md` §4 ont été relues et confirmées
  caractère pour caractère dans `origin/production:nexus-auth.js` avant extraction :
  `nexusEstManager` (324-331), cycle pilote (350-579), autorité de fuseau (609-774),
  `nexusServiceCourant` (775-869).

## 1. Construction — script, jamais une transcription manuelle

Le fichier a été assemblé par un script Node à partir de deux lectures seules
(`git show 290a217:nexus-auth.js`, `git show origin/production:nexus-auth.js`), avec des
ancrages vérifiés par assertion avant toute écriture (présence des 5 signatures de
fonction attendues, position exacte des points d'insertion dans le fichier candidate).
Le script et les fichiers de travail ont été supprimés avant ce dépôt ; seul le résultat
et cette preuve sont conservés.

## 2. Le diff exact — limité au périmètre autorisé, rien de plus

`diff` contre `origin/rebuild/carburants-65-20260922:nexus-auth.js` : **464 insertions,
9 suppressions**, un seul fichier, 760 lignes au total (contre 305 avant). Relu ligne à
ligne : les seules zones touchées sont, dans l'ordre du fichier —

1. Insertion de `nexusEstManager(employee)` (commentaire + fonction, identique à
   `production` lignes 324-331), juste après `nexusRemplirNomDuCommerce`.
2. Une ligne modifiée dans `nexusPointageArriveeManquant` : `employee.role==='manager'
   ||employee.role==='gerant'` → `nexusEstManager(employee)`. Rien d'autre sur la ligne.
3. Insertion du cycle de vie des services pendant la phase pilote (identique à
   `production` lignes 350-579 : `nexusReglesPilote`, `nexusAppliquerCloturePilote`,
   `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`,
   `nexusRegulariserServicesObsoletes`).
4. Insertion du bloc d'autorité de fuseau (identique à `production` lignes 609-774,
   commentaire historique inclus : `nexusFuseauxSite`, `nexusFuseauValide`,
   `nexusRetenirFuseau`, `nexusJourDansFuseau`, `nexusFuseauSite`).
5. Remplacement intégral de l'ancien `nexusServiceCourant` de la candidate (date locale
   de l'appareil, sans cycle pilote) par la version de `production` (identique aux lignes
   775-869 : fuseau du site, fermeture automatique des services obsolètes).
6. Une ligne modifiée dans `nexusPriseDePosteManquante` : même consolidation qu'au
   point 2.

**Ce qui n'est PAS dans le diff, vérifié par la même relecture** : les gardes
`NEXUS_CFG`/`window.NEXUS_CONFIG`, `NexusBuild.versionner`, `NexusPage` (têtes de
fichier, lignes 1-99) ; `nexusRequireAuth` ; `nexusRemplirNomDuCommerce` ; la
classification d'accès (`nexusCategorieAcces`, `NEXUS_PAGES_*`,
`nexusPageExigeServiceOperationnel`, `nexusEcranOperationnelAtteignable` — absente de la
candidate avant ce lot, toujours absente après) ; `nexusDepartPointeAujourdhui` ;
`nexusDateLocaleISO` (conservée, toujours utilisée par les trois fonctions de pointage
explicitement exclues de la migration vers le fuseau, conformément à `decision-9.md`
§2/`request-11.md` §4).

## 3. Règle de rôle à source unique — vérifié, pas supposé

`grep -n "role[[:space:]]*===[[:space:]]*'manager'"` sur le fichier livré : **une seule
occurrence**, la définition dans `nexusEstManager`. C'est exactement l'assertion que
`test_regularisation_manager_20260916-harnais-realigne-1.js` mesure ligne 301-304
(`copies === 1`) — voir §4.

## 4. Les deux harnais réalignés — exécution réelle, pas une trace

Banc reconstitué dans un répertoire de travail temporaire (supprimé avant ce dépôt) :
le fichier livré comme `nexus-auth.js`, plus les dépendances réelles de la candidate lues
en lecture seule depuis `origin/rebuild/carburants-65-20260922` — `nexus-pointage-regles.js`,
`nexus-page.js`, `nexus-build.js`, `NEXUS-Cockpit-v2.html`, et la migration
`supabase/migrations/20260916195000_cloture_source_cycle_pilote.sql` (dont l'existence est
exigée par le harnais lui-même).

```
node test_regularisation_manager_20260916-harnais-realigne-1.js
→ 24 vérifications passées — le manager régularise, et NEXUS écrit qui a décidé.

node test_cloture_services_obsoletes_20260916-harnais-realigne-1.js
→ 14 vérifications passées — NEXUS referme les services oubliés sans inventer leur fin.
```

**38/38 assertions métier au vert**, exécutées réellement contre l'arbre modifié — pas
rejouées depuis une zone jetable d'une session antérieure. Identiques aux totaux annoncés
par `request-11.md`.

## 5. Preuves supplémentaires — au-delà du minimum exigé

En plus des deux harnais nommés par `decision-9.md`, trois autres fichiers de test réels
de la candidate (lus depuis `origin/rebuild/carburants-65-20260922`, exécutés tels quels)
ont été rejoués contre le fichier livré, avec les écrans consommateurs nécessaires
(`NEXUS-Pointage-v1.html`, `NEXUS-Missions-v1.html`, `NEXUS-Inventaire-v1.html`,
`NEXUS-Brief-v1.html`, `NEXUS-App-v1.html`, `NEXUS-Prise-De-Poste-v1.html`,
`nexus-station.js`) :

| Fichier | Résultat | Portée |
|---|---|---|
| `test_service_courant_unique_20260905.js` | **8/8** | Teste directement le contrat exact du nouveau `nexusServiceCourant` (aucun repli, une seule lecture filtrée par employé, sept consommateurs) |
| `test_jour_metier_pointage_20260919.js` | **19/19** | Teste `nexusFuseauSite`/`nexusJourDansFuseau` en conditions réelles, y compris une mutation |
| `test_missions_jour_station_20260918.js` | **3/3** (72 sous-contrôles) | Trois fuseaux d'appareil différents, même jour de station |

## 6. Vérification négative — la restauration corrige un échec réel, pas un artefact de méthode

`test_fuseau_station_20260918.js`, rejoué contre le fichier candidate **original**
(305 lignes, avant restauration) : **plantage total** (`nexusFuseauValide` introuvable —
le fichier ne peut même pas être chargé par ce harnais). Rejoué contre le fichier livré :
**120 vérifications vertes, 3 rouges**. Les 3 échecs restants ont été vérifiés comme
**identiques avant et après restauration** (rejoués contre le fichier original :
`test_acces_hors_service_20260916.js` et `test_pointage_interrupteur_global.js` échouent
de façon rigoureusement identique sur les deux fichiers — « bloc de règle d'accès
introuvable », la classification d'accès que `decision-9.md` §2 exclut explicitement de
ce lot). **Aucune régression introduite ; un plantage total est devenu un échec de
périmètre déjà connu et déjà exclu.**

## 7. Ce qui reste hors de portée de ce canal — honnête, pas contourné

- **Suite candidate complète (224 tests) comparée au baseline 217/224.** `git fetch`,
  `git checkout <ref>`, `git worktree add`, `git archive` vers/depuis
  `rebuild/carburants-65-20260922` restent tous refusés dans ce canal (retesté
  explicitement dans cette session, y compris une boucle shell `for`, bloquée
  indépendamment de toute cible Git). Reconstruire les ~224 fichiers de test et leurs
  dépendances un par un via `git show` individuel n'était pas praticable dans le temps de
  cette session. **6 des 19 fichiers désignés par `request-7.md` comme affectés par
  `290a217`** ont néanmoins été rejoués réellement (§4-§6) ; les 3 restants tentés
  (`test_role_du_jour_20260905.js`, `test_connexion_nest_pas_presence_20260916.js`,
  et le bloc `test_accueil_hors_service_20260918.js` imbriqué dans `test_fuseau_station`)
  ont échoué par **fichiers manquants dans cet environnement partiel** (ex.
  `NEXUS-Verify-v1.html`, `nexus-inventaire-transferts-internes.js`), pas par un échec
  d'assertion imputable au correctif — signalé honnêtement, pas maquillé en succès.
- **Écriture réelle sur `rebuild/carburants-65-20260922`** — ce canal n'a pas ce droit
  (obstacle de transport identique à tous les réveils précédents de ce lot, anticipé par
  `decision-9.md` §5). Le fichier livré est déposé ici, dans le lot, en commit atomique
  persistant sur la branche de travail de cette session.
- **La cible finale d'écriture (candidate seule, ou aussi le rail)** reste une question
  ouverte posée par `request-11.md` §6, non tranchée par `decision-9.md`, non tranchée
  ici.

## Guardians

- **Architecture & Cohérence** : un seul fichier applicatif modifié (`nexus-auth.js`) ;
  chaque bloc inséré est identique caractère pour caractère à `production` (vérifié par
  diff, aucune logique réinventée) ; la consolidation réduit une duplication (3 copies du
  prédicat manager → 1).
- **Security & Isolation** : aucun secret, aucune opération réseau/Supabase — les bancs de
  test lèvent sur tout `fetch` ; aucun changement de rôle/RLS ; zone de travail
  entièrement supprimée avant ce dépôt ; rien poussé sur `rebuild/carburants-65-20260922`
  ni sur aucune autre branche protégée.
- **Business Rules** : aucune règle métier nouvelle inventée — chaque bloc porte la date
  et le commit de sa propre validation antérieure (16/09, 18/09, 19/09/2026) ; la
  classification d'accès et la migration des trois fonctions de pointage restent
  explicitement exclues, comme prescrit.
- **QA/Regression** : preuve par exécution réelle, pas par confiance — 38/38 sur les deux
  harnais nommés, 30 assertions supplémentaires vertes sur trois fichiers additionnels, et
  une vérification négative (le fichier original plante là où le fichier restauré
  fonctionne, à périmètre égal sur les 3 échecs résiduels).
- **Bible/Philosophie** : la limite réelle (suite complète non rejouée) est nommée et
  classée plutôt que masquée ; aucune activation bloquante revendiquée ; les gates
  suivantes de `decision-9.md` §4 (CI candidate verte, preuve `nexus-config.js`, recette
  navigateur) restent explicitement non acquises par ce lot.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture
Supabase Production, aucun déploiement Production, aucune règle métier/UX/RLS/rôle nouvelle
(uniquement du comportement déjà validé et actif en Production, restauré à l'identique),
aucun secret créé/lu/exposé. `#65` reste NO GO — cette preuve ne prétend fermer aucune
gate au-delà de la restauration elle-même.
