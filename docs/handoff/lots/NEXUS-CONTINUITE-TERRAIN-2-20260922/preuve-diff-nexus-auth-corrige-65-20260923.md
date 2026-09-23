# Preuve — correctif `nexus-auth.js` candidate #65, diff et vérification par construction

Périmètre exécuté sous `decision-6.md` (§ « Correctif autorisé »). Fichier livré :
`docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-corrige-65-20260923.js`
(962 lignes), à déposer en remplacement de `nexus-auth.js` sur la candidate
`rebuild/carburants-65-20260922`, au-dessus de `664af985` (donc après le
portage déjà autorisé des 6 autres fichiers build/config).

## 1. Le diff exact — une seule modification, isolée

`diff fe36a8e:nexus-auth.js nexus-auth-corrige-65-20260923.js` produit **un seul
hunk** : les 4 lignes d'origine

```js
const NEXUS_SUPABASE_URL = "https://uzhjpqpctpvxytxpxoqz.supabase.co";
const NEXUS_SUPABASE_ANON_KEY = "sb_publishable_7dV43gZxDYg6MOa6xzmdDQ_m8Mean5p";

const nexusClient = supabase.createClient(NEXUS_SUPABASE_URL, NEXUS_SUPABASE_ANON_KEY);
```

sont remplacées par le chargement `NEXUS_CFG` fail-closed déjà éprouvé sur le
rail (`window.NEXUS_CONFIG`, produit par `outils/generer-config.js`, l'un des
7 fichiers déjà portés) : mêmes noms de constantes en sortie
(`NEXUS_SUPABASE_URL`, `NEXUS_SUPABASE_ANON_KEY`), plus `NEXUS_ENVIRONNEMENT`
nouvellement exposée. **Rien d'autre n'est touché** — vérifié par diff
complet, pas seulement par relecture : aucune ligne au-delà du hunk 6-9/6-37
ne diffère de `fe36a8e:nexus-auth.js`.

Conséquence directement vérifiable : la collision de crédenciel signalée en
creux par `decision-3.md`/`decision-4.md`/`decision-5.md` (« l'identité de
preview et le `nexus-config.js` réellement servi doivent cibler exclusivement
Supabase Test ») est fermée pour `nexus-auth.js` — le fichier ne peut plus
jamais s'exécuter avec l'URL codée en dur `uzhjpqpctpvxytxpxoqz.supabase.co`.
Il refuse de démarrer si `nexus-config.js` n'a pas été chargé ou est
incomplet, exactement comme le rail.

**Délibérément non transporté** : la garde `NexusBuild`/`NexusPage`
(require fail-closed) du rail, et le remplacement de
`window.location.pathname.split('/').pop()` par `NexusPage.identifiant()`
dans les fonctions métier. Voir § 4.

## 2. Fonctions/blocs métier — identité bit à bit avec `fe36a8e`, donc aucune régression par construction

Ces éléments, nommés par `decision-6.md` §3 comme preuve requise, sont
**identiques caractère pour caractère** à `fe36a8e:nexus-auth.js` (vérifié
par diff, aucune modification) :

- accès (`/* NEXUS-ACCES-REGLE:DEBUT */` … `:FIN */`) : `NEXUS_PAGES_*`,
  `nexusCategorieAcces`, `nexusPageExigeServiceOperationnel`,
  `nexusEcranOperationnelAtteignable` ;
- `nexusEstManager` ;
- fuseau métier (`/* NEXUS-FUSEAU-METIER:DEBUT */` … `:FIN */`) :
  `nexusFuseauValide`, `nexusRetenirFuseau`, `nexusJourDansFuseau`,
  `nexusFuseauSite` ;
- pointage : `nexusPointageArriveeManquant`, `nexusPriseDePosteManquante`,
  `nexusDepartPointeAujourdhui` ;
- cycle des services de la phase pilote : `nexusReglesPilote`,
  `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`,
  `nexusServicesOuvertsDuSite`, `nexusRegulariserServicesObsoletes`,
  `nexusServiceCourant`.

Puisque ces fonctions et blocs n'ont pas changé un seul octet, et que la
seule modification se situe avant leur première déclaration (dans un scope
de module, sans effet de bord sur elles), **leur comportement à l'exécution
est identique à celui déjà éprouvé par la suite candidate sur `fe36a8e`** —
ce n'est pas une conjecture, c'est une conséquence directe du diff.

## 3. Vérification de la suite candidate — méthode, faute d'accès d'exécution

