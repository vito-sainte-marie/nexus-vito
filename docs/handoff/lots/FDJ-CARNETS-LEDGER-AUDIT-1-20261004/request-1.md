---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 1
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: bug-reconciliation-corrige
    classe: VERIFIED
    valeur: soldesCarnetsAvecReference,mutation-confirmee,21-21
  - id: regression-fdj
    classe: VERIFIED
    valeur: node-run-tests.js-fdj-34-34
  - id: regression-globale
    classe: VERIFIED
    valeur: 292-301-9-echecs-historiques-identiques
  - id: idempotency-gap-manager
    classe: VERIFIED
    valeur: 6-sur-9-ecritures-sans-idempotency-key,grep-exhaustif
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucun-identifiant-supabase-dans-ce-canal,sql-prepare
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration
---
# Audit systémique des mouvements de carnets FDJ — cause racine trouvée et corrigée, deux points bloquants restants

Réponse au réveil Orchestrateur de l'issue #28 (04/10/2026, `@claude` /
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`) : « PRIORITÉ FDJ — ANOMALIE
POTENTIELLE INVENTAIRE / MOUVEMENTS DES CARNETS ». Constat terrain :
l'inventaire et les mouvements des carnets FDJ paraissent incohérents.

## 0. Ce qui a été lu avant d'écrire une ligne de code

`docs/handoff/STATE.json` (lu avant toute écriture) : `lot_actif` =
`FDJ-VAGUE1-REPRISE-20261003`, `statut: DECISION_CONSOMMEE` — **hors**
`STATUTS_LOT_ACTIFS`. Aucune demande non consommée n'interdisait l'ouverture
de ce nouveau lot. `node outils/handoff.js verifier` conforme avant toute
écriture (33 lots, 16 avertissements, 11 dérogations — tous préexistants, 0
nouvelle erreur).

Lu intégralement avant de juger quoi que ce soit : `nexus-fdj-moteur.js`
(1948 lignes), `NEXUS-FDJ-v1.html` et `NEXUS-FDJ-Manager-v1.html` (les
fonctions qui écrivent dans `fdj_stock_movements`), les migrations
`20260809130450_creer_schema_fdj_v1.sql`,
`20260810011853_fdj_stock_references_inventaire_zero.sql`,
`20260818135117_fdj_fiabilisation_etape5_idempotence.sql`,
`20260916220400_fdj_mouvements_auteur_et_date_effet.sql`,
`20260916221000_fdj_commandes_activations_et_mouvements.sql`, l'historique
git de `nexus-fdj-moteur.js` (pour dater chaque producteur de mouvement), et
le lot `FDJ-VAGUE1-REPRISE-20261003` au complet (requests/decisions 1 à 9)
pour ne pas rouvrir un sujet déjà tranché.

## 1. Cycle de vie canonique d'un carnet (tel qu'il existe réellement)

NEXUS suit les carnets FDJ **par quantité agrégée, par jeu et par site** —
jamais par carnet individuel. `fdj_booklets` (carnet nominatif, numéro de
série, scanner) existe dans le schéma depuis le 09/08/2026 mais n'est
alimenté par **aucun** écran, ni manager ni employé (0 ligne, aucune
référence dans le code, déjà documenté comme tel dans
`NEXUS-FDJ-Manager-v1.html:3461-3466`). Ce n'est pas un défaut de ce lot :
c'est une limite assumée et déjà écrite, pas une découverte.

Un carnet transite par un seul état par jeu/site (jamais par carnet) :

```
Fournisseur ──reception──▶ Bureau ──transfert──▶ Caisse (confié, non activé)
                 ▲                                      │
                 └──retour (depuis bloqué)──┐            │ activation
                                             │            ▼
                             Zone bloquée ◀──┴──blocage── Activé (vendu)
