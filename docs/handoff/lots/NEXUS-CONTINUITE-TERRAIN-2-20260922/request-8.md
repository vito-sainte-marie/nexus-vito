---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 8
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: request7-reconcilie
    classe: VERIFIED
    valeur: publie-via-outils-handoff-js-depuis-branche-claude-issue-28-20260923-1248
  - id: decision6-materialisee
    classe: VERIFIED
    valeur: APPROVED_WITH_CONDITIONS-closes-false-consommee
  - id: correctif-diff-isole
    classe: VERIFIED
    valeur: un-seul-hunk-lignes-6-9-vers-6-37-reste-identique-a-fe36a8e
  - id: verification-17-sur-19-tests
    classe: VERIFIED
    valeur: extraction-ou-texte-seul-diff-hors-zone-lue
  - id: verification-2-sur-19-tests
    classe: DECLARED
    valeur: vm-runInContext-fichier-entier-window-sans-NEXUS_CONFIG-patch-propose-non-applique
  - id: question-cloudflare-extension-non-tranchee
    classe: DECLARED
    valeur: signalee-non-resolue-correctif-local-possible-non-applique
  - id: suite-candidate-rejouee
    classe: NOT_APPLICABLE
    valeur: aucun-acces-ecriture-rebuild-carburants-65-20260922-ni-reseau-supabase
  - id: identite-preview-nexus-config-servi
    classe: NOT_APPLICABLE
    valeur: subordonne-a-ci-verte-non-atteinte
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Correctif préparé `nexus-auth.js` (candidate #65) — deux points matériels non résolus, retour avant transport

Exécution de `decision-6.md`. Items 1 et 2 accomplis, item 3 accompli par
construction/correctif proposé, items 4 et 5 hors de portée de ce canal —
et surtout, **deux constats matériels trouvés en cours de préparation**
justifient ce retour plutôt qu'une déclaration de succès.

## 1. Réconciliation du diagnostic (`request-7.md`) — faite

Republié via `outils/handoff.js demande` (jamais copié à la main) depuis la
branche Claude où il avait été produit (`claude/issue-28-20260923-1248`,
commit `37efd26`, jamais intégrée). Faits re-vérifiés indépendamment sur ce
HEAD avant republication : `git diff --name-only 290a217f 664af985` limité à
`.github/workflows/tests.yml` ; `nexus-auth.js` 932→305 lignes entre
`fe36a8e` et `664af985` ; `nexusEstManager` 4→0, `nexusFuseauValide` 2→0
occurrences ; zéro occurrence des deux sur l'intégralité du HEAD canonique.

## 2. `decision-6.md` — arbitrage matérialisé

La question ouverte au §6 de `request-7.md` (« quelle voie pour fusionner les
deux lignées de `nexus-auth.js` ? ») ne nécessitait aucune règle métier
nouvelle, conformément au réveil : `decision-6.md` (`NEXUS Orchestrator`,
`APPROVED_WITH_CONDITIONS`, `closes: false`) l'a matérialisée via
`outils/handoff.js decision`, consommée. Elle autorise la conservation de la
lignée `fe36a8e` comme base, avec transport limité à « ce qui est réellement
nécessaire à la chaîne build/config ».

## 3. Correctif préparé — un seul hunk, isolé

`nexus-auth-corrige-65-20260923.js` (joint à ce lot) : `fe36a8e:nexus-auth.js`
tel quel, à une exception près — les 4 lignes de crédenciel codées en dur
(`uzhjpqpctpvxytxpxoqz.supabase.co`, `sb_publishable_...`) remplacées par le
chargement `NEXUS_CFG` fail-closed déjà éprouvé sur le rail
(`window.NEXUS_CONFIG`, produit par `outils/generer-config.js` — l'un des 6
autres fichiers déjà portés). Vérifié par diff complet : aucune autre ligne
ne change. Détail et preuve de non-régression par construction :
`preuve-diff-nexus-auth-corrige-65-20260923.md`, joint à ce lot.

**Choix explicite, à confirmer ou infirmer par l'Orchestrator** : je n'ai
**pas** transporté la garde `NexusBuild`/`NexusPage` du rail ni remplacé
`window.location.pathname.split('/').pop()` par `NexusPage.identifiant()`
dans les fonctions métier (`nexusRequireAuth`, `nexusPointageArriveeManquant`,
`nexusPriseDePosteManquante`, l'IIFE de chargement des extensions). Raison
mesurée, pas supposée : `test_acces_hors_service_20260916.js` et
`test_pointage_interrupteur_global.js` **mockent `window.location`
directement**, jamais `NexusPage`, dans leurs bacs à sable `vm` — introduire
cette dépendance aurait cassé ces deux épreuves pour de bon, pas seulement
temporairement. `outils/poser-build-id.js` (§ vérifié dans son code) n'exige
d'ailleurs pas `NexusBuild` à l'exécution pour les injections dynamiques : sa
vérification agit sur le **texte source** (`?v=…` déjà présent), que la
candidate produise ses épingles via `NexusBuild.versionner()` ou via son
propre schéma `versionnerStock()` — les deux passent `outils/build.sh` sans
modification supplémentaire, revérifié en lisant `outils/poser-build-id.js`
ligne par ligne (§1-3 de `preuve-diff-...md` ne le détaille pas, mais le
constat est direct : la balise `INJECTION` ne distingue pas la source du
`?v=`, seulement sa présence).

## 4. Point matériel n°1 — 2 harnais de test à mettre à jour (pas une régression du correctif)

`test_cloture_services_obsoletes_20260916.js` et
`test_regularisation_manager_20260916.js` chargent l'**intégralité** de
`nexus-auth.js` via `vm.runInContext(SOURCE, ctx)`, avec un `ctx.window` qui
ne porte pas `NEXUS_CONFIG` (précondition qui n'existait pas dans `fe36a8e`).
Avec le correctif, ces deux fichiers échoueraient à l'ouverture du script
(`throw new Error` fail-closed), pas sur une régression fonctionnelle. Patch
d'1 ligne proposé pour chacun dans `preuve-diff-nexus-auth-corrige-65-20260923.md`
§4 — **non écrit, non exécuté** : ce canal n'a pas d'accès en écriture à
`rebuild/carburants-65-20260922`.

Les 17 autres fichiers de la liste des 19 régressions de `request-7.md` ont
été relus un par un (méthode d'extraction/bloc/texte, jamais le fichier
entier) : leur résultat est **inchangé par construction**, puisque le diff du
correctif ne touche aucune zone qu'ils lisent ou exécutent.

## 5. Point matériel n°2 — question non tranchée, signalée plutôt que résolue

`nexus-page.js` existe précisément parce que Cloudflare Pages retire
l'extension `.html` de l'URL, ce qui a déjà produit une boucle de
redirection infinie sur la prise de poste (04/09/2026, avant que `NexusPage`
n'existe). Si la candidate #65 est réellement servie via Cloudflare Pages une
fois son déploiement complet (le lot porte lui-même la preuve
`preuve-cloudflare-humaine-65-portage-1.md`), et que
`window.location.pathname.split('/').pop()` continue de comparer des noms
`.html` dans `nexus-auth.js`, **le même défaut peut réapparaître sur
`NEXUS-Pointage-v1.html`/`NEXUS-Prise-De-Poste-v1.html`** — ceux-là mêmes que
la garde `NEXUS_PAGES_SEQUENCE_OBLIGATOIRE` protège. Je n'ai pas de moyen
déterministe, depuis ce canal, de savoir si le déploiement Cloudflare de la
candidate désactive ou non le retrait d'extension (réglage possible côté
Cloudflare Pages). Je n'ai donc **ni ignoré ce risque ni tranché à sa
place** : je le remonte tel quel, avec un correctif local possible qui ne
casserait aucun test existant si l'Orchestrator le retient —
normaliser `.html` à l'intérieur de `nexusCategorieAcces` (retirer le
suffixe des deux côtés de la comparaison), sans dépendre d'un nouveau global
`NexusPage`. Non appliqué ici : c'est une modification de la logique
d'accès, même défensive, et `decision-6.md` limite le transport « aux
éléments réellement nécessaires à la chaîne build/config » — je n'ai pas
voulu l'étendre unilatéralement à une correction préventive du code d'accès.

## 6. Items 4 et 5 de la mission — non atteints, honnêtement

Aucune exécution de `node run-tests.js` sur l'arbre candidate réel : ce
canal n'a ni accès réseau à Supabase, ni permission d'écriture sur
`.github/workflows/*` ou sur `rebuild/carburants-65-20260922` — inchangé
depuis tous les réveils précédents de ce lot. Le retour à 217/224 n'est donc
**pas mesuré**, seulement déduit par construction pour 17/19 fichiers, avec
un correctif nommé mais non exécuté pour les 2 restants. L'item 5 (preuve
d'identité de preview / `nexus-config.js` réellement servi) reste hors de
portée tant que le point précédent n'est pas acquis — conformément à l'ordre
donné par la mission elle-même.

## Pour transporter et clore ce lot depuis une session outillée

```
git fetch origin rebuild/carburants-65-20260922
git checkout -b lot/nexus-auth-fusion-65 origin/rebuild/carburants-65-20260922
git checkout origin/handoff-continuite-20260920 -- \
  docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-corrige-65-20260923.js
cp docs/handoff/lots/NEXUS-CONTINUITE-TERRAIN-2-20260922/nexus-auth-corrige-65-20260923.js nexus-auth.js
# Appliquer le patch d'1 ligne (§4) à test_cloture_services_obsoletes_20260916.js
# et test_regularisation_manager_20260916.js (ajout de window.NEXUS_CONFIG dans leur ctx).
node run-tests.js   # doit revenir à 217/224, exactement les 7 CONNUS
# Si vert : reprendre l'item 5 (identité preview / nexus-config.js servi, Supabase Test).
```

## Pourquoi un humain/Orchestrator doit-il intervenir ici ?

Pas pour une décision de fondateur : les deux points ci-dessus sont
déterministes (un patch de test nommé, une question de configuration
Cloudflare vérifiable en quelques secondes par quiconque a accès au tableau
de bord Cloudflare Pages de la candidate). Ils dépassent simplement ce que ce
canal peut exécuter ou observer — exactement la même limite structurelle que
tous les réveils précédents de ce lot (pas d'écriture sur la candidate, pas
d'accès Cloudflare/Supabase). Retour demandé pour transport, pas pour
arbitrage de fond.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
migration/écriture Supabase Production, aucun déploiement Production, aucune
règle métier/UX/RLS/rôle modifiée, aucun secret créé/lu/exposé, la liste des
échecs connus n'a pas été touchée, aucune garde affaiblie.
