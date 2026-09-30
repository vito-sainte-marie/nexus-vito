---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-2-20260922
seq: 19
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=4a49bf4 production=2bc7b39
  - id: semis-cause-racine
    classe: VERIFIED
    valeur: 3-fichiers-absents-repetition-recette-carburants-garde-mode-environnement-config-station-test
  - id: semis-compat-engine
    classe: DECLARED
    valeur: analyse-statique-non-rejouee-faute-checkout-candidate
  - id: guard-reds-classement
    classe: VERIFIED
    valeur: 6-sur-7-deja-dans-ECHECS-CONNUS-json-QA-007
  - id: ecran-operationnel-atteignable
    classe: VERIFIED
    valeur: deja-exclu-decision-9-md-section-2
  - id: refs-protegees
    classe: VERIFIED
    valeur: main-et-production-non-touchees
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucun-deploiement
---
# Diagnostic des deux rouges `#65` — cause racine identifiée, correction NON appliquée (canal sans écriture sur la candidate)

Déposée au titre de **Q76** (arbitrage a posteriori pour outillage, gardes, tests et CI) :
aucune de ces investigations ne touche l'applicatif, la base ou Production. Elle ne remplace
pas `request-18.md`, qui reste en attente sur son propre sujet (`issues: write`).

## 0. Ce que ce canal peut et ne peut pas faire, vérifié avant tout le reste

`HEAD` de ce checkout est `634dec8` = `origin/handoff-continuite-20260920`. La candidate
`rebuild/carburants-65-20260922` (HEAD mesuré `b24cda4`, confirmé identique à celui donné par
le réveil) a été lue **exclusivement** par `git show <ref>:<chemin>` et `git diff <refA> <refB>`
— jamais par `git checkout`/`git archive`/`git fetch`, refusés par ce canal (confirmation
supplémentaire du constat déjà posé dans `request-17.md` : ce jeton n'a pas `push`). Aucune
écriture sur `rebuild/carburants-65-20260922` n'a donc été tentée, et aucune ne pouvait l'être.

## 1. Semis Carburants — cause racine, PAS un fichier absent par accident

`recette-candidat-65.yml` (présent uniquement sur la candidate) appelle en ligne 224
`node outils/repetition-recette-carburants.js --comparer` et en ligne 233
`node outils/garde-mode-environnement.js`. Les deux fichiers sont **absents** de la candidate
(`git show origin/rebuild/carburants-65-20260922:outils/repetition-recette-carburants.js` →
`fatal: path ... exists on disk, but not in 'origin/rebuild/carburants-65-20260922'`), présents
et à jour sur `handoff-continuite-20260920`. Un troisième fichier qu'ils chargent,
`docs/recettes/config-station-test.json`, est également absent de la candidate.

**Ce qui s'est réellement passé** : le commit `b24cda4` (« transporter le semis Carburants Test
requis par la recette ») a porté `outils/recette-carburants-test.sql` — vérifié **octet pour
octet identique** entre les deux branches (`git diff` vide) — mais pas les deux scripts qui
l'accompagnent. Le semis SQL passerait ; c'est la comparaison qui le suit qui casse sur
`MODULE_NOT_FOUND`.

**Ce qui rend le port NON trivial, vérifié avant de le proposer** : les moteurs Carburants ont
divergé entre les deux branches depuis leur ancêtre commun (`nexus-carburant-moteur.js`,
`nexus-carburant-commande-donnees-core.js`, `nexus-carburants-p0-fixes.js` diffèrent tous les
trois). Le plus notable : `handoff-continuite` a durci `evaluerCommandeCarburantSite` le
25/09/2026 pour **exiger** `options.timezone` (fail-closed) après un vrai bug terrain (jour de
semaine faux entre 20 h et minuit heure station, UTC vs local) ; la candidate garde l'ancien
contrat, sans cette exigence.