```

Table pivot : `fdj_stock_movements` (`type_mouvement` ∈ reception / transfert
/ retour / blocage / activation / correction), append-only — confirmé par
lecture de **toutes** les migrations touchant cette table (`grep` ciblé) :
**aucune** n'a jamais ajouté de policy RLS `update`/`delete`. Seules `select`
et `insert` existent depuis la création du schéma. Le point zéro périodique
(`fdj_stock_references` + `fdj_stock_reference_lignes`, contrôle physique
Bureau + Caisse) absorbe l'historique antérieur sans jamais réécrire un
mouvement — exactement le modèle demandé par la mission (réconciliation
`stock théorique + entrées − sorties ± corrections = stock théorique
courant`, comparé à un comptage réel).

**Source de vérité unique, confirmée, pas dupliquée** : une seule fonction,
`NexusFdjMoteur.soldesCarnetsAvecReference` (`nexus-fdj-moteur.js`), calcule
ce solde — consommée par l'écran employé, l'écran manager (État du stock),
l'Analyse, le Brief et le Coach FDJ (vérifié par recherche exhaustive de ses
appelants). Une fonction plus ancienne, `soldesCarnetsParJeu` (V1), existe
encore dans le fichier mais n'est appelée par **aucun** écran — code mort,
pas un second chemin de vérité actif.

## 2. Cartographie exhaustive des écritures (mission, point 1)

| Écran | Action | Fonction | Table(s) | Mouvement écrit | Qui dans `employee_id` |
|---|---|---|---|---|---|
| `NEXUS-FDJ-v1.html` (employé) | Activer un carnet en caisse | `executerActivationCarnetInterne` | `fdj_stock_movements` (+`fdj_shift_counts.appro` via RPC atomique) | `activation`, +1, caisse→caisse | employé (correct) |
| idem | Activation déduite de l'appro à la clôture | `creerActivationImplicite` | idem | `activation`, méthode `implicite_appro` | employé (correct) |
| `NEXUS-FDJ-Manager-v1.html` | Réapprovisionner la caisse | `enregistrerReappro` | `fdj_stock_movements` | `transfert`, bureau→caisse | manager (correct : il porte physiquement les carnets) |
| idem | Retirer des jeux de la caisse | `enregistrerRetraitCaisse` | idem | `retour`, caisse→bureau | manager (correct) |
| idem | Réceptionner un colis FDJ | `enregistrerReception` | idem | `reception`, →bureau | manager (correct) |
| idem | Rapprochement manuel (carnet manquant retrouvé) | `validerRapprochement` | idem | `activation`, méthode `saisie_manuelle`, caisse→caisse | **NULL, volontairement** — employé réel inconnu (correct) |
| idem | Signaler un retrait / blocage | `enregistrerBlocage` | idem | `blocage`, bureau/caisse→bloqué | manager (correct) |
| idem | Retourner depuis la zone bloquée | `retournerDepuisBloque` | idem | `retour`, bloqué→bureau | manager (correct) |
| idem | « Modifier ce quart FDJ » — synchroniser Appro↔Activation | `creerActivationReconstitueeCorrectionManager` | idem | `activation` (+) ou `correction` (−), caisse→caisse | manager — **voir §3, c'est la seule vraie attribution discutable, mais sans impact sur l'agrégat de stock (celui-ci ne filtre jamais par `employee_id`)** |
| `NEXUS-FDJ-Manager-v1.html` | Inventaire de référence (point zéro) | `validerInventaireRef` | `fdj_stock_references` + `fdj_stock_reference_lignes` | — (pas un mouvement, un point de référence) | `controle_par` = manager |

**Déjà déployé en Production (migration `20260916221000`, rapatriée sur le
rail le 04/10/2026, commit `67512d2`), mais encore INUTILISÉ** : deux
commandes serveur, `fdj_activer_carnet` et `fdj_enregistrer_mouvement_stock`,
qui remplacent exactement les 9 écritures directes ci-dessus — résolvent
`site`/`employee_id`/`created_by`/`effective_at` côté serveur (jamais reçus
du navigateur), génèrent une `idempotency_key` liée à `auth.uid()`
(non-forgeable pour un collègue), et refusent déjà noir sur blanc la
confusion décrite en §3. Vérifié par recherche exhaustive (`grep
"\.rpc("`) : **aucun écran ne les appelle aujourd'hui**. C'est un chemin
construit et prêt, pas encore branché — Phase B/C du lot
`FDJ-VAGUE1-REPRISE-20261003`, hors périmètre de ce lot-ci.

## 3. Le bug réel trouvé — cause racine, reproduit, corrigé, testé

**`soldesCarnetsAvecReference` routait tout mouvement `type_mouvement:
'correction'` vers `confies`/`bureau` par emplacement de destination**, un
choix écrit le 09/08/2026, **avant** qu'aucun producteur réel de
'correction' n'existe. Le seul producteur réel ajouté depuis (27/08/2026,
`creerActivationReconstitueeCorrectionManager`, écran « Modifier ce quart
FDJ » → « annuler une activation reconstituée à tort ») écrit toujours
`location_source_id = location_destination_id = caisse` (aucun déplacement
physique, même convention qu'une activation) avec une quantité négative.
Personne n'a mis à jour la fonction de lecture quand ce producteur a été
ajouté — exactement le scénario que la mission désigne : « rechercher les
doubles chemins ».

**Conséquence mesurée** (reproduite par un script avant correction, voir
`request-1.md` de cette branche pour la trace complète) : annuler une
reconstitution erronée de 2 carnets ne décrémentait **jamais** `actives`
(l'activation fautive restait comptée pour toujours) et décrémentait
`confies` à tort de 2 (comme si 2 carnets avaient physiquement quitté la
caisse, ce qui n'arrive jamais dans ce chemin). Sur un état de référence
`confiés=10, actifs=3, non-activés=7`, après reconstitution fautive (+2) puis
annulation, le système retombait sur `confiés=8, actifs=5, non-activés=3` au
lieu de `confiés=10, actifs=3, non-activés=7` — **un écart de −4 sur le
stock non-activé affiché**, alors qu'aucun carnet n'a physiquement bougé.
C'est exactement la signature « nombre impossible à justifier » du constat
terrain : une correction manager, censée remettre les choses d'aplomb,
aggravait silencieusement l'incohérence qu'elle voulait résoudre.

**Zéro test ne couvrait ce chemin** avant ce lot — recherche exhaustive dans
tous les `test_fdj_*.js` existants : aucun n'exerce `soldesCarnetsAvecReference`
ni `soldesCarnetsParJeu`, aucun ne construit de mouvement
`type_mouvement:'correction'`. Un bug réel a donc vécu, invisible, depuis le
27/08/2026.

**Corrigé** (`nexus-fdj-moteur.js`, 2 fonctions — `soldesCarnetsAvecReference`
et, par cohérence, `soldesCarnetsParJeu` bien qu'elle ne soit appelée par
aucun écran) : `correction` annule désormais `actives`, exactement comme une
`activation` de signe opposé — jamais un second mécanisme de comptage
(Article 11).

**Preuve, mutation comprise** : nouveau fichier
`test_fdj_carnets_ledger_reconciliation_20261004.js`, 21 assertions
couvrant la matrice minimale de la mission (réception→stock,
affectation→mouvement, transfert→aucune duplication par invariant de
conservation, retour→réintégration — deux variantes réelles —,
retrait(blocage)→sortie, correction→contre-écriture [le bug, avec état de
référence avant/après/attendu], point zéro, réconciliation saine→écart 0,
anomalie volontaire→divergence détectée avec signe exact, et une intégration
bout-en-bout reliant `decisionSynchronisationApproActivation` au ledger
qu'elle alimente). Mutation réelle effectuée : revenir au code d'avant
correctif fait échouer exactement 2 assertions, avec les valeurs fausses
prédites (`confies:8, actives:5` au lieu de `confies:10, actives:3`) — pas
un test qui passerait de toute façon.

## 4. Second point réel, non corrigé dans ce lot (cas limite « retry réseau »)

Recherche exhaustive des 9 écritures directes dans `fdj_stock_movements` :
**6 sur 9** (`enregistrerReappro`, `enregistrerRetraitCaisse`,
`enregistrerReception`, `validerRapprochement`, `enregistrerBlocage`,
`retournerDepuisBloque` — toutes les écritures manager « hors quart ») **ne
génèrent et n'envoient aucune `idempotency_key`**. Seules les 2 écritures
employé et la reconstitution manager (activation) en génèrent une. Les
boutons sont désactivés pendant l'écriture (`btn.disabled = true`), ce qui
empêche un double-clic, mais **pas** un rejeu réseau (requête qui atteint le
serveur, réponse perdue, nouvelle tentative) — l'index unique Postgres sur
`idempotency_key` ne peut rien dédupliquer sans clé envoyée. Pour une
réception/réapprovisionnement/retrait/blocage en lignes multiples, un rejeu
double-compte directement l'inventaire.

**Déjà résolu côté serveur** (§2) : `fdj_enregistrer_mouvement_stock` génère
sa clé à partir de `auth.uid()` + jeton d'appel. Le brancher sur ces 6 écrans
fermerait ce point définitivement — mais c'est un changement qui touche 9
points d'écriture d'écrans Production réels en usage quotidien, pas une
correction de fonction pure : proportionné à un lot dédié avec sa propre
recette (navigateur, Supabase Test), pas à rajouter ici sans la qualifier
(QA-002 : calibrer avant d'activer). Signalé, chiffré, non corrigé.

## 5. Cas limites examinés (mission, point 7)

- **Doublon de carnet / même carnet sur deux emplacements** : non applicable
  — NEXUS ne suit aucun carnet individuellement (voir §1), la question ne se
  pose qu'au niveau agrégat par jeu, déjà couvert par §3.
- **Transfert interrompu** : la quantité d'un transfert est une seule ligne
  atomique (`insert` unique) ; un échec réseau avant écriture ne laisse
  aucune trace (rien à réconcilier), un échec après écriture mais avant
  réponse client retombe dans le cas §4 (retry sans clé).
- **Suppression après validation** : impossible par construction — RLS
  `insert`+`select` seulement, aucune policy `update`/`delete` sur
  `fdj_stock_movements` depuis sa création (vérifié).
- **Correction manager** : §3.
- **Opération répétée / retry réseau** : §4.
- **Concurrence de deux actions** : l'incrément d'appro (axe tickets,
  distinct du ledger carnets) est déjà atomique côté serveur depuis le
  18/08/2026 (`fdj_incrementer_appro_shift_count`, `ON CONFLICT DO UPDATE SET
  appro = appro + delta` dans la même transaction) — vérifié non régressé.
  Le ledger carnets lui-même (`insert` simple, pas de lecture-puis-écriture)
  n'a pas de fenêtre de concurrence comparable ; son risque est celui du
  §4, pas une race.

## 6. Audit Production en lecture seule — non réalisable depuis ce canal

Confirmé, comme à chaque lot précédent de ce fil depuis le 06/09/2026: aucun
identifiant ni accès réseau Supabase (ni Test ni Production) n'est
disponible dans ce canal GitHub Issue (vérifié par test de présence des
variables d'environnement usuelles, sans jamais tenter de connexion).

Trois requêtes **strictement `SELECT`**, prêtes à être exécutées par
l'Orchestrator, dans
`docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/audit-production-lecture-seule-1.sql` :
(A) le bug du §3 a-t-il déjà écrit en Production (volume de mouvements
`correction`, par site/jeu) ; (B) candidats de double-écriture par rejeu
réseau sur les 6 chemins sans idempotency_key du §4 (paires de mouvements
quasi identiques à moins de 10 secondes d'écart) ; (C) export chronologique
brut de tout jeu ayant un mouvement `correction`, à rejouer contre la
fonction corrigée pour mesurer l'écart exact sur les données réelles plutôt
qu'un scénario synthétique.

## 7. Ce qui n'a pas été fait, et pourquoi

Aucune écriture, migration ou lecture Supabase (ni Test ni Production).
Aucun branchement des écrans sur `fdj_activer_carnet`/
`fdj_enregistrer_mouvement_stock` (§4 — changement de comportement UI réel,
hors périmètre proportionné de ce lot). Aucune correction de données
existantes — si le §6(A)/(C), une fois exécuté, révèle que le bug a
réellement corrompu un solde Production, la réparation de cette donnée est
un geste distinct, qui nécessitera son propre arbitrage (jamais une
réparation Production sans GO explicite).

## Preuves

- Commit de ce lot : voir l'enveloppe ci-dessus (`branch`, à intégrer sur
  `handoff-continuite-20260920`).
- `node test_fdj_carnets_ledger_reconciliation_20261004.js` → 21/21.
- `node run-tests.js fdj` → 34/34 (aucune régression FDJ).
- `node run-tests.js` (suite complète) → 292/301, les 9 échecs strictement
  identiques à la liste historique (`docs/qa/ECHECS-CONNUS.json` /
  comparaison affichée par le lanceur lui-même : « Aucune régression : seuls
  les 9 échecs connus subsistent »).
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt (0
  nouvelle erreur).
- Mutation réelle exécutée et observée (§3) — pas supposée.

## Verdict

**`NO_GO_FDJ_CARNETS`** — avec blocage exact :

1. Le bug de réconciliation (§3) est **corrigé et testé**, mais son
   intégration sur le rail canonique et sa portée réelle en Production
   (§6) restent à confirmer.
2. Le chemin d'écriture manager « hors quart » (6 écrans) reste exposé au
   retry réseau sans idempotency_key (§4) — déjà résolu côté serveur, pas
   encore branché côté écran. C'est le candidat naturel du prochain lot
   FDJ, proportionné à sa propre recette plutôt qu'ajouté ici sans
   qualification.

Rien n'empêche de poursuivre l'extension fonctionnelle de FDJ sur un sujet
sans lien avec les mouvements de carnets ; mais tant que (1) n'est pas
confirmé sans impact Production et que (2) n'est pas qualifié, le ledger
carnets lui-même n'est pas `PRET_POUR_RECETTE_FDJ_CARNETS`.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun
identifiant disponible), aucune promotion Production, aucun secret créé/lu/
exposé, aucun patch UI masquant une incohérence métier, aucune réécriture
d'un historique validé (append-only intact, mutation uniquement sur une
fonction de LECTURE pure, jamais sur une donnée déjà écrite).
