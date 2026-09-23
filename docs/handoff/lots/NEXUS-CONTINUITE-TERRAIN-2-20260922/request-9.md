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
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0-production=2bc7b39-inchangees
  - id: depot-2029-reverifie
    classe: VERIFIED
    valeur: plus1-commit-0-behind-delta-limite-docs-handoff
  - id: harnais-garde-reparee
    classe: VERIFIED
    valeur: 2-fichiers-executes-depassent-NEXUS_CONFIG-NexusBuild-NexusPage
  - id: mutation-negative-alias-window
    classe: VERIFIED
    valeur: retrait-ctx-window-ctx-reproduit-echec-nexus-page-non-charge
  - id: fe36a8e-ancetre-candidate
    classe: VERIFIED
    valeur: merge-base-is-ancestor-confirme
  - id: candidate-nexus-auth-identique-config-par-environnement
    classe: VERIFIED
    valeur: diff-local-vide-305-lignes
  - id: candidate-nexus-auth-perd-13-fonctions-vs-fe36a8e
    classe: VERIFIED
    valeur: 932-vers-305-lignes-grep-zero-occurrence
  - id: harnais-1-echec-mesure
    classe: VERIFIED
    valeur: nexusServicesOuvertsDuSite-is-not-a-function
  - id: harnais-2-echec-mesure
    classe: VERIFIED
    valeur: exactement-une-ecriture-0-not-1
  - id: aucune-affirmation-suite-globale
    classe: VERIFIED
    valeur: seuls-2-fichiers-et-un-controle-mutation-rapportes
  - id: ecriture-candidate
    classe: NOT_APPLICABLE
    valeur: git-push-dry-run-reteste-refuse-approbation
  - id: cloudflare-html
    classe: NOT_APPLICABLE
    valeur: non-tranchee-conformement-a-decision-7
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Harnais réparés et exécutés — contradiction plus profonde trouvée, transport toujours non fait

Exécution du réveil « poursuite Handoff déterministe, arbitrage technique nexus-auth/harnais ».
Repris depuis `origin/claude/issue-28-20260923-2029` (`3daf270`, +1 commit / 0 behind sur `46a5e34`,
delta limité à `docs/handoff/`) — revérifié indépendamment, pas recopié. Le point « correctif
nexus-auth » est traité comme clos par l'arbitrage transmis : `290a217` couvre déjà, plus complètement,
ce que visait `nexus-auth-corrige-65-20260923.js`. **Ce fichier n'a pas été transporté.**

## 1. Les deux harnais sont réparés et RÉELLEMENT exécutés — la garde de chargement fonctionne

Adaptation appliquée dans une zone de travail locale (jamais commitée sur aucune branche, supprimée
avant la fin de cette session — `git status` propre confirmé) à `test_regularisation_manager_20260916.js`
et `test_cloture_services_obsoletes_20260916.js`, extraits de `origin/rebuild/carburants-65-20260922`
(`664af98`, tip actuel — un commit CI, `ci: aligner la garde build du candidat carburants #65`,
existe désormais après `290a217`, sans rapport avec ce qui suit) :

