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
  - id: zone-jetable-construite
    classe: VERIFIED
    valeur: 64-html-tout-js-non-test-recuperes-via-git-show
  - id: poser-build-id-execute-reel
    classe: VERIFIED
    valeur: 760-references-epinglees-0-manquant-outil-inchange
  - id: harnais-guard-demarrage-franchi
    classe: VERIFIED
    valeur: nexus-config-nexus-build-nexus-page-plus-derreur-fail-closed
  - id: harnais-echec-metier-mesure
    classe: VERIFIED
    valeur: 2-fichiers-2-messages-exacts-reproduits
  - id: cause-verifiee-fonctions-absentes
    classe: VERIFIED
    valeur: grep-exhaustif-zero-occurrence-nexus-auth-js-candidate-et-rail
  - id: regles-catalogue-deja-present
    classe: VERIFIED
    valeur: nexus-pointage-regles-js-candidate-diff-plus-complet-que-le-rail
  - id: aucun-outil-partage-modifie
    classe: VERIFIED
    valeur: poser-build-id-js-handoff-js-inchanges
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Réparation des deux harnais en zone jetable — un vrai fixe, une nouvelle contradiction matérielle

Exécution de `decision-8.md` Point 3/4. Repris depuis le rail canonique
(`handoff-continuite-20260920`, HEAD `3daf270` puis `30a36f2`/`6862313` après dépôt et
consommation de `decision-8.md`).

## 1. Ce qui a été construit — une zone jetable, jamais le dépôt réel

