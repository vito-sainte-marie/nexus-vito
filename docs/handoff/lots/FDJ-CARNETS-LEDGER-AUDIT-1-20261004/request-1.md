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
    valeur: soldesCarnetsAvecReference-21-21-mutation-3-echecs-reels
  - id: idempotence-gap-ferme
    classe: VERIFIED
    valeur: 6-ecritures-manager-branchees-fdj_enregistrer_mouvement_stock-11-11-mutation-confirmee
  - id: regression-fdj
    classe: VERIFIED
    valeur: node-run-tests.js-fdj-35-35
  - id: regression-globale
    classe: VERIFIED
    valeur: 293-302-9-echecs-historiques-identiques
  - id: garde-langage-nexus
    classe: VERIFIED
    valeur: plafond-NEXUS-FDJ-Manager-v1.html-abaisse-114-vers-111-conforme
  - id: cartographie-site-explicite
    classe: VERIFIED
    valeur: 50-vers-47-ecritures-37-vers-36-tables-mise-a-jour-expliquee
  - id: point-zero-spec
    classe: DECLARED
    valeur: spec-point-zero-inventaire-fdj.md-redige-non-execute
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucun-identifiant-supabase-dans-ce-canal-sql-prepare
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration
---
# Inventaire / mouvements / réconciliation des carnets FDJ — correction du ledger, fermeture du gap d'idempotence

Réponse au réveil Orchestrateur de l'issue #28 (04/10/2026, `@claude` /
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`) : « SUITE PRIORITAIRE FDJ —
INVENTAIRE / MOUVEMENTS / RÉCONCILIATION DES CARNETS ».

## 0. Candidat précédent — non intégré, reconstruit

Le réveil citait le candidat `aea5406670d8a76b71bb9d40a3b3095945332858` et le
run Tests `37211093345`. Vérifié avant tout code : `git merge-base HEAD
aea5406...` = `67512d2d9...`, un ancêtre commun **deux commits en retrait**
du HEAD canonique de ce run, et aea5406 n'a jamais été fusionné sur
`handoff-continuite-20260920` (divergence propre : aucun fichier applicatif
partagé entre les deux branches, hors `docs/handoff/STATE.json`/`CURRENT.md`
— qu'aea5406 avait de toute façon modifiés à la main, hors de l'outillage).
Le travail de ce lot est donc **reconstruit directement sur le HEAD
canonique actuel**, pas rapatrié : le diff métier d'aea5406 (correction
`soldesCarnetsAvecReference` + test) a été rejoué et revérifié ici, pas
copié à l'aveugle.

## 1. Ce qui a été lu avant d'écrire une ligne de code

`docs/handoff/STATE.json` (lu avant toute écriture) : `lot_actif` =
`FDJ-VAGUE1-REPRISE-20261003`, `statut: DECISION_CONSOMMEE` — **hors**
`STATUTS_LOT_ACTIFS`. Aucune demande non consommée n'interdisait l'ouverture
de ce nouveau lot. `node outils/handoff.js verifier` conforme avant toute
écriture.

Lu intégralement : `nexus-fdj-moteur.js` (1948 lignes), `NEXUS-FDJ-v1.html`
et `NEXUS-FDJ-Manager-v1.html` (les fonctions qui écrivent dans
`fdj_stock_movements`), les migrations `20260809130450`, `20260810011853`,
`20260818135117`, `20260916220400`, `20260916221000`, l'historique git de
`nexus-fdj-moteur.js`, et le lot `FDJ-VAGUE1-REPRISE-20261003` au complet
(requests/decisions 1 à 9) pour ne pas rouvrir un sujet déjà tranché.

## 2. Cycle de vie canonique d'un carnet (tel qu'il existe réellement)

NEXUS suit les carnets FDJ **par quantité agrégée, par jeu et par site** —
jamais par carnet individuel. `fdj_booklets` (carnet nominatif, numéro de
série, scanner) existe dans le schéma depuis le 09/08/2026 mais n'est
alimenté par **aucun** écran, ni manager ni employé (0 ligne, aucune
référence dans le code, déjà documenté comme tel dans
`NEXUS-FDJ-Manager-v1.html:3461-3466`). Ce n'est pas un défaut de ce lot :
c'est une limite assumée et déjà écrite (voir §5, spécification du futur
Point Zéro).

Un carnet transite par un seul état par jeu/site (jamais par carnet) :

```
Fournisseur ──reception──▶ Bureau ──transfert──▶ Caisse (confié, non activé)
                 ▲                                      │
                 └──retour (depuis bloqué)──┐            │ activation
                                             │            ▼
                             Zone bloquée ◀──┴──blocage── Activé (vendu)
