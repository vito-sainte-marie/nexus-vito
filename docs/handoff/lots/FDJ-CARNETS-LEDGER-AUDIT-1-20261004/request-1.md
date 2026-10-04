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
    valeur: soldesCarnetsAvecReference-21-21-mutation-3-echecs-reels-reconfirmee
  - id: idempotence-gap-ferme
    classe: VERIFIED
    valeur: 6-ecritures-manager-fdj_enregistrer_mouvement_stock-11-11-mutation-confirmee
  - id: regression-fdj
    classe: VERIFIED
    valeur: node-run-tests.js-fdj-35-35
  - id: regression-globale
    classe: VERIFIED
    valeur: 294-303-9-echecs-historiques-identiques
  - id: garde-langage-nexus
    classe: VERIFIED
    valeur: plafond-NEXUS-FDJ-Manager-v1.html-114-vers-111-conforme
  - id: cartographie-site-explicite
    classe: VERIFIED
    valeur: 50-vers-47-ecritures-37-vers-36-tables
  - id: isolation-anon5
    classe: VERIFIED
    valeur: DETTE_GELEE-inchangee-43-aucun-fichier-anon5-touche
  - id: point-zero-spec
    classe: DECLARED
    valeur: spec-point-zero-inventaire-fdj.md-conservee-non-executee
  - id: qualification-nexus-test
    classe: NOT_APPLICABLE
    valeur: secrets-presents-mais-candidat-non-servi-sur-le-rail-commit-acbf3f4
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucun-identifiant-supabase-dans-ce-canal-sql-prepare
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration
---
# Inventaire / mouvements / réconciliation des carnets FDJ — correction du ledger, fermeture du gap d'idempotence

Réponse au réveil Orchestrateur de l'issue #28 (04/10/2026, `@claude` /
`NEXUS_BASE_BRANCH=handoff-continuite-20260920`) : « GO REPRISE FDJ
CARNETS — APRÈS CLÔTURE SECURITE-ANON5 ».

## 0. Candidat précédent (`153de05`) — non transporté, reconstruit fichier par fichier