Une zone de travail locale jamais commitée (`.scratch-decision8/candidate-tree/`, supprimée
avant la fin de cette session, `git status` propre vérifié) a reçu une copie complète des
fichiers `.html`/`.js` racine de `origin/rebuild/carburants-65-20260922` (64 `.html`, la
totalité des `.js` non-`test_`, plus les deux harnais et la migration qu'ils exigent),
récupérés un par un par `git show <ref>:<chemin>` — seule commande de lecture arborescente
disponible dans ce canal (`git ls-tree`, `git archive`, `git checkout <ref> -- <chemin>`
refusent tous une approbation qu'aucun humain ne peut donner ici, retesté explicitement).

Dans cette zone, `node outils/poser-build-id.js` — **l'outil canonique inchangé, jamais
modifié** — a été exécuté pour de vrai : `760 référence(s) épinglée(s)`, aucun `manquant`,
`nexus-build.js` réellement généré (jamais un stub). Aucun changement n'a touché
`nexus-auth.js` autre qu'un `?v=` réécrit dans un COMMENTAIRE d'exemple (ligne 4, hors code) —
comportement documenté et attendu de l'outil, sans effet sur les gardes.

## 2. Le patch de harnais réellement appliqué et exécuté

Dans les deux harnais (`test_regularisation_manager_20260916.js`,
`test_cloture_services_obsoletes_20260916.js`), dans la zone jetable uniquement :
- `window.NEXUS_CONFIG` ajouté à `ctx.window` (patch d'une ligne déjà autorisé par
  `decision-7.md` Point 1) ;
- chargement du **vrai** `nexus-page.js` (committé sur la candidate, jamais un stub) et du
  `nexus-build.js` **réellement généré** à l'étape 1 (jamais celui périmé resté committé),
  via `vm.runInContext` ;
- relais explicite `ctx.NexusPage = ctx.window.NexusPage` / `ctx.NexusBuild =
  ctx.window.NexusBuild` — nécessaire parce que ces deux fichiers écrivent sur `global` =
  `window` (vrai en navigateur, où `window` EST le global), alors que dans ce vm `ctx.window`
  est un objet distinct de `ctx` ; sans ce relais, les identifiants bruts que `nexus-auth.js`
  vérifie (`typeof NexusBuild === 'undefined'`, pas `typeof window.NexusBuild`) resteraient
  indéfinis. Aucune garde stubée : le contenu vient des deux vrais fichiers.

**Résultat mesuré, réellement exécuté** : les trois erreurs de démarrage fail-closed
(`nexus-config.js n'a pas été chargé`, puis `nexus-build.js n'a pas été chargé`) ont disparu
des deux harnais. C'est un progrès réel : la garde `NEXUS_CONFIG`/`NexusBuild`/`NexusPage`
apportée par `290a217` est désormais satisfaite par les deux bancs de test, avec les vrais
fichiers, pas des stubs.

## 3. Nouvelle contradiction matérielle trouvée — STOP conformément à `decision-8.md` Point 3

Une fois les gardes de démarrage franchies, les deux harnais échouent **différemment**, sur
une assertion métier, jamais revue :

- `test_regularisation_manager_20260916.js` : `✗ ctx.nexusServicesOuvertsDuSite is not a
  function` (après 2 assertions réussies sur le catalogue de sources de clôture) ;
- `test_cloture_services_obsoletes_20260916.js` : `✗ exactement une écriture — 0 !== 1`
  (`nexusServiceCourant` ne referme aucun service obsolète).

**Cause vérifiée par lecture, pas supposée** : `nexus-auth.js` de la candidate (octet pour
octet identique à celui du rail canonique, déjà confirmé par `request-9.md` §1) ne définit ni
`nexusServicesOuvertsDuSite`, ni `nexusCloturerServicesObsoletes`, ni
`nexusAppliquerCloturePilote` — grep exhaustif, zéro occurrence dans les deux fichiers. Seule
`nexusServiceCourant` existe, sans le comportement de clôture automatique attendu. Ce n'est pas
propre à la candidate : le `nexus-pointage-regles.js` de la candidate, lui, PORTE déjà le
catalogue complet (`MOTIF_CLOTURE_PILOTE`, `SOURCE_CLOTURE_PILOTE`, `serviceObsolete`,
`servicesObsoletes`, …) — plus complet, vérifié par diff, que celui actuellement sur le rail
canonique `handoff-continuite-20260920` lui-même. C'est donc précisément le pont entre les
règles (déjà présentes, des deux côtés) et `nexus-auth.js` (absent des deux côtés) qui manque —
une fonctionnalité produit entière (clôture pilote du 16/09/2026), pas un défaut de banc de
test.

Recherche rapide, non exhaustive, pour ne pas élargir le périmètre : la branche
`origin/cloture-des-services` existe dans ce dépôt et son nom la désigne comme candidate
naturelle pour porter cette implémentation — mais son `nexus-auth.js` ne définit pas non plus
ces trois fonctions (vérifié). L'origine réelle de l'implémentation attendue par ces deux
harnais n'a pas été identifiée dans le temps de cette session ; la retrouver dépasse le
périmètre « réparer deux harnais » et mérite un audit dédié, pas une extension silencieuse ici.

**Conformément à `decision-8.md` Point 3** (« si cette voie … révèle une nouvelle contradiction
matérielle, STOP et retour par `request-N.md` ») : ce retour s'arrête ici. Aucune tentative de
porter la fonctionnalité manquante n'a été faite — ce serait un changement métier/produit
substantiel, hors du périmètre « harnais de test » de ce lot, et sans savoir depuis quelle
source le porter fidèlement.

## 4. Ce qui n'a donc pas été entamé

Conformément à `decision-8.md` Point 4 (« si et seulement si ce point est vert »), la suite
(CI réelle sur la candidate, preuve distincte d'identité `nexus-config.js` réellement servi
vers Supabase Test, recette navigateur) n'a pas été engagée : la condition de déclenchement
n'est pas remplie. Point 5 (Cloudflare/`.html`) reste inchangé, non touché.

## Guardians (pour ce qui a été exécuté)

- **Architecture & Cohérence** : la contradiction est documentée, pas corrigée en silence ;
  aucun fichier de la candidate modifié depuis ce canal ; `outils/poser-build-id.js` utilisé
  tel quel, jamais modifié.
- **Security & Isolation** : aucun secret lu, créé ou exposé ; aucune opération réseau/
  Supabase ; zone de travail locale supprimée avant la fin de la session (`git status` propre,
  vérifié).
- **Business Rules** : aucune règle métier/UX/RLS/rôle touchée, aucune fonction métier ajoutée
  ou devinée ; l'absence constatée est rapportée comme telle, jamais comblée par une
  supposition.
- **QA/Regression** : les deux résultats rapportés sont mesurés par exécution réelle (`node`),
  avec message exact reproductible ; aucun chiffre de suite globale affirmé.
- **Bible/Philosophie** : préférence donnée à rapporter une contradiction réelle, avec sa cause
  vérifiée, plutôt que forcer une réparation qui aurait exigé d'inventer une implémentation
  métier absente des deux côtés du dépôt.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune migration/écriture
Supabase Production, aucun déploiement/promotion Production, aucune nouvelle règle
métier/UX/RLS/rôle, aucun secret créé/lu/exposé. `outils/poser-build-id.js` et
`outils/handoff.js` (hors la commande `decision` déjà existante) n'ont pas été modifiés.
