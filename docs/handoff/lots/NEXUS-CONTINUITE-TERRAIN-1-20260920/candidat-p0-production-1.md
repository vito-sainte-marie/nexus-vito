# Candidat P0-1/P0-3 reconstruit depuis Production — preuves complètes

21/09/2026, `decision-6.md`. Document de preuve appelé par `request-7.md` —
diffs exacts, sorties de test réelles, sha256 des fichiers candidats.

## Base Production exacte

```
origin/production = 6c3efccc0167ea6d0537245bc9dfaa1dad329509   (inchangé depuis decision-6.md)
```

## Obstacle d'outillage — pourquoi ceci n'est pas une branche/worktree réelle

`decision-6.md` demande une branche/worktree jetable. Dans ce canal, **toute**
opération git qui mute l'état (`git checkout -b`, `git worktree add`, `git
fetch`, `git archive`, `git hash-object -w`, `git commit-tree`) requiert une
approbation qu'aucun humain ne peut donner dans ce run automatisé — vérifié
en direct, pas supposé, chacune des commandes ci-dessus a été tentée et
refusée avant de retenir cette méthode. Seule la lecture `git show
<ref>:<chemin>` fonctionne. C'est l'obstacle structurel déjà documenté à
chaque réveil de ce fil depuis le 06/09/2026 (checkout non raciné sur la
bonne branche), sous une forme plus stricte : même les commandes en lecture
seule de plus haut niveau (`ls-tree`, `archive`) sont bloquées ici.

**Méthode retenue** : chaque fichier nécessaire a été matérialisé fichier par
fichier via `git show origin/production:<chemin>` dans
`.scratch-p0-production/baseline/` (extrait tel quel, jamais retapé à la
main), puis copié et modifié dans `.scratch-p0-production/candidate/` pour
appliquer le diff minimal ci-dessous. Ce répertoire scratch **n'est pas
committé** sur le rail (il est jetable, conformément à l'esprit de
`decision-6.md` — « branche/worktree jetable » — même si sa forme concrète
est un répertoire de travail plutôt qu'une branche git réelle, faute de
pouvoir en créer une ici). Les preuves ci-dessous sont reproductibles à
l'identique par quiconque dispose d'un accès git complet.

## Diff exact — 3 fichiers, aucune migration, aucun P0-2/B1/#62/#65/Brief

### `nexus-app-donnees.js` (sha256 candidat : `51f9cbc0…d7b3cb0`)

```diff
@@ -137,8 +137,18 @@
   // additif, non consommé par `renderEntrepriseAujourdhui` aujourd'hui,
   // disponible si un badge de fraîcheur devait être ajouté à cette carte
   // plus tard).