- `window.NEXUS_CONFIG` de test ajouté (déjà autorisé par `decision-7.md` Point 1) ;
- **le vrai `nexus-page.js`** de la candidate est chargé via `vm.runInContext`, jamais réimplémenté —
  mais un `ctx.window` séparé de `ctx` (comme le posait le banc existant) empêche `NexusPage` d'atterrir
  en identifiant nu, parce que `nexus-page.js` écrit sur `window` en supposant `window === globalThis`,
  exactement comme un vrai navigateur. Correction : `ctx.window = ctx` (alias), pas un stub — c'est
  cette ligne, et elle seule, qui a été retestée négativement (retirée : l'échec exact
  « nexus-page.js n'a pas été chargé » réapparaît ; restaurée : il disparaît) ;
- `NexusBuild` reste un **stub borné au seul contrat `versionner()`** lu dans
  `outils/poser-build-id.js` (`src + '?v=' + IDENTITE.id`) — jamais de génération réelle, jamais
  d'appel à `outils/poser-build-id.js`, jamais d'artefact de build produit ou committé.

**Résultat mesuré, avec ce seul patch** : les deux fichiers dépassent désormais entièrement la garde
de chargement (`NEXUS_CONFIG` → `NexusBuild` → `NexusPage`) — confirmé par une régression négative
indépendante (garde retirée artificiellement → échec exact `nexus-page.js n'a pas été chargé`
reproduit hors des deux fichiers, dans un script de contrôle séparé). Ce n'est plus le point qui
bloque l'un ou l'autre.

## 2. Contradiction plus profonde trouvée en exécutant réellement la suite : `290a217` a aussi effacé la fonctionnalité que les deux harnais existent pour éprouver

Une fois la garde franchie, chaque harnais échoue sur une assertion **différente et sans rapport avec
le chargement** :

- `test_regularisation_manager_20260916.js` : `ctx.nexusServicesOuvertsDuSite is not a function`.
- `test_cloture_services_obsoletes_20260916.js` : première assertion réelle exécutée,
  `exactement une écriture` → `0 !== 1` (`nexusServiceCourant` ne ferme plus aucun service).

**Vérifié, pas supposé** : `nexus-auth.js` de la candidate (`664af98`) est **octet pour octet
identique** à celui d'`origin/config-par-environnement` (`diff` local, vide) — ce n'est PAS
`origin/main` (105 lignes, une version encore plus ancienne, hors sujet). Comparé à `fe36a8e`
(ancêtre confirmé par `git merge-base --is-ancestor`, immédiatement AVANT `290a217` sur la lignée de
la candidate elle-même) : `932` lignes → `305` lignes. `git show 290a217 --stat` confirme
`nexus-auth.js | 867 ++++++-----------------------------------` dans un commit qui se décrit
lui-même comme « mécanique ».

**13 fonctions présentes dans `fe36a8e:nexus-auth.js`, absentes de la candidate aujourd'hui**,
recherchées une à une (`grep` sur le fichier extrait, zéro occurrence, y compris comme sous-chaîne
« regulariser ») : `nexusCategorieAcces`, `nexusPageExigeServiceOperationnel`,
`nexusEcranOperationnelAtteignable`, `nexusEstManager`, `nexusReglesPilote`,
`nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`, `nexusServicesOuvertsDuSite`,
`nexusRegulariserServicesObsoletes`, `nexusFuseauValide`, `nexusRetenirFuseau`, `nexusJourDansFuseau`,
`nexusFuseauSite`. `nexusServiceCourant` existe encore mais dans une version antérieure (celle de
`config-par-environnement`, datée S-4/05-09) qui **ignore** un service ouvert la veille (`console.error`
seulement) au lieu de le **refermer** — exactement le comportement que P-1/P-2/P-3 (16/09/2026,
l'incident des 1028 minutes de retard écrit en base) avaient corrigé sur la lignée de la candidate.

**Diagnostic** : `290a217` — un portage « mécanique » de la chaîne build/config depuis
`config-par-environnement` — a **remplacé intégralement** `nexus-auth.js` de la candidate par celui de
`config-par-environnement`, au lieu d'y **fusionner** uniquement les blocs `NEXUS_CONFIG`/`NexusBuild`/
`NexusPage`. `config-par-environnement` avait ces gardes mais pas les corrections de continuité
terrain accumulées sur la candidate depuis (S-1 à P-3, 05/09 → 16/09 et au-delà) ; la candidate avait
l'inverse. Le remplacement intégral a gagné les gardes et perdu treize fonctions et la totalité de la
fonctionnalité que ces deux harnais — écrits le 16/09/2026 précisément pour ces corrections — existent
pour éprouver. Ce n'est pas un défaut des harnais : ce sont eux qui l'ont détecté.

## 3. Pourquoi ce retour s'arrête ici, sans corriger

Réparer le harnais ne suffit plus à le faire passer, et la cause n'est ni un défaut de banc de test ni
une ambiguïté de construction : c'est une perte réelle de logique produit sur la branche candidate,
bien au-delà du périmètre « remise en conformité des harnais avec l'environnement runtime actuel ».
Réimplémenter ces treize fonctions ou stuber leur absence irait très exactement à l'encontre de
l'instruction reçue (« si le stub masque une assertion […] ARRÊT, ne pas élargir silencieusement ») —
même si ce n'est pas la variante « artefact de build » anticipée, c'est la même famille de risque, en
plus grave : un stub ici ne masquerait pas un détail de harnais, il masquerait la disparition d'une
fonctionnalité métier livrée en Production.

Aucune correction n'a été tentée sur `nexus-auth.js` ni sur aucun fichier de la candidate. Aucune
fusion, aucun cherry-pick, aucune décision de savoir quelle version doit l'emporter n'a été prise —
c'est un choix qui touche à la fois la chaîne de build (`NEXUS_CONFIG`/`NexusBuild`/`NexusPage`,
nécessaire à Cloudflare) et des semaines de corrections de continuité terrain déjà arbitrées par
Frédéric dans `NEXUS-CONTINUITE-TERRAIN-1-20260920`. Ce n'est pas déterministe ; ça mérite un
arbitrage explicite plutôt qu'une résolution silencieuse par un canal Handoff.

## 4. Aucune affirmation de suite globale non exécutée

Ce qui est affirmé ici est strictement ce qui a été exécuté dans cette session : 2 fichiers de
harnais, chacun rejoué à deux reprises (sans le patch de garde — échec déjà connu confirmé identique
à `request-9.md ; avec le patch de garde complet — échec nouveau et différent, message exact cité),
plus un script de contrôle séparé pour la mutation négative de l'alias `window`. Aucun autre fichier
de la candidate n'a été exécuté ni supposé vert. Aucun total `X/Y` n'est cité.

## 5. Ce qui reste hors de portée de ce canal — inchangé

- Aucune écriture sur `rebuild/carburants-65-20260922` : `git push --dry-run` vers cette branche
  refuse une approbation qu'aucun humain ne peut donner dans ce run automatisé — retesté explicitement
  dans cette session.
- La gate Cloudflare (`nexus-config.js` réellement servi ⇒ Supabase Test exclusif) et la question
  `.html` restent distinctes et **non traitées ici**, conformément à `decision-7.md`.
- Aucune opération réseau vers Supabase Test ou Cloudflare Pages.

## Guardians (pour ce qui a été exécuté)

- **Architecture & Cohérence** : la contradiction (remplacement intégral au lieu d'une fusion
  sélective) est documentée avec preuve de diff, pas corrigée en silence ; aucun fichier de la
  candidate modifié depuis ce canal.
- **Security & Isolation** : aucun secret lu, créé ou exposé ; aucune opération réseau/Supabase ;
  zone de travail locale supprimée avant la fin de la session (`git status` propre, vérifié).
- **Business Rules** : aucune règle métier/UX/RLS/rôle modifiée ; la perte constatée EST une règle
  métier (clôture des services obsolètes, régularisation manager) — signalée, pas requalifiée.
- **QA/Regression** : les deux nouveaux échecs sont mesurés avec message exact reproductible, la
  garde de chargement est prouvée par mutation négative indépendante, aucun total de suite globale
  affirmé.
- **Bible/Philosophie** : préférence donnée à rapporter une contradiction matérielle plus profonde que
  celle attendue, plutôt qu'à la masquer par un stub qui ferait « passer » un harnais sur une
  fonctionnalité absente — conforme à l'exigence explicite du réveil.

## Proposition pour la suite, à arbitrer, pas décidée ici

1. **Reconstruire `nexus-auth.js` de la candidate par fusion**, pas par remplacement : partir de
   `fe36a8e:nexus-auth.js` (932 lignes, toute la continuité terrain) et n'y importer QUE les blocs
   ajoutés par `290a217` (garde `NEXUS_CONFIG`, garde `NexusBuild`, garde `NexusPage`, et les
   remplacements `window.location.pathname.split('/').pop()` → `NexusPage.identifiant()` /
   `.includes(page)` → `NexusPage.est(...)` / `versionnerStock(...)` → `NexusBuild.versionner(...)`).
   C'est un travail de fusion manuelle guidé par diff, pas mécanique — exactement ce que `290a217`
   n'était pas.
2. **Ou** : traiter ceci comme un arrêt de la candidate #65 sur ce point précis, et réclamer que la
   chaîne de build soit portée par un patch minimal et ciblé sur la candidate actuelle plutôt que par
   un remplacement de fichier depuis une autre branche.

Les deux options touchent à la fois Architecture (build chain) et Business Rules (continuité terrain)
et ne sont pas déterministes au sens de Gouvernance Autonome v2 — d'où ce retour plutôt qu'un choix
unilatéral.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture/promotion
Production, aucune nouvelle règle métier/UX/RLS/rôle décidée, aucun secret créé/lu/exposé. Aucun
fichier extrait n'a été commité sur quelque branche que ce soit ; la zone de travail locale a été
supprimée avant la fin de cette session (`git status` propre, vérifié après suppression).
