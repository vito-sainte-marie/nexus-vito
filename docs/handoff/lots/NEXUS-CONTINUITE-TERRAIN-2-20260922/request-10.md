---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 10
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=5b047e0 production=2bc7b39
  - id: decision8-consommee
    classe: VERIFIED
    valeur: 1b8521b-registre-marque-consomme
  - id: harnais-realignes-conformes-decision8
    classe: VERIFIED
    valeur: diffs-2-fichiers-window-config-nexus-page-reel-nexusbuild-stub-documente
  - id: harnais1-execution-reelle
    classe: VERIFIED
    valeur: 2-assertions-passees-puis-nexusServicesOuvertsDuSite-is-not-a-function
  - id: harnais2-execution-reelle
    classe: VERIFIED
    valeur: echec-premiere-assertion-0-ecritures-attendu-1
  - id: cause-regression-identifiee
    classe: VERIFIED
    valeur: git-log-p-nexus-auth-js-290a217-supprime-5-fonctions-cloture-pilote
  - id: regles-module-intact
    classe: VERIFIED
    valeur: nexus-pointage-regles-js-inchange-SOURCE_CLOTURE_PILOTE-present
  - id: refs-protegees
    classe: VERIFIED
    valeur: main-5b047e0-production-2bc7b39-candidate-664af98
  - id: suite-candidate-complete
    classe: NOT_APPLICABLE
    valeur: harnais-natteignent-pas-assertions-metier-total-sans-valeur
  - id: identite-nexus-config-servi
    classe: NOT_APPLICABLE
    valeur: subordonne-a-candidate-executable-non-atteinte
  - id: cloudflare-html
    classe: NOT_APPLICABLE
    valeur: non-tranchee-conformement-a-decision-7
  - id: nexus-auth-modifie
    classe: NOT_APPLICABLE
    valeur: aucune-modification-interdite-par-decision-8
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Harnais réalignés (`decision-8.md` §2) — exécution réelle, régression matérielle trouvée dans `nexus-auth.js`

Exécution du réveil « poursuite déterministe du lot actif, sans gate Créateur ». `decision-8.md`
consommée via `outils/handoff.js` avant tout le reste de ce travail.

## 1. Ce qui a été fait, exactement le périmètre autorisé

Les deux harnais (`test_regularisation_manager_20260916.js`,
`test_cloture_services_obsoletes_20260916.js`) ont été réalignés sur les préconditions runtime de
`nexus-auth.js`, conformément à `decision-8.md` §2 : `window.NEXUS_CONFIG` conservé ; le vrai
`nexus-page.js` committé de la candidate chargé/exécuté dans le même contexte `vm` (jamais réinventé
dans un stub, même raccourci que `test_pointage_interrupteur_global.js` déjà sur le rail) ; `NexusBuild`
reçoit un stub minimal documenté (`{ versionner: s => s }`), vérifié au préalable qu'aucune assertion
des deux fichiers ne dépend de sa sortie réelle. Aucune modification de `nexus-auth.js`, aucune
assertion métier changée, aucun `nexus-build.js` généré ou commité. Diffs exacts, refs protégées et
sortie mesurée dans `preuve-harnais-realignes-regression-fonctions-pilote-65-1.md`.

Le point 1 de `decision-8.md` (correctif `nexus-auth-corrige-65-20260923.js` obsolète, ne pas
transporter) est confirmé sans code supplémentaire — inchangé depuis `request-9.md`.

## 2. Résultat réel de l'exécution — les harnais chargent, mais n'atteignent pas leurs assertions métier

`test_regularisation_manager_20260916.js` : les deux premières assertions passent, puis
`✗ ctx.nexusServicesOuvertsDuSite is not a function`.

`test_cloture_services_obsoletes_20260916.js` : échoue dès sa première assertion réelle —
`✗ exactement une écriture` (`0 !== 1`).

Conformément à `decision-8.md` §3/STOP, **la suite candidate complète n'a pas été exécutée** : les
deux harnais n'atteignent pas leurs assertions métier, un total de suite serait sans valeur.

## 3. La cause n'est pas un défaut de harnais — c'est une régression matérielle déjà committée sur la candidate

`nexus-auth.js` de la candidate ne définit plus **aucune** des cinq fonctions du cycle de clôture
pilote (`nexusReglesPilote`, `nexusAppliquerCloturePilote`, `nexusCloturerServicesObsoletes`,
`nexusRegulariserServicesObsoletes`, `nexusServicesOuvertsDuSite`), ni la lecture du fuseau du site
dans `nexusServiceCourant` — vérifié par `grep`, 0 occurrence.