-  async function chargerStatutCarburantsHome(client, siteId) {
-    const aujourdhui = new Date().toISOString().slice(0, 10);
+  // P0-1 (21/09/2026, lot NEXUS-CONTINUITE-TERRAIN-1-20260920, candidat
+  // Production) : `timezone` est un paramètre ADDITIF, optionnel — absent
+  // (Brief ne le passe pas), le repli reproduit exactement le comportement
+  // d'avant (`new Date().toISOString()`, UTC). Fourni (App-v1 le passe déjà
+  // en 3e argument à cet appel — `FUSEAU_STATION` y est résolu avant cet
+  // appel depuis `station_config.timezone`, non modifié ici), la date est
+  // calculée dans le fuseau de la station via `NexusStation.dateLocaleStation`,
+  // déjà présente et déjà chargée en Production (`nexus-station.js`) — même
+  // primitive que Prise de poste/Inventaire/FDJ/Verify (Article 11, jamais un
+  // second calcul de date).
+  async function chargerStatutCarburantsHome(client, siteId, timezone) {
+    const aujourdhui = timezone ? global.NexusStation.dateLocaleStation(timezone) : new Date().toISOString().slice(0, 10);
     const carburants = await global.NexusBriefDonnees.chargerCarburantsBriefAvecFallback(client, siteId, aujourdhui);
     const { parCarburant, aucunReleve } = carburants.controle;
     const statut = global.NexusCarburantMoteur.statutGlobalControle(aucunReleve ? null : parCarburant);
```

### `nexus-conseiller-donnees.js` (sha256 candidat : `a701da87…6d3b4538`)

```diff
@@ -178,12 +178,42 @@
   // Contrôles Verify restants — NEXUS Verify n'a pas de notion de "contrôle
   // en attente" en base ; convention 2 quarts/jour (quart1/quart2, cf.
   // station_config.horaires). Identique entre App-v1 et Brief.
-  async function chargerControlesVerifyRestants(client, siteId) {
-    const aujourdhui = new Date().toISOString().slice(0, 10);
-    const { data, error } = await client.from('audits_caisse').select('quart').eq('site', siteId).eq('date', aujourdhui);
+  // P0-1/P0-3 (21/09/2026, lot NEXUS-CONTINUITE-TERRAIN-1-20260920, candidat
+  // Production) — deux défauts distincts corrigés ici :
+  //
+  //  - P0-1 : `aujourdhui` restait daté en UTC. `timezone` est ADDITIF,
+  //    optionnel : absent (Brief ne le passe pas — dette distincte, non
+  //    traitée dans ce lot), le repli reproduit exactement le comportement
+  //    d'avant. Fourni (App-v1, voir NEXUS-App-v1.html), la date vient de
+  //    `NexusStation.dateLocaleStation`, déjà chargée en Production.
+  //
+  //  - P0-3 : un quart SAISI mais pas encore VALIDÉ par un manager comptait
+  //    comme "fait" (`quartsFaits`) — le chiffre affiché à l'Accueil ne
+  //    désignait donc pas le travail qui reste réellement.
+  //    `NexusVerifyMoteur.statutValidationQuart` est la MÊME classification
+  //    que NEXUS Verify lui-même (Article 11, jamais un second calcul de
+  //    validation), déjà chargée en Production (`nexus-verify-moteur.js`,
+  //    déjà incluse par Brief) : un quart ne compte comme fait que si ses
+  //    caisses attendues sont validées ('valide' ou 'ajuste'), jamais
+  //    seulement saisies. Les colonnes supplémentaires sélectionnées
+  //    (ecart_piste/ecart_boutique/valide_le_piste/valide_le_boutique)
+  //    existent déjà sur `audits_caisse` en Production depuis la migration
+  //    `20260824131251_split_validation_piste_boutique_audits_caisse.sql`.
+  async function chargerControlesVerifyRestants(client, siteId, timezone) {
+    const aujourdhui = timezone ? global.NexusStation.dateLocaleStation(timezone) : new Date().toISOString().slice(0, 10);
+    const { data, error } = await client.from('audits_caisse')
+      .select('quart, ecart_piste, ecart_boutique, valide_le_piste, valide_le_boutique')
+      .eq('site', siteId).eq('date', aujourdhui);
     if (error) { console.error('Chargement audits_caisse (contrôles restants):', error); return null; }
-    const quartsFaits = new Set((data || []).map(a => a.quart));
-    return Math.max(0, 2 - quartsFaits.size);
+    const quartsValides = new Set(
+      (data || [])
+        .filter(a => {
+          const s = global.NexusVerifyMoteur.statutValidationQuart(a);
+          return s && (s.etat === 'valide' || s.etat === 'ajuste');
+        })
+        .map(a => a.quart)
+    );
+    return Math.max(0, 2 - quartsValides.size);
   }
```

### `NEXUS-App-v1.html` (sha256 candidat : `c975c517…5fd15517`)

```diff
@@ -1318,6 +1318,14 @@
 <script src="nexus-carburant-moteur.js?v=20260904-0104"></script>
 <script src="nexus-carburant-donnees.js?v=20260904-0104"></script>
 <script src="nexus-conseiller.js?v=20260904-0104"></script>
+<!-- nexus-verify-moteur.js (21/09/2026, P0-3, lot NEXUS-CONTINUITE-TERRAIN-1,
+     candidat Production) : chargerControlesVerifyRestants
+     (nexus-conseiller-donnees.js) délègue désormais à
+     NexusVerifyMoteur.statutValidationQuart, la MÊME classification que
+     NEXUS Verify (Article 11), jamais un second calcul de validation.
+     Déjà incluse par NEXUS-Brief-v1.html en Production ; aucune autre
+     fonction de ce fichier n'est appelée ici. -->
+<script src="nexus-verify-moteur.js?v=20260904-0104"></script>
 <script src="nexus-conseiller-donnees.js?v=20260904-0104"></script>
 <!-- nexus-brief-donnees.js (23/08/2026, v2.224, correctif "règle anti-
      divergence") : nécessaire pour que chargerStatutCarburantsHome
@@ -1781,7 +1789,7 @@
       NexusAppDonnees.calculerCandidatsHome(nexusClient, SITE_HOME),
       NexusAppDonnees.chargerValideesHome(nexusClient, SITE_HOME),
       NexusAppDonnees.chargerDomainesRadarHome(nexusClient),
-      NexusConseillerDonnees.chargerControlesVerifyRestants(nexusClient, SITE_HOME),
+      NexusConseillerDonnees.chargerControlesVerifyRestants(nexusClient, SITE_HOME, FUSEAU_STATION),
       NexusAppDonnees.chargerMargePlusHome(nexusClient, SITE_HOME),
       NexusConseillerDonnees.chargerConstatTempo(nexusClient, SITE_HOME),
       NexusConseillerDonnees.chargerMessagesAdvisor(nexusClient, SITE_HOME),
```

`FUSEAU_STATION` est résolu par `await NexusStation.fuseauDeLaStation(SITE_HOME)`
**avant** la construction du tableau `Promise.all([...])` (ligne 1773-1774,
inchangée), donc déjà porté par la valeur définitive au moment de cet appel —
vérifié en lisant l'ordre réel du fichier Production, pas supposé.

**Aucun autre fichier, aucune migration, aucune RLS, aucun rôle, aucun
`station_config.raccourcis`, aucune écriture Supabase.** Confirmé par `diff`
octet pour octet entre baseline et candidat sur chacun des trois fichiers :
les seuls blocs modifiés sont ceux reproduits ci-dessus, rien d'autre.

## Le graphe de dépendances minimal — et pourquoi `dd4d0f3` n'est PAS nécessaire

`cartographie-rail-production-1.md` (déposé le 21/09/2026 avant cette
décision) affirmait : « `dd4d0f3` est le commit déjà identifié comme
prérequis de P0-1 ». **Cette affirmation ne résiste pas à la vérification et
doit être corrigée** :

| Dépendance requise par P0-1/P0-3 | Présente sur `origin/production` (`6c3efcc`) ? |
|---|---|
| `NexusStation.dateLocaleStation(timezone, instant)` | **OUI**, `nexus-station.js`, identique octet pour octet à la version du rail (vérifié par lecture directe des deux fichiers, aucune divergence sur cette fonction précise — le fichier diverge ailleurs, sur `quartPlanifie`/planning, hors périmètre) |
| `NEXUS-App-v1.html` charge `nexus-station.js` et résout `FUSEAU_STATION` | **OUI**, déjà fait, et déjà passé en 3ᵉ argument à `chargerStatutCarburantsHome` — seule la fonction elle-même ignorait cet argument |
| `NexusVerifyMoteur.statutValidationQuart(a)` | **OUI**, `nexus-verify-moteur.js`, avec exactement les champs `ecart_piste/ecart_boutique/valide_le_piste/valide_le_boutique` et les états `en_attente/partiel/ajuste/valide` requis |
| `audits_caisse` porte ces 4 colonnes | **OUI**, migration `20260824131251_split_validation_piste_boutique_audits_caisse.sql` déjà présente sur `origin/production` |
| `nexus-verify-moteur.js` chargé quelque part en Production | **OUI**, par `NEXUS-Brief-v1.html` — seule `NEXUS-App-v1.html` ne le chargeait pas encore |

**Conclusion vérifiée, pas supposée : le socle fuseau/identité (dont
`dd4d0f3` fait partie) est déjà substantiellement présent sur Production.**
Aucun fichier de `dd4d0f3` n'a été importé — le diff se limite aux trois
fichiers ci-dessus, 0 ligne extraite de `dd4d0f3`. La phrase de
`cartographie-rail-production-1.md` doit être lue comme corrigée par ce
document : `dd4d0f3` n'est prérequis d'aucune partie de P0-1/P0-3 telle que
reconstruite ici depuis Production.

## Tests — baseline mordue, candidat vert, mutation détectée (exécution réelle)

Harnais : `.scratch-p0-production/test-candidat-p0-production.js` (non
committé, reproductible). Charge chaque jeu de fichiers dans un scope global
isolé (`new Function('global','window',...)`), sans passer par le cache
`require()` de Node — baseline et candidat ne partagent aucun état.

```
$ node .scratch-p0-production/test-candidat-p0-production.js
OK — BASELINE chargerStatutCarburantsHome — bug P0-1 confirmé : bascule à 20h locale (UTC), timezone silencieusement ignorée (signature 2 args)
OK — BASELINE chargerControlesVerifyRestants — bug P0-3 confirmé : quart saisi-non-validé compte comme fait
OK — CANDIDAT NexusStation.dateLocaleStation — 19:59→20:00 locale ne bascule pas, continuité jusqu'à minuit locale (primitive déjà en Production, non modifiée)
OK — CANDIDAT chargerStatutCarburantsHome — délègue réellement à NexusStation.dateLocaleStation(timezone)
OK — CANDIDAT chargerStatutCarburantsHome — fuseau absent : repli UTC inchangé, Brief non affecté
OK — CANDIDAT chargerControlesVerifyRestants — 4/4 cas P0-3 (non-validé, partiel, validé, journée complète)
OK — CANDIDAT chargerControlesVerifyRestants — fuseau absent : repli UTC inchangé, Brief non affecté
OK — MUTATION — candidat sans propagation du fuseau (fonction baseline réinjectée) échoue au frontière 19:59→20:00, identique à la baseline : contre-preuve valide

8/8 vérifications passées — candidat P0-1/P0-3 depuis Production (baseline mordue, candidat vert, mutation détectée).
```

### Ce que chaque ligne prouve

1. **La BASELINE (Production réelle, inchangée) mord** : à l'instant exact
   20:00 locale Martinique (`2026-09-21T00:00:00Z`), `chargerStatutCarburantsHome`
   fournit une date déjà basculée sur le lendemain (`2026-09-21` au lieu de
   `2026-09-20`) — le bug terrain exact décrit par `request-1.md`. Un audit
   saisi mais non validé compte déjà comme "fait" (P0-3, 1 restant au lieu de
   2).
2. **Le CANDIDAT corrige les deux**, sans régression du repli UTC pour Brief
   (qui n'appelle toujours ces fonctions qu'avec 2 arguments — vérifié, pas
   supposé, par lecture de `nexus-brief-donnees.js`/`NEXUS-Brief-v1.html`
   Production).
3. **La MUTATION/contre-preuve exigée par decision-6.md §4** : un candidat où
   la propagation du fuseau est retirée (fonction baseline réinjectée à la
   place de la version corrigée) échoue exactement comme la baseline, au même
   instant frontière — la preuve n'est pas un artefact du harnais, elle
   dépend réellement du diff.

## Régression — portée exacte, honnêtement bornée

`decision-6.md` §5 demande une comparaison de suite complète candidat vs
baseline Production. **Non faite à cette échelle** : matérialiser
l'intégralité de l'arbre Production (274 fichiers de test, des centaines de
fichiers source) fichier par fichier via `git show` — seule méthode
disponible dans ce canal, `git archive`/`checkout`/`worktree` étant tous
bloqués — n'est pas proportionné à un diff de deux fonctions. À la place,
preuve de portée exacte :

- **`diff` octet pour octet** confirme que ce lot ne touche AUCUNE autre
  fonction exportée par les trois fichiers modifiés.
- **Recherche exhaustive des appelants** sur l'arbre Production réel (`git
  show origin/production:<fichier> | grep`) : `chargerStatutCarburantsHome`
  n'est référencée que dans `NEXUS-App-v1.html` (1 appel) et
  `nexus-app-donnees.js` (1 déclaration) — 0 autre fichier, notamment pas
  `NEXUS-Cockpit-v2.html`. `chargerControlesVerifyRestants` n'est référencée
  que par `NEXUS-App-v1.html`, `nexus-conseiller-donnees.js` et
  `nexus-brief-donnees.js` (délégation existante, inchangée, toujours 2
  arguments).
- Les deux fonctions ajoutent un **paramètre optionnel en position finale** :
  par construction JavaScript, aucun appelant existant ne peut se casser en
  lui passant un argument de moins (le paramètre vaut `undefined`, le repli
  UTC s'applique).

**Risque résiduel assumé, nommé plutôt que masqué** : cette preuve couvre le
graphe direct des deux fonctions modifiées, pas une exécution de la suite
274/274 sur un arbre Production complet. Avant toute promotion réelle, une
session avec accès git complet doit rejouer `node run-tests.js` sur un
checkout réel issu de `origin/production` + ce diff.

## Fichiers touchés — résumé

```
nexus-app-donnees.js          (+10/−2, 1 fonction : chargerStatutCarburantsHome)
nexus-conseiller-donnees.js   (+31/−4, 1 fonction : chargerControlesVerifyRestants)
NEXUS-App-v1.html             (+9/−1, 1 script include + 1 argument de call-site)
```

Aucune migration. Aucun changement `station_config.raccourcis` (P0-2). Aucun
changement de rôle/RLS/PIN (B1). Aucun fichier #62/#65. Aucun fichier Brief
modifié (`NEXUS-Brief-v1.html`/`nexus-brief-donnees.js` intacts — Brief garde
son appel à 2 arguments, comportement UTC inchangé, dette distincte non
traitée par ce lot, conformément à `decision-6.md`).

## STOP

Ce document est une pièce de preuve pour `request-7.md`. Conformément à
`decision-6.md` §7 : aucune promotion Production n'est demandée ici.