```

Table pivot : `fdj_stock_movements` (`type_mouvement` ∈ reception / transfert
/ retour / blocage / activation / correction), append-only — **aucune**
policy RLS `update`/`delete` depuis la création du schéma (vérifié sur
toutes les migrations qui la touchent). Le point zéro périodique
(`fdj_stock_references` + `fdj_stock_reference_lignes`) absorbe l'historique
antérieur sans jamais réécrire un mouvement.

**Source de vérité unique, confirmée, pas dupliquée** : une seule fonction,
`NexusFdjMoteur.soldesCarnetsAvecReference`, calcule ce solde — consommée
par l'écran employé, l'écran manager, l'Analyse, le Brief et le Coach FDJ.
`soldesCarnetsParJeu` (V1) existe encore mais n'est appelée par aucun écran —
code mort, pas un second chemin de vérité actif.

## 3. Cartographie exhaustive des 9 écritures (mission, point 3)

| Écran | Action | Fonction | Mouvement écrit | `employee_id` | Idempotency (avant ce lot) | Idempotency (après ce lot) |
|---|---|---|---|---|---|---|
| Employé | Activer un carnet en caisse | `executerActivationCarnetInterne` | `activation`, caisse→caisse | employé | oui (client, frais à chaque appel) | inchangé — hors périmètre |
| Employé | Activation déduite de l'appro à la clôture | `creerActivationImplicite` | `activation`, `implicite_appro` | employé | oui (client, frais à chaque appel) | inchangé — hors périmètre |
| Manager | Réapprovisionner la caisse | `enregistrerReappro` | `transfert`, bureau→caisse | manager | **aucune** | **`fdj_enregistrer_mouvement_stock`, jeton stable** |
| Manager | Retirer des jeux de la caisse | `enregistrerRetraitCaisse` | `retour`, caisse→bureau | manager | **aucune** | **idem** |
| Manager | Réceptionner un colis FDJ | `enregistrerReception` | `reception`, →bureau | manager | **aucune** | **idem** |
| Manager | Rapprochement manuel | `validerRapprochement` | `activation`, `saisie_manuelle`, caisse→caisse | NULL (volontaire) | **aucune** | **idem** |
| Manager | Signaler un retrait / blocage | `enregistrerBlocage` | `blocage` | manager | **aucune** | **idem** |
| Manager | Retourner depuis la zone bloquée | `retournerDepuisBloque` | `retour`, bloqué→bureau | manager | **aucune** | **idem** |
| Manager | « Modifier ce quart FDJ » — correction | `creerActivationReconstitueeCorrectionManager` | `activation`(+) ou `correction`(−), caisse→caisse | manager | oui (client, frais à chaque appel) | inchangé — hors périmètre (voir §8) |

Chemin : UI (formulaire manager/employé) → fonction d'écriture ci-dessus →
(après ce lot, pour les 6 lignes « Manager ») RPC
`fdj_enregistrer_mouvement_stock` → `fdj_stock_movements` (ledger) →
`idempotency_key` (index unique partiel) → `fdj_audit_log` (trace).

Les deux commandes serveur `fdj_activer_carnet` / `fdj_enregistrer_mouvement_stock`
(migration `20260916221000`, déployée le 16/09/2026, rapatriée sur le rail
le 04/10/2026 par `67512d2`) étaient **inutilisées jusqu'à ce lot** : elles
résolvent `site`/`employee_id`/`created_by`/`effective_at` côté serveur
(jamais reçus du navigateur) et génèrent une `idempotency_key` liée à
`auth.uid()` (non-forgeable pour un collègue).

## 4. Bug réel trouvé — cause racine, reproduit, corrigé, testé (mission, point 1)

**`soldesCarnetsAvecReference` routait tout mouvement `type_mouvement:
'correction'` vers `confies`/`bureau` par emplacement de destination**, un
choix écrit le 09/08/2026, **avant** qu'aucun producteur réel de
'correction' n'existe. Le seul producteur réel ajouté depuis (27/08/2026,
`creerActivationReconstitueeCorrectionManager`) écrit toujours
`location_source_id = location_destination_id = caisse` avec une quantité
négative. `correction` ne touchait jamais `actives` : l'activation fautive y
restait comptée pour toujours, tandis que `confies` était décrémenté comme
si des carnets avaient physiquement quitté la caisse — ce qui n'est jamais
le cas sur ce chemin.

**Mesure exacte** (sur un état de référence `confiés=10, actifs=3,
non-activés=7`, après reconstitution fautive (+2) puis annulation) : le
système retombait sur `confiés=8, actifs=5, non-activés=3` au lieu de
`confiés=10, actifs=3, non-activés=7` — un écart de −4 sur le stock
non-activé affiché, alors qu'aucun carnet n'a physiquement bougé.

**Corrigé** (`nexus-fdj-moteur.js`, `soldesCarnetsAvecReference` et, par
cohérence, `soldesCarnetsParJeu` bien qu'appelée par aucun écran) :
`correction` annule désormais `actives`, exactement comme une `activation`
de signe opposé — jamais un second mécanisme de comptage.

**Preuve, mutation comprise** : `test_fdj_carnets_ledger_reconciliation_20261004.js`,
21 assertions (réception, transfert, retour — deux variantes —, blocage,
correction [le bug, avec état de référence avant/après/attendu], point
zéro, réconciliation saine/anomalie, intégration bout-en-bout). Mutation
réelle exécutée : revenir au code d'avant correctif fait échouer **3**
assertions (pas 2, chiffre erroné dans une analyse antérieure non intégrée
— vérifié ici en rejouant réellement la régression, pas supposé), avec les
valeurs fausses prédites.

## 5. Fermeture du gap d'idempotence — 6 écritures manager hors quart (mission, point 2)

Recherche exhaustive confirmée : **6 sur 9** écritures (toutes les écritures
manager « hors quart ») n'envoyaient **aucune** `idempotency_key`. Les
boutons étaient désactivés pendant l'écriture, ce qui empêche un double-clic
immédiat, mais **pas** un rejeu réseau (requête qui atteint le serveur,
réponse perdue, nouvelle tentative) — l'index unique Postgres ne peut rien
dédupliquer sans clé envoyée.

**Fermé** en branchant les 6 fonctions sur la commande serveur déjà
déployée `fdj_enregistrer_mouvement_stock` (`NEXUS-FDJ-Manager-v1.html`) :
chaque opération (`reappro_caisse`, `retrait_caisse`, `reception`,
`blocage`, `retour_bloque`, `rapprochement_activation`) envoie désormais un
**jeton stable** (`jetonIntention`, nouvelle fonction) — généré une seule
fois par intention de saisie, jamais régénéré tant que le formulaire n'a pas
réussi ou été abandonné. Les emplacements, le type de mouvement et l'auteur
ne sont plus composés côté client : ils sont déterminés côté serveur par
l'opération nommée, exactement ce que la migration `20260916221000`
promettait et qui restait inutilisé depuis le 16/09/2026.

`retournerDepuisBloque` (pas d'état de saisie persistant, appelée
directement depuis une liste) reçoit un jeton tenu par jeu
(`jetonsRetourBloque`), libéré après succès pour qu'un futur cycle
blocage/retour sur le même jeu n'hérite jamais de l'ancienne clé — vérifié
explicitement par test (voir §7, cas 5).

**Hors périmètre, volontairement** : `creerActivationReconstitueeCorrectionManager`
et les 2 écritures employé génèrent déjà une clé — mais fraîche à chaque
appel (pas stable). C'est un défaut distinct, plus ancien, qui ne figurait
pas dans le gap « 6/9 » mesuré par ce lot ; le signaler ici sans le corriger
évite de masquer une dette réelle sous ce lot (voir §8).

## 6. Réconciliation — stock théorique courant (mission, point 4)

`soldesCarnetsAvecReference` **est** la fonction de consolidation demandée :
point zéro (`fdj_stock_references`) + entrées (réception, transfert) −
sorties (retour, blocage) ± corrections = stock théorique courant, par jeu.
Cette consolidation est déjà comparée au comptage physique réel dans
l'écran manager (`statutInventaireLigne`, « Inventaire de référence FDJ ») :
un écart devient visible (`🟠 Écart de N carnet(s) à expliquer`), jamais
masqué. Ce lot ne construit pas un second mécanisme : il corrige le seul
qui existe (§4) et l'éprouve davantage (§7).

## 7. Cas limites éprouvés (mission, point 7/8)

Nouveau `test_fdj_idempotence_ecritures_manager_20261004.js`, 11 assertions,
mutation confirmée (désactiver le caractère stable du jeton fait échouer le
test immédiatement, avec le jeton divergent affiché) :

1. **Mapping des 6 opérations** — chacune appelle `fdj_enregistrer_mouvement_stock`
   avec le bon `p_operation`/lignes/motif/source/emplacement, et porte un
   `p_jeton` non vide (le gap fermé).
2. **Retry réseau** — une erreur réseau simulée laisse l'état de saisie
   intact ; le retry qui suit envoie **exactement le même jeton**.
3. **Concurrence** — deux appels lancés avant résolution du premier
   (`Promise.all`) portent déjà le même jeton au moment où ils atteignent
   le réseau : la génération est synchrone, aucune fenêtre de course côté
   client.
4. **Transfert interrompu puis rejoué** (`retournerDepuisBloque`) — coupure
   réseau simulée, puis retry explicite : même jeton.
5. **Nouvelle intention après succès** — un cycle blocage → retour réussi
   libère le jeton ; un **nouveau** cycle sur le même jeu obtient un jeton
   **différent** (sinon il serait avalé à tort comme un rejeu du premier).
6. **Deux jeux distincts** — jamais le même jeton.

Au niveau moteur (`test_fdj_carnets_ledger_reconciliation_20261004.js`) :
réception, transfert, retour (2 variantes), blocage, correction (le bug),
point zéro, réconciliation saine/anomalie, intégration bout-en-bout.

**Doublon de carnet / double emplacement** : non applicable — NEXUS ne suit
aucun carnet individuellement (§2), la question ne se pose qu'à l'agrégat
par jeu, déjà couvert par le test de réconciliation.

## 8. Dette signalée, non corrigée dans ce lot

`creerActivationReconstitueeCorrectionManager` et les 2 écritures employé
génèrent une `idempotency_key` **fraîche à chaque appel** plutôt que stable
— un retry réel ne retomberait pas sur la même clé. C'est un défaut distinct
du gap « 6/9 » mesuré par la mission (déjà présent avant ce lot, hors de son
périmètre déclaré), signalé ici pour un futur lot dédié plutôt que corrigé
en silence sous ce lot-ci.

## 9. Spécification du futur Point Zéro Inventaire FDJ (mission, point 5) — NON EXÉCUTÉ

Voir `spec-point-zero-inventaire-fdj.md` du même lot. Aucune migration,
aucun code, aucune donnée créée. Résumé : le point zéro actuel
(`fdj_stock_references`/lignes) couvre déjà date/heure/site/auteur et
l'historique intégral append-only ; ce qui manquerait pour la cible complète
(carnet individuel, état par carnet, emplacement par carnet) nécessite un
geste physique différent sur le terrain (scan de numéro de série), à valider
par un cycle réel après Production avant toute généralisation — même
doctrine que l'arbitrage C4 de `FDJ-VAGUE1-REPRISE-20261003`.

## 10. Corrections historiques append-only (mission, point 6)

Confirmé par lecture de toutes les migrations touchant `fdj_stock_movements`/
`fdj_stock_references` : aucune policy RLS `update`/`delete` n'a jamais
existé. Une correction se fait par contre-écriture référencée (le mouvement
`correction` lui-même en est l'exemple vivant) — jamais une réécriture.
Rien à changer ici ; ce lot vérifie et documente un invariant déjà respecté,
il ne le construit pas.

## 11. Audit Production en lecture seule — non réalisable depuis ce canal (mission, point 9)

Confirmé, comme à chaque lot de ce fil depuis le 06/09/2026 : aucun
identifiant ni accès réseau Supabase (Test ou Production) n'est disponible
dans ce canal GitHub Issue. Trois requêtes **strictement `SELECT`**, prêtes
pour l'Orchestrator, dans `audit-production-lecture-seule-1.sql` du même
lot : (A) le bug du §4 a-t-il déjà écrit en Production ; (B) candidats de
double-écriture historique sur les 6 chemins qui n'envoyaient aucune clé
avant ce lot ; (C) export chronologique brut à rejouer contre la fonction
corrigée pour mesurer l'écart exact sur les données réelles.

## Preuves (mission, point 10)

- `node test_fdj_carnets_ledger_reconciliation_20261004.js` → 21/21,
  mutation confirmée (3 échecs réels sans le correctif).
- `node test_fdj_idempotence_ecritures_manager_20261004.js` → 11/11
  (nouveau), mutation confirmée (jeton instable détecté immédiatement).
- `node run-tests.js fdj` → 35/35 (aucune régression FDJ).
- `node run-tests.js` (suite complète) → 293/302, les 9 échecs strictement
  identiques à la liste historique connue — **aucune régression**.
- `node outils/guardians-router.js` → 0 finding sur le diff réel de ce lot.
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt.
- Garde de langage NEXUS (LANG-003, `outils/garde-langage-nexus.js`) :
  conforme — le plafond `NEXUS-FDJ-Manager-v1.html` (114 → 111) a été
  abaissé, conséquence du retrait de phrases désormais composées côté
  serveur (RPC) plutôt que par le client.
- Cartographie `SITE-EXPLICITE` (`test_site_explicite_detecteur_20260905.js`) :
  50 → 47 écritures recensées, 37 → 36 tables, mise à jour et expliquée
  dans le test lui-même — trois faux positifs structurels (écriture par
  variable indétectable par le détecteur) disparaissent avec le passage à
  la commande serveur, qui ne reçoit de toute façon plus aucun paramètre de
  site côté client.

## Verdict

**`PRET_POUR_RECETTE_FDJ_CARNETS`**, avec conditions explicites :

1. le bug de réconciliation (§4) est corrigé et testé, mutation confirmée ;
2. le gap d'idempotence des 6 écritures manager (§5) est fermé et testé,
   mutation confirmée ;
3. **non fait depuis ce canal, requis avant promotion Production** : une
   recette navigateur réelle sur `nexus-test` (aucun accès Test disponible
   ici) confirmant que les 6 écrans manager fonctionnent identiquement à
   l'œil du manager après le branchement sur la commande serveur, et que la
   base Test reflète bien les mouvements attendus ;
4. **non fait, requis avant promotion Production** : exécution des 3
   requêtes SELECT (§11) par l'Orchestrator, pour fermer l'audit d'impact
   historique du bug §4.

Ce verdict autorise la **recette**, pas la Production : aucune promotion
Production n'est demandée ni déduite de ce retour.

## Ce qui n'a pas été fait, et pourquoi

Aucune écriture, migration ou lecture Supabase (Test ou Production).
`creerActivationReconstitueeCorrectionManager` et les 2 écritures employé
non modifiées (§8, dette distincte signalée). Point Zéro Inventaire FDJ
spécifié seulement, pas construit (§9, explicitement demandé ainsi). Aucune
correction de données existantes.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun
identifiant disponible), aucune promotion Production, aucun secret créé/lu/
exposé, aucun patch UI masquant une incohérence métier, aucune réécriture
d'un historique validé (append-only intact), aucun Point Zéro réel exécuté,
aucun lot sécurité touché.