Retracé par `git log -p nexus-auth.js` sur `rebuild/carburants-65-20260922` : ces fonctions ont été
ajoutées par `cdc3332`/`4e1b4c3` (16/09/2026), puis **effacées par `290a217`**
(« rebuild(65): porter la chaine de build/config du rail (7 fichiers, mecanique) », 22/09/2026
21:21:58) — commit qui a remplacé `nexus-auth.js` presque intégralement (867 lignes supprimées,
mesuré par `git show --stat`) en le recopiant depuis le rail canonique, lequel n'a jamais porté cette
fonctionnalité. Ce même portage est celui que `request-9.md` §2 avait déjà identifié comme rendant le
`nexus-auth.js` de la candidate octet-pour-octet identique à celui du rail — j'ignorais alors que ce
portage avait aussi supprimé du code métier propre à la candidate, faute d'avoir exécuté les deux
harnais jusqu'à leurs assertions réelles. Aucun commit depuis `290a217` ne touche `nexus-auth.js` ; le
seul commit plus récent (`664af98`) ne touche que `.github/workflows/tests.yml`.

Le module de règles `nexus-pointage-regles.js` dont ces fonctions dépendaient est, lui, **intact** sur
la candidate (`SOURCE_CLOTURE_PILOTE`, `servicesObsoletes`, etc. toujours présents) : seule la partie
appelante a disparu. Détail complet dans le fichier de preuve §4.

## 4. Pourquoi ce retour, plutôt qu'une correction appliquée

`decision-8.md` interdit explicitement de modifier `nexus-auth.js`, et §5 ne couvre que « un simple
problème de transport Git non-Production » — ce qui n'est pas le cas ici : il ne s'agit pas de code
prêt à transporter mais bloqué techniquement, il s'agit de code métier déjà committé sur la candidate
puis effacé par un commit ultérieur de la même branche. Le reconstruire est un choix de contenu
(quelle version restaurer, comment la faire cohabiter avec `NexusPage`/`NexusBuild`, ajoutés après ces
fonctions) — hors du périmètre outillage/QA pur de l'arbitrage a posteriori, et explicitement hors du
périmètre autorisé par `decision-8.md` pour cette session.

## 5. Gates inchangées, non avancées

La preuve d'identité `nexus-config.js` réellement servi vers Supabase Test n'a pas été tentée (suppose
une candidate exécutable). La question Cloudflare/`.html` reste non observée, non touchée, aucune
correction préventive — inchangé depuis `decision-7.md`.

## Guardians

- **Architecture & Cohérence** : la régression est documentée avec preuve `git log -p`/`git show
  --stat`, pas supposée ; le module de règles intact est distingué du module appelant régressé.
- **Security & Isolation** : aucun secret lu/créé/exposé ; aucune opération réseau/Supabase ; zone de
  travail locale supprimée avant la fin de la session (`git status` propre).
- **Business Rules** : aucune règle métier/UX/RLS/rôle touchée ni décidée ; la restauration de la
  fonctionnalité perdue est explicitement renvoyée à un arbitrage, pas décidée ici.
- **QA/Regression** : les deux échecs rapportés sont mesurés par exécution réelle, message exact
  reproductible ; aucun total de suite globale affirmé sans exécution complète réussie.
- **Bible/Philosophie** : préférence donnée à retracer la cause exacte (`git log -p`, pas une
  supposition) plutôt que de rapporter un échec de harnais sans en chercher la racine.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture Supabase
Production, aucun déploiement/promotion Production, aucune nouvelle règle métier/UX/RLS/rôle, aucun
secret créé/lu/exposé. Aucun fichier de la candidate modifié depuis ce canal.

## Proposition pour la suite, à arbitrer, pas décidée ici

1. **Restaurer la fonctionnalité perdue** dans `nexus-auth.js` sur la candidate, en réconciliant le
   contenu de `cdc3332`/`4e1b4c3` avec les conventions `NexusPage`/`NexusBuild` introduites par
   `290a217` (ni un simple `git revert`, ni une recopie aveugle) — travail de relecture, pas mécanique.
2. Une fois restaurée, réexécuter les deux harnais réalignés (déjà prêts, diffs fournis) : ils
   devraient alors atteindre leurs assertions métier sans changement supplémentaire.
3. Seulement ensuite : suite candidate complète, preuve d'identité `nexus-config.js`, question
   Cloudflare/`.html`, recette navigateur.