Vérifié avant tout code : `git merge-base e64df4f 153de05` = `e64df4f`
(parent direct) — ce candidat est bâti sur `e64df4f`, **antérieur** à
l'ouverture du lot `SECURITE-ANON5-20261004` (qui part du même `e64df4f`
et avance jusqu'à `acbf3f4`, HEAD canonique actuel). Son diff brut contre
`acbf3f4` le montre sans ambiguïté : il **supprime** les 5 `request-*.md`/
`decision-*.md` d'ANON5 déjà consommés, la migration
`20261004130000_revoquer_anon_quatre_fonctions_hors_fdj.sql`, le test
`test_securite_anon_quatre_fonctions_20261004.js`, et **revert**
`outils/garde-revoke-fonction-roles-nommes.js` (`DETTE_GELEE` 43 → 47,
effaçant l'addendum anon5 du commentaire). Le fusionner ou le
cherry-picker aveuglément aurait réintroduit anon5 à l'envers —
exactement l'interdiction explicite du réveil.

Vérifié ensuite, avant de reconstruire : `git log --oneline e64df4f..acbf3f4
-- <chaque fichier FDJ-pertinent>` — seul `7b96872` (le commit métier
d'ANON5 lui-même) a touché l'un des fichiers que le candidat modifie, et
uniquement `outils/garde-revoke-fonction-roles-nommes.js` (exclu du
transport, voir ci-dessus). Les quatre fichiers métier/test restants
(`nexus-fdj-moteur.js`, `NEXUS-FDJ-Manager-v1.html`,
`docs/gouvernance/LANGAGE-NEXUS-PLAFONDS.json`,
`test_site_explicite_detecteur_20260905.js`) sont donc **identiques**
entre `e64df4f` et `acbf3f4` : leur diff candidat s'applique mot pour mot,
revérifié en comparant les deux diffs (`git diff e64df4f 153de05 -- <f>`
contre `git diff acbf3f4 153de05 -- <f>`) avant toute écriture. Ce lot
reconstruit donc ces quatre fichiers à l'identique du candidat (`git show
153de05:<f>`), ajoute les deux nouveaux fichiers de test tels quels, et
conserve les deux documents du lot (spec Point Zéro, audit SQL
lecture seule) — sans jamais fusionner la branche divergente elle-même.

## 1. Ce qui a été lu avant d'écrire une ligne de code

`docs/handoff/STATE.json` (lu avant toute écriture) : `lot_actif =
SECURITE-ANON5-20261004`, `statut: DECISION_CONSOMMEE` — **hors**
`STATUTS_LOT_ACTIFS` (`ATTENTE_DECISION`, `ATTENTE_CONSOMMATION_DECISION`).
Confirmé par lecture du code de `nouvelleDemande` (`outils/handoff.js`) :
seul un lot dont le statut appartient à `STATUTS_LOT_ACTIFS` bloquerait
l'ouverture d'un nouveau lot — ce n'est pas le cas ici. `node
outils/handoff.js verifier` conforme avant toute écriture (34 lots, 15
avertissements, 11 dérogations — tous préexistants).

Lu intégralement : `nexus-fdj-moteur.js` (version candidate et version
canonique, diffées), les fonctions d'écriture de `NEXUS-FDJ-v1.html` et
`NEXUS-FDJ-Manager-v1.html`, la migration `20260916221000` (signature
réelle de `fdj_enregistrer_mouvement_stock`, les 6 `case p_operation`
qu'elle supporte), et le contenu complet du `request-1.md` du candidat
(repris comme base documentaire, revérifié point par point, jamais copié
sans contrôle).

## 2. Cycle de vie canonique d'un carnet (tel qu'il existe réellement)

NEXUS suit les carnets FDJ **par quantité agrégée, par jeu et par site** —
jamais par carnet individuel. `fdj_booklets` (carnet nominatif, numéro de
série) existe dans le schéma depuis le 09/08/2026 mais n'est alimenté par
**aucun** écran (0 ligne, 0 référence dans le code) — limite assumée,
détaillée au §9 (spec Point Zéro).

```
Fournisseur ──reception──▶ Bureau ──transfert──▶ Caisse (confié, non activé)
                 ▲                                      │
                 └──retour (depuis bloqué)──┐            │ activation
                                             │            ▼
                             Zone bloquée ◀──┴──blocage── Activé (vendu)
```

Table pivot : `fdj_stock_movements` (`type_mouvement` ∈ reception /
transfert / retour / blocage / activation / correction), append-only —
**aucune** policy RLS `update`/`delete` depuis la création du schéma
(vérifié sur toutes les migrations qui la touchent). Source de vérité
unique, confirmée : une seule fonction, `NexusFdjMoteur.soldesCarnetsAvecReference`,
calcule ce solde — consommée par l'écran employé, l'écran manager,
l'Analyse, le Brief et le Coach FDJ. `soldesCarnetsParJeu` (V1) existe
encore mais n'est appelée par aucun écran — code mort, corrigé par
cohérence, pas un second chemin de vérité actif.

## 3. Cartographie exhaustive des 9 écritures (mission, point 7)

| Écran | Action | Fonction | Mouvement écrit | `employee_id` | Idempotence (avant) | Idempotence (après) |
|---|---|---|---|---|---|---|
| Employé | Activer un carnet en caisse | `executerActivationCarnetInterne` (`NEXUS-FDJ-v1.html:1576`) | `activation`, caisse→caisse | employé | oui (client, frais à chaque appel) | inchangé — hors périmètre |
| Employé | Activation déduite de l'appro à la clôture | `creerActivationImplicite` (`NEXUS-FDJ-v1.html:1410`) | `activation`, `implicite_appro` | employé | oui (client, frais à chaque appel) | inchangé — hors périmètre |
| Manager | Réapprovisionner la caisse | `enregistrerReappro` | `transfert`, bureau→caisse | manager | **aucune** | **`fdj_enregistrer_mouvement_stock`, jeton stable** |
| Manager | Retirer des jeux de la caisse | `enregistrerRetraitCaisse` | `retour`, caisse→bureau | manager | **aucune** | **idem** |
| Manager | Réceptionner un colis FDJ | `enregistrerReception` | `reception`, →bureau | manager | **aucune** | **idem** |
| Manager | Rapprochement manuel | `validerRapprochement` | `activation`, `saisie_manuelle`, caisse→caisse | NULL (volontaire) | **aucune** | **idem** |
| Manager | Signaler un retrait / blocage | `enregistrerBlocage` | `blocage` | manager | **aucune** | **idem** |
| Manager | Retourner depuis la zone bloquée | `retournerDepuisBloque` | `retour`, bloqué→bureau | manager | **aucune** | **idem** |
| Manager | « Modifier ce quart FDJ » — correction | `creerActivationReconstitueeCorrectionManager` (`NEXUS-FDJ-Manager-v1.html:634`) | `activation`(+) ou `correction`(−), caisse→caisse | manager | oui (client, frais à chaque appel) | inchangé — hors périmètre (§8) |

Les trois fonctions non modifiées (2 employé + 1 correction manager) ont
été relocalisées et confirmées présentes dans ce HEAD exactement sous ces
noms avant publication de cette request (`grep` direct, pas une citation
héritée).

La commande serveur `fdj_enregistrer_mouvement_stock` (migration
`20260916221000`, déjà présente/déployée sur ce rail depuis le 16/09/2026)
était **inutilisée jusqu'à ce lot** : elle résout `site`/`employee_id`/
`created_by` côté serveur (jamais reçus du navigateur) et exige
`p_jeton` non vide — vérifié sur sa signature réelle et ses six branches
`case p_operation` (`reception`, `reappro_caisse`, `retrait_caisse`,
`blocage`, `retour_bloque`, `rapprochement_activation`), qui correspondent
exactement aux six appels ajoutés dans `NEXUS-FDJ-Manager-v1.html`.

## 4. Bug réel — cause racine, reproduit, corrigé, testé (mission, point 2 partiel)

`soldesCarnetsAvecReference` routait tout mouvement `type_mouvement:
'correction'` vers `confies`/`bureau` par emplacement de destination —
choix écrit le 09/08/2026, **avant** qu'aucun producteur réel de
`'correction'` n'existe. Le seul producteur réel ajouté depuis (27/08/2026,
`creerActivationReconstitueeCorrectionManager`) écrit toujours
`location_source_id = location_destination_id = caisse` avec une quantité
négative. `correction` ne touchait jamais `actives` : l'activation fautive
y restait comptée pour toujours, tandis que `confies` était décrémenté
comme si des carnets avaient physiquement quitté la caisse — ce qui n'est
jamais le cas sur ce chemin.

**Corrigé** (`nexus-fdj-moteur.js`, `soldesCarnetsAvecReference` et, par
cohérence, `soldesCarnetsParJeu`) : `correction` annule désormais `actives`,
exactement comme une `activation` de signe opposé.

**Preuve mesurée dans cette session, pas recopiée** :
`node test_fdj_carnets_ledger_reconciliation_20261004.js` → 21/21.
**Mutation négative réellement rejouée ici** : `git show acbf3f4:nexus-fdj-moteur.js`
restauré temporairement (code d'avant correctif) → **3 échecs réels**,
valeurs exactes `confiés=8, actives=5, nonActives=3` au lieu de `confiés=10,
actives=3, nonActives=7` — identiques aux valeurs prédites par le candidat.
Correctif restauré, 21/21 de nouveau, `git diff --stat` confirmé identique
au diff d'origine (27 insertions / 5 suppressions).

## 5. Fermeture du gap d'idempotence — 6 écritures manager hors quart (mission, point 2)

**6 sur 9** écritures (toutes les écritures manager « hors quart »)
n'envoyaient **aucune** `idempotency_key` : les boutons désactivés pendant
l'écriture empêchent un double-clic immédiat, mais pas un rejeu réseau
(requête qui atteint le serveur, réponse perdue, nouvelle tentative) —
l'index unique Postgres ne peut rien dédupliquer sans clé envoyée.

**Fermé** en branchant les 6 fonctions sur `fdj_enregistrer_mouvement_stock` :
chaque opération envoie désormais un **jeton stable** (`jetonIntention`,
nouvelle fonction) — généré une seule fois par intention de saisie, jamais
régénéré tant que le formulaire n'a pas réussi ou été abandonné. Les
emplacements, le type de mouvement et l'auteur ne sont plus composés côté
client. `retournerDepuisBloque` (pas d'état de saisie persistant) reçoit un
jeton tenu par jeu (`jetonsRetourBloque`), libéré après succès.

**Preuve mesurée ici** : `node test_fdj_idempotence_ecritures_manager_20261004.js`
→ 11/11 (mapping des 6 opérations, retry réseau même jeton, concurrence
sans fenêtre de course, coupure réseau puis retry, nouveau cycle après
succès → jeton différent, deux jeux distincts → jetons distincts).
**Mutation négative réellement rejouée ici** : `jetonIntention` modifiée
pour régénérer un jeton à chaque appel (au lieu de le stabiliser) →
`AssertionError` immédiate, jeton divergent affiché (`uuid-w55tlq6h` reçu,
`uuid-dma3vzoq` attendu). Fonction restaurée, 11/11 de nouveau, `git diff
--stat` confirmé identique au diff d'origine (124 lignes, +73/−51).

## 6. Réconciliation — stock théorique courant (mission, point 4)

`soldesCarnetsAvecReference` **est** la fonction de consolidation
demandée : point zéro (`fdj_stock_references`) + entrées (réception,
transfert) − sorties (retour, blocage) ± corrections = stock théorique
courant, par jeu. Déjà comparée au comptage physique réel dans l'écran
manager (« Inventaire de référence FDJ ») : un écart devient visible,
jamais masqué. Ce lot corrige le seul mécanisme qui existe ; il n'en
construit pas un second.

## 7. Idempotence / retry / double clic / divergence détectée (mission, point 4)

Couvert au §5 (idempotence, retry, double-tap via jeton stable) et au §4
(divergence : le test de réconciliation détecte explicitement l'écart
introduit par le bug `correction`, avant/après correctif). « Doublon de
carnet / double emplacement » : non applicable — NEXUS ne suit aucun
carnet individuellement (§2), la question ne se pose qu'à l'agrégat par
jeu, déjà couvert.

## 8. Dette signalée, non corrigée dans ce lot

`creerActivationReconstitueeCorrectionManager` et les 2 écritures employé
génèrent une `idempotency_key` **fraîche à chaque appel** plutôt que
stable — un retry réel ne retomberait pas sur la même clé. Défaut distinct
du gap « 6/9 » mesuré par ce lot (déjà présent avant, hors de son
périmètre), signalé pour un futur lot dédié plutôt que corrigé en silence
sous celui-ci.

## 9. Spécification du futur Point Zéro Inventaire FDJ (mission, point 5) — NON EXÉCUTÉ, conservée

Voir `spec-point-zero-inventaire-fdj.md` du même lot (repris du candidat,
relu intégralement avant republication, inchangé). Aucune migration, aucun
code, aucune donnée créée. Résumé : le point zéro actuel
(`fdj_stock_references`/lignes) couvre déjà date/heure/site/auteur et
l'historique append-only ; la cible complète (carnet individuel, état par
carnet, emplacement par carnet) exige un geste physique différent sur le
terrain (scan de numéro de série), à valider par un cycle réel après
Production — même doctrine que l'arbitrage C4 de `FDJ-VAGUE1-REPRISE-20261003`.

## 10. Corrections historiques append-only (mission, point 6)

Confirmé par lecture de toutes les migrations touchant
`fdj_stock_movements`/`fdj_stock_references` : aucune policy RLS
`update`/`delete` n'a jamais existé. Une correction se fait par
contre-écriture référencée (le mouvement `correction` lui-même en est
l'exemple vivant) — jamais une réécriture. Invariant déjà respecté,
vérifié ici, pas construit par ce lot.

## 11. Audit Production en lecture seule (mission, point 6) et qualification nexus-test (mission, point 4)

**Écriture/lecture Supabase : aucune, dans cette session.** Trois requêtes
strictement `SELECT` sont prêtes pour l'Orchestrator dans
`audit-production-lecture-seule-1.sql` du même lot (repris du candidat,
relu : aucun `insert/update/delete/drop/alter`) : (A) le bug du §4 a-t-il
déjà écrit en Production ; (B) candidats de double-écriture historique sur
les 6 chemins qui n'envoyaient aucune clé avant ce lot ; (C) export
chronologique brut à rejouer contre la fonction corrigée.

**Constat nouveau, à signaler explicitement** : contrairement à tous les
réveils précédents de ce fil depuis le 06/09/2026, ce canal GitHub Issue
dispose cette fois d'un accès réseau sortant réel et des secrets
`NEXUS_TEST_MANAGER_NOM`/`NEXUS_TEST_MANAGER_PIN`/`NEXUS_TEST_CREATEUR_NOM`/
`NEXUS_TEST_CREATEUR_PIN` (vérifié par présence de nom, jamais par lecture
de valeur) — `outils/recette-navigateur-test.js` : `secretsManquants([])`
confirme que les quatre secrets requis par `SECRETS_REQUIS` sont là.

**Mais la qualification navigateur réelle n'a pas été exécutée, et ne
l'aurait pas dû être** : `urlTestDuRail('handoff-continuite-20260920')`
résout `https://handoff-continuite-20260920.nexus-test-ddf.pages.dev/`, et
une requête réelle sur `nexus-build.js` de cette adresse (lecture seule,
aucune authentification) montre `commit: 'acbf3f445436cd978629991246946dbf5d815149'`
— c'est-à-dire le HEAD canonique **d'avant ce lot**, pas le candidat. Le
code corrigé (`7e41b3b`) vit uniquement sur `claude/issue-28-20261004-1753`
et n'a jamais été intégré au rail : lancer la recette maintenant aurait
testé l'ancien comportement et produit une preuve trompeuse — exactement
ce que `attendreVersionServie` (même fichier) existe pour empêcher («
lancer la recette dès le push testerait la version PRÉCÉDENTE [...] on
attend donc que la version servie soit celle qu'on teste »). Ce n'est donc
pas une limite de ce canal (elle a disparu) mais une limite de séquence :
intégration avant recette, jamais l'inverse.

## Preuves

- `node test_fdj_carnets_ledger_reconciliation_20261004.js` → 21/21,
  mutation négative réellement rejouée (3 échecs réels, valeurs exactes
  mesurées, correctif restauré, diff final identique à l'origine).
- `node test_fdj_idempotence_ecritures_manager_20261004.js` → 11/11,
  mutation négative réellement rejouée (jeton instable détecté
  immédiatement, correctif restauré, diff final identique à l'origine).
- `node run-tests.js fdj` → 35/35.
- `node run-tests.js` (suite complète) → 294/303 (292/301 avant ce commit),
  les 9 échecs strictement identiques à la liste historique connue —
  aucune régression.
- `node outils/guardians-router.js` (diff réel `acbf3f4...7e41b3b`) → 1
  finding, la collision `NexusStock` déjà connue et tracée (dette
  architecture distincte, non liée à ce lot) — 0 finding nouveau.
- `node outils/guardian-qa.js` → 0 finding.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.
- `node outils/handoff.js verifier` → conforme avant ce dépôt.
- Garde de langage NEXUS (`outils/garde-langage-nexus.js`) : conforme — le
  plafond `NEXUS-FDJ-Manager-v1.html` (114 → 111) abaissé, conséquence du
  retrait de phrases désormais composées côté serveur.
- Cartographie `SITE-EXPLICITE` (`test_site_explicite_detecteur_20260905.js`) :
  50 → 47 écritures, 37 → 36 tables, vert.
- Isolation ANON5 vérifiée après reconstruction : `node
  outils/garde-revoke-fonction-roles-nommes.js` → conforme, `DETTE_GELEE`
  toujours 43 (inchangée) ; `git status` confirme zéro fichier du lot
  SECURITE-ANON5-20261004 touché.
- Qualification navigateur `nexus-test` : secrets disponibles (nouveau),
  **mais non exécutée** — le candidat n'est pas servi par le rail (preuve
  exacte §11 : commit servi `acbf3f4`, pas `7e41b3b`). Audit SQL Production :
  non exécuté, aucun accès Supabase Production dans cette session (par
  conception du canal).

## Verdict

**`PRET_POUR_ARBITRAGE_FDJ_CARNETS`**

Le code est corrigé, testé avec mutation négative réelle sur les deux
défauts (§4, §5), sans régression mesurée, et strictement conforme au
périmètre `Test uniquement` de la mission. Ce qui manque pour clore le lot
n'est pas un doute sur le correctif mais une séquence qui dépasse ce
canal :

1. GO pour rapatrier `7e41b3b` sur `handoff-continuite-20260920` (commandes
   exactes ci-dessous) ;
2. une fois intégré et la version servie confirmée (`attendreVersionServie`),
   exécuter la recette navigateur réelle avec les secrets Manager/Créateur
   désormais disponibles dans ce canal — ou dans celui qui reprendra ce
   lot ;
3. Orchestrator : exécuter les 3 requêtes `SELECT` de
   `audit-production-lecture-seule-1.sql` pour fermer l'audit d'impact
   historique du bug §4 ;
4. arbitrage explicite sur la dette §8 (clés fraîches à chaque appel sur
   les 3 écritures restantes) — nouveau lot ou non, au choix de Frédéric.

Ce verdict n'autorise ni ne déduit aucune promotion Production.

## Pour rapatrier `7e41b3b` sur `handoff-continuite-20260920`

```
git fetch origin claude/issue-28-20261004-1753 handoff-continuite-20260920
git checkout -b lot/fdj-carnets-ledger-audit-1 origin/handoff-continuite-20260920
git checkout origin/claude/issue-28-20261004-1753 -- \
  nexus-fdj-moteur.js NEXUS-FDJ-Manager-v1.html \
  docs/gouvernance/LANGAGE-NEXUS-PLAFONDS.json \
  test_site_explicite_detecteur_20260905.js \
  test_fdj_carnets_ledger_reconciliation_20261004.js \
  test_fdj_idempotence_ecritures_manager_20261004.js \
  docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/spec-point-zero-inventaire-fdj.md \
  docs/handoff/lots/FDJ-CARNETS-LEDGER-AUDIT-1-20261004/audit-production-lecture-seule-1.sql
node run-tests.js fdj && node outils/guardian-qa.js && node outils/garde-langage-nexus.js   # doivent rester verts
git commit -m "handoff: intégrer la correction ledger carnets + idempotence (FDJ-CARNETS-LEDGER-AUDIT-1-20261004)"
git push origin lot/fdj-carnets-ledger-audit-1:handoff-continuite-20260920
```

## Ce qui n'a pas été fait, et pourquoi

Aucune écriture, migration ou lecture Supabase (Test ou Production).
`creerActivationReconstitueeCorrectionManager` et les 2 écritures employé
non modifiées (§8, dette distincte signalée). Point Zéro Inventaire FDJ
spécifié seulement, pas construit. Aucune correction de données
existantes. Candidat `153de05` non fusionné, aucune décision ANON5
touchée. Aucune recette navigateur exécutée (§11, séquence, pas un
blocage de secret). Aucun geste sur `main`/`production`.

## Invariants respectés

Aucun changement `main`/`production`, aucune fusion vers `production`,
aucun déploiement Production, aucune migration Production, aucune
écriture/réparation Production, aucune gate Pages Production, aucune
réconciliation de l'écart migration `20261004130000` de la branche
`production`, aucun secret créé/lu/exposé (noms de variables seulement),
aucune réécriture d'un historique validé (append-only intact), aucun lot
sécurité touché.