J'ai vérifié — pas supposé — que ceci ne compromet PAS le scénario semé : `repetition-recette-
carburants.js` (version canonique) passe explicitement `{ timezone, dateISO, heureHHMM,
maintenant }` à chaque appel (ligne 261-263), donc ni l'ancien ni le nouveau contrat ne retombe
sur une résolution implicite d'horloge. Le seul autre point de divergence
(`limiteRemplissageL`, CARB-007) est un pur regroupement de propriétaire : la formule
(`somme des limite_remplissage`) est identique des deux côtés, seule l'adresse du code diffère.
**Sous réserve de cette analyse statique — non rejouée faute d'exécution possible contre l'arbre
de la candidate depuis ce canal (voir §0)** — porter les trois fichiers ci-dessus tels quels
depuis `handoff-continuite-20260920` devrait suffire à faire passer le semis.

**Correction non appliquée** : `outils/handoff.js` ne donne aucune écriture sur
`rebuild/carburants-65-20260922` à ce jeton. Décrite ici pour transport, conformément à
`decision-9.md §5` de ce même lot (« Si Claude ne peut pas écrire directement sur la candidate,
préparer un commit atomique sur une branche de travail persistante avec le diff exact et les
preuves, puis revenir au rail »).

## 2. Rouges de garde run 36706017214 — six DÉJÀ classés, un DÉJÀ exclu par décision, zéro nouveau identifié

Chacun des six symptômes cités correspond **mot pour mot** à une entrée déjà établie dans le
registre canonique `docs/qa/ECHECS-CONNUS.json` (mesuré le 08-09/09/2026, motif QA-007, lu sur
`handoff-continuite-20260920`, présent sur ce checkout) :

| Symptôme cité dans le réveil | Fichier | Classement canonique existant |
|---|---|---|
| `estComptageDeuxLieuxEmploye` (x2) | `test_inventaire_categorie_mixte_deux_lieux.js`, `test_inventaire_sprint4_ux_flash.js` | TEST PAR DÉCOUPE — extraction par comptage d'accolades incomplète ; « aucun défaut applicatif : le navigateur charge le bloc entier, où la fonction existe bien » |
| `modeTestInventaireActif` (x2) | `test_inventaire_production_journaliere_q1.js`, `test_inventaire_sprint4bis_ecriture_immediate.js` | Même mécanisme, même famille |
| `document.addEventListener is not a function` | `test_pilotage_qualite_receptions.js` | SIMULACRE INCOMPLET — le faux `document` du test ne déclare pas `addEventListener` ; « un vrai document possède la méthode » |
| `Mod.calculerReceptionCorrigee is not a function` | `test_reception_moteur.js` | Même registre |
| `demarrerReception is not defined` | `test_reception_v1_dom.js` | Même registre |

Les sept fichiers de la liste `CONNUS` figée dans `recette-candidat-65.yml`/`tests.yml` de la
candidate reprennent déjà exactement ces sept fichiers — donc si le run les a signalés comme
« nouveaux », ce n'est pas parce que leur cause diffère de celle établie le 09/09/2026, c'est que
la liste figée sur la candidate n'a pas suivi. **Aucun de ces six symptômes ne relève d'une
régression `#65` ni ne justifie une correction de cause racine dans ce lot** : le registre
canonique les qualifie tous « aucun défaut applicatif », et les y toucher maintenant équivaudrait
à corriger un harnais de test daté et non lié à `#65`.

`nexusEcranOperationnelAtteignable` — le septième nom cité dans le réveil — est un cas
**différent et déjà tranché**, pas un rouge à classer ici. `decision-9.md` de ce même lot
(`APPROVED_WITH_CONDITIONS`, §2) exclut **explicitement** sa restauration : « Ne pas restaurer
dans ce geste la classification d'accès/navigation (…) `nexusEcranOperationnelAtteignable`. Ces
écarts sont réels mais distincts ; les traiter ici élargirait le périmètre UX au-delà de la
restauration minimale démontrée. » Une proposition de lot séparé existe déjà et n'est pas ouverte
(`proposition-lot-classification-acces-rail-1.md`). Le corriger dans ce lot violerait une
décision déjà rendue par Frédéric — je ne l'ai donc pas fait, conformément à l'interdit explicite
du réveil de ne pas dériver l'autorité.

**Conséquence pratique** : rien dans le §2 ne demande de code. Le seul geste utile identifié est
de mettre à jour la liste `CONNUS` de `recette-candidat-65.yml` sur la candidate pour qu'elle
cite les mêmes sept fichiers que `docs/qa/ECHECS-CONNUS.json` — un geste de FORME sur la
candidate, hors de portée d'écriture de ce canal, à faire par la même session qui portera le §1.

## 3. Ce que cette session n'a pas fait, et pourquoi (items C à H du réveil)

Rien n'a été poussé sur `rebuild/carburants-65-20260922` (§0). Par construction, aucune boucle
CI n'a donc pu être bouclée, aucune recette navigateur Test connectée n'a été exécutée, et aucune
préparation de handoff Production (migrations, empreinte, diff final) n'a été entamée : la
condition « CI candidate verte » posée par `decision-9.md §4` n'est pas remplie, et l'engager
maintenant produirait un dossier de gate Production sur une base non prouvée — exactement ce que
`decision-9.md` et les interdits du réveil excluent.

## 4. Capitalisation demandée par le réveil — proposition, non appliquée

Deux gardes concrètes, proposées mais **non câblées** (édition de `.github/workflows/*.yml` hors
permission de ce canal) :

1. **Préflight d'existence des scripts appelés** : avant tout `node outils/X.js` dans un
   workflow, une étape unique qui relit le YAML du job et vérifie que chaque script qu'il invoque
   existe dans le checkout — aurait transformé ce `MODULE_NOT_FOUND` en un message nommant le
   fichier manquant AVANT le semis, jamais après.
2. **Liste `CONNUS` dérivée, jamais dupliquée** : `recette-candidat-65.yml` et `tests.yml`
   recopient chacun leur propre liste figée ; `docs/qa/ECHECS-CONNUS.json` existe précisément pour
   n'avoir qu'un seul propriétaire (note du fichier : « deux copies d'une même vérité, c'est
   toujours celle qu'on oublie qui se met à mentir »). Faire lire cette liste depuis le JSON par
   les deux workflows aurait rendu ce §2 entier impossible à observer.

Aucune des deux n'a été ajoutée à `docs/learning/RULES.json`/`EXPERIENCE.jsonl` par cette
session : ce sont des propositions d'outillage CI, pas encore des leçons éprouvées par mutation
sur le rail lui-même.

## Interdits respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucun déploiement/promotion
Production, aucun secret lu ou exposé, aucune correction de `nexusEcranOperationnelAtteignable`
(décision déjà rendue), aucune écriture sur `rebuild/carburants-65-20260922` (hors de portée
technique de ce canal), aucun vert de complaisance — le registre `ECHECS-CONNUS.json` cité ici
est repris tel quel, jamais élargi ni maquillé pour cette session.