Ce canal n'a ni accès réseau à Supabase, ni permission d'écriture sur
`rebuild/carburants-65-20260922`/`.github/workflows/*` (inchangé depuis tous
les réveils précédents de ce lot) : `node run-tests.js` n'a donc pas pu être
rejoué sur l'arbre réel de la candidate corrigée. À la place, les **19
fichiers de test candidate désignés par `request-7.md`** ont été relus un par
un (`git show fe36a8e:<fichier>`, lecture seule) pour déterminer leur
méthode d'exécution et si le diff du § 1 les affecte :

| Méthode constatée | Fichiers | Effet du diff |
|---|---|---|
| Extraction d'une fonction/bloc nommé par `indexOf`/`match`/accolades équilibrées, exécutée seule ou assertion de texte pure (jamais le fichier entier) | `test_acces_hors_service_20260916.js`, `test_accueil_hors_service_20260918.js`, `test_connexion_nest_pas_presence_20260916.js`, `test_fuseau_parametres_station_20260920.js`, `test_fuseau_station_20260918.js`, `test_jour_metier_pointage_20260919.js`, `test_missions_jour_station_20260918.js`, `test_pointage_interrupteur_global.js`, `test_reception_compartiments_incomplet.js`, `test_reception_compartiments_saut_multiple_v2254.js`, `test_reception_entete_partagee.js`, `test_reception_jaugeage_correctifs.js`, `test_reception_m3_et_vide.js`, `test_reception_regularisation_20260919.js`, `test_reception_visite_render.js`, `test_role_du_jour_20260905.js`, `test_service_courant_unique_20260905.js` (17 fichiers) | **Aucun** — le diff est hors de toute zone extraite ou lue par ces épreuves |
| `vm.runInContext(SOURCE, ctx)` sur le **fichier entier**, `ctx.window` sans `NEXUS_CONFIG` | `test_cloture_services_obsoletes_20260916.js`, `test_regularisation_manager_20260916.js` (2 fichiers) | **Cassé par le correctif** — voir § 4 |

## 4. Écart trouvé — 2 harnais de test à mettre à jour, pas une régression du correctif

`test_cloture_services_obsoletes_20260916.js` et
`test_regularisation_manager_20260916.js` chargent tout `nexus-auth.js` dans
un contexte `vm` qu'ils construisent eux-mêmes (`banc()`), avec un
`ctx.window = { location: {...} }` qui ne porte pas `NEXUS_CONFIG` — cette
précondition n'existait pas dans `fe36a8e`, ces deux harnais datent d'avant
le besoin de configuration. Avec le correctif du § 1, `nexus-auth.js`
refuserait de démarrer dans ce contexte précis (`throw new Error(...)`,
comportement fail-closed voulu), et les deux fichiers échoueraient — pour une
raison nouvelle et différente de celle diagnostiquée par `request-7.md`.

**Ce n'est ni une régression fonctionnelle ni une incompatibilité avec
`build.sh`/`generer-config.js`** (le condition d'arrêt de `decision-6.md`
vise cela) : c'est un harnais de test qui doit apprendre la nouvelle
précondition, exactement comme le fait déjà `test_securite_lot_isolation_20260904.js`
sur le rail. Correctif minimal proposé, 1 ligne par fichier, à appliquer dans
le même commit que le correctif source :

```diff
   const ctx = {
     supabase: { createClient: () => client },
-    window: { location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' } },
+    window: { location: { pathname: '/NEXUS-Pointage-v1.html', search: '', href: '' },
+              NEXUS_CONFIG: { environnement: 'test', supabaseUrl: 'https://test.supabase.co', supabaseCle: 'anon-test' } },
     document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} },
```

(même ajout dans `test_regularisation_manager_20260916.js`, pathname
`/NEXUS-Cockpit-v2.html`)

Ce patch n'a été **ni écrit sur le dépôt candidate ni exécuté** : ce canal
n'a pas d'accès d'écriture à `rebuild/carburants-65-20260922`. Il est transmis
comme partie du correctif à transporter, pas comme un correctif déjà validé.

## 5. Ce qui reste hors de portée de ce canal

- Exécution réelle de `node run-tests.js` sur l'arbre candidate corrigé
  (avec les 2 fixtures ci-dessus appliquées) — non faite.
- Retour à 217/224 avec exactement les 7 connus — **non mesuré**, seulement
  déduit par construction pour 17/19 et par correctif proposé pour 2/19.
- La preuve d'identité de preview / `nexus-config.js` réellement servi
  (item 5 de la mission) — hors de portée tant que le point ci-dessus n'est
  pas acquis, conformément à l'ordre de la mission.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
migration/écriture Supabase Production, aucun déploiement Production, aucune
règle métier/UX/RLS/rôle modifiée (le fichier corrigé ne modifie que la
source de la configuration, jamais une décision d'autorisation), aucun
secret créé/lu/exposé, la liste des échecs connus (`CONNUS`) n'a pas été
touchée.
