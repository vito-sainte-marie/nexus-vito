---
protocol: nexus-handoff/2
kind: request
lot_id: FDJ-CARNETS-LEDGER-AUDIT-1-20261004
seq: 2
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=d6093b7 production=30544c9
  - id: commit-servi
    classe: VERIFIED
    valeur: 53d7cb650edeee10cbfd18fbb01e7be7f50e5765-confirme-2x-en-page
  - id: reconciliation-correctif
    classe: VERIFIED
    valeur: moteur-servi-confies-10-actives-3
  - id: idempotence-serveur-6-operations
    classe: VERIFIED
    valeur: jeton-rejoue-ecrits-0-idempotent-true-rejeux-1-6-6
  - id: dette-cle-fraiche-confirmee
    classe: VERIFIED
    valeur: genererIdempotencyKey-deux-appels-deux-uuid-distincts-aucune-ecriture-doublon
  - id: forfait-professional-applique
    classe: VERIFIED
    valeur: migration-20261004200000-nexus-station-test-seul
  - id: seed-fdj-jeux-emplacements
    classe: VERIFIED
    valeur: migration-20261004200100-nexus-station-test-seul
  - id: manifeste-migrations-a-jour
    classe: VERIFIED
    valeur: test_manifeste_migrations_complet_20260909-6-6-test_manifeste_migrations_append_only_20260921-8-8
  - id: regression-globale
    classe: VERIFIED
    valeur: aucune-regression-9-echecs-historiques-identiques
  - id: regression-fdj
    classe: VERIFIED
    valeur: node-run-tests.js-fdj-35-35
  - id: guardians
    classe: VERIFIED
    valeur: 1-finding-NexusStock-deja-connu-ARCH-002-0-nouveau
  - id: handoff-verifier
    classe: VERIFIED
    valeur: conforme-avant-apres
  - id: point-zero
    classe: DECLARED
    valeur: specifie-non-execute
  - id: audit-production
    classe: NOT_APPLICABLE
    valeur: aucun-acces-supabase-production-dans-ce-canal
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune-requete-aucun-merge-aucune-migration-production
---
# Qualification nexus-test réelle — réconciliation, idempotence, dette §8

Réponse à `decision-1.md` (GO recette de Frédéric, `APPROVED_WITH_CONDITIONS`,
`closes: false`). Périmètre exécuté : qualification navigateur réelle sur
`nexus-test`, exactement comme autorisée — aucun code métier FDJ modifié
dans ce request, aucun geste `main`/`production`/Supabase Production.

## 0. SHA et run

- HEAD canonique au moment de la qualification : `53d7cb650edeee10cbfd18fbb01e7be7f50e5765`
  (candidat déjà intégré — `7e41b3b` en est l'ancêtre direct, confirmé dans
  `decision-1.md`). Commit servi par le rail, lu en page via `NexusBuild.commit` :
  **identique**, `53d7cb6...`, confirmé à deux reprises (voir §3).
- HEAD après ce request : `e4faee8c53017fb2c17f43a0d86e773a6e5981de`
  (`4dab00c` décision, `518313e` consommation, `2dfc1bc` qualification +
  2 migrations Test/CI + addendum manifeste, `e4faee8` déplacement du
  script vers `outils/`). Aucun de ces quatre commits ne touche
  `nexus-fdj-moteur.js` ni `NEXUS-FDJ-Manager-v1.html` — le code qualifié
  est strictement celui de `request-1.md`.
- Run GitHub Actions de cette session : `37229326499` (job run, voir lien en
  bas de ce commentaire pour le lien exact).

## 1. Deux blocages test-only trouvés, corrigés à leur cause, jamais masqués

Avant toute écriture carnet, naviguer en session Manager Test réelle vers
`NEXUS-FDJ-Manager-v1.html` était systématiquement refusé — **deux raisons
distinctes, ni liées au bug du lot ni l'une à l'autre** :

1. **`sites.forfait` valait `'essential'` pour `'nexus-station-test'`.** FDJ
   rejoint `PAGES_PROFESSIONAL` depuis le 09/08/2026 (`nexus-forfait.js`) ;
   la migration d'origine (`20260726061316_ajouter_forfait_sites.sql`) ne
   mettait `'professional'` que pour `'vito-sainte-marie'`. Toute session
   Manager réelle était donc renvoyée vers `NEXUS-App-v1.html?forfait_requis=...`
   **avant même d'atteindre le code du lot** — un blocage préexistant,
   probablement depuis la création du module, jamais rencontré avant
   parce qu'aucune qualification navigateur FDJ réelle n'avait eu lieu sur
   ce site (confirmé : `FDJ-VAGUE1-REPRISE-20261003` et tous les lots FDJ
   précédents n'avaient qualifié que par du Node pur ou des lectures SQL).
2. **`fdj_games`/`fdj_locations` n'avaient jamais été peuplées pour ce site**
   (seul `'vito-sainte-marie'` l'était, `20260809130521`). Sans jeu ni
   emplacement, aucune des 9 écritures n'est exerçable, correction ou non.

**Corrigés par deux migrations Test/CI** (`20261004200000_forfait_professional_nexus_station_test.sql`,
`20261004200100_fdj_jeux_et_emplacements_nexus_station_test.sql`), **appliquées
réellement en base Test** via les sessions Créateur Test (RLS
`createur_update_sites`) et Manager Test (RLS `insert_fdj_games`/
`insert_fdj_locations`, bornée à `site = current_employee_site_id()`) —
jamais via un accès élevé, jamais sur Production. Les deux sont classées
**EXCLUES — Test/CI uniquement** dans `docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md`
(addendum du 04/10/2026), avec la déclaration canonique en en-tête — vérifié
par `test_manifeste_migrations_complet_20260909.js` (6/6) et
`test_manifeste_migrations_append_only_20260921.js` (8/8), les deux verts.

Autorisation : CLAUDE.md, pré-autorisation 1 (base de recette Test) — jeu de
données versionné dans le dépôt, idempotent (`where not exists`), aucune ligne
d'un autre site touchée.

## 2. Jeu/emplacements de recette créés (résidu minimal, documenté)

```
fdj_games    : "Jeu Recette FDJ" (nexus-station-test)
fdj_locations: "Bureau" (bureau), "Caisse" (caisse), "Zone bloquée" (bloque)
```

## 3. Qualification réelle (`outils/recette-fdj-carnets-qualification-20261004.js`)

Navigateur réel (Playwright/Chromium), session Manager Test authentifiée
(PIN jamais lu ni journalisé), franchissement réel de la prise de poste
(rôle Manager) puis de l'écran FDJ Manager. Deux exécutions indépendantes,
résultats identiques :

**a) Commit servi** — lu dans la page via `NexusBuild.commit` :
`53d7cb650edeee10cbfd18fbb01e7be7f50e5765`. C'est le commit exact qui
contient la correction qualifiée (§4 de `request-1.md`).

**b) Réconciliation (§4 de request-1.md), sur le moteur RÉELLEMENT SERVI** —
`NexusFdjMoteur.soldesCarnetsAvecReference` exécuté dans la page (pas une
resimulation Node) sur un mouvement `transfert`(10) + `activation`(4) +
`correction`(−1) : résultat `confies: 10, actives: 3` — exactement l'attendu
(l'activation fautive annulée sans jamais toucher `confies`/`bureau`, ce
qui était le bug). **Confirme que le correctif est bien dans le code livré
au navigateur**, pas seulement dans la suite Node.

**c) Idempotence serveur réelle — les 6 écritures manager fermées (§5)** —
pour chacune des 6 opérations (`reception`, `reappro_caisse`,
`retrait_caisse`, `blocage`, `retour_bloque`, `rapprochement_activation`),
le même jeton (`crypto.randomUUID()`, un seul par opération) a été envoyé
à `fdj_enregistrer_mouvement_stock` **deux fois de suite** — exactement le
scénario d'un retry réseau après perte de réponse. Lu directement dans la
réponse du **serveur** (pas une requête de comptage séparée) :

| Opération | 1er appel | 2e appel (même jeton) |
|---|---|---|
| reception | `ecrits:1, idempotent:false` | `ecrits:0, idempotent:true, rejeux:1` |
| reappro_caisse | idem | idem |
| retrait_caisse | idem | idem |
| blocage | idem | idem |
| retour_bloque | idem | idem |
| rapprochement_activation | idem | idem |

**6/6 — le retry réseau ne produit jamais de second mouvement**, conforme
à la fermeture du gap d'idempotence (migration `20260916221000`,
`fdj_cle_idempotence`). Le double-clic UI lui-même reste couvert par le
bouton désactivé pendant l'écriture (comportement client préexistant, non
modifié par ce lot) — ce qui manquait et qui est maintenant fermé, c'est le
cas où la requête atteint réellement le serveur et que seule la réponse se
perd, exactement ce que ce test mesure.

**d) Dette §8, confirmée réelle, PAS corrigée, sans écriture de doublon** —
`genererIdempotencyKey()` (même fonction utilisée par les 2 écritures
employé et par `creerActivationReconstitueeCorrectionManager`) a été
appelée deux fois de suite en page : deux UUID **distincts**. Preuve
suffisante que ces 3 chemins minteraient une clé différente à chaque
retry — donc qu'un retry réel y créerait un doublon — **sans provoquer ce
doublon sur de vraies données** de recette (choix délibéré : la dette est
déjà actée et déférée à un futur lot par `request-1.md` §8 ; la démontrer
EN ÉCRIVANT un doublon n'aurait rien ajouté à ce qui est déjà su, pour un
coût en données inutile).

## 4. Empreinte laissée sur `nexus-test` (minimale, append-only, honnête)

6 mouvements de stock réels (quantité 1 chacun, un par opération testée),
site `nexus-station-test`, jeu `"Jeu Recette FDJ"`, justification
`"Recette qualification FDJ 04/10/2026"` pour les 4 qui en acceptent une.
Aucune suppression possible (append-only, aucune policy `update`/`delete`
sur `fdj_stock_movements`) — ce résidu est permanent, minimal et identifié.

## 5. Guardians, régression, Handoff

- `node outils/handoff.js verifier` : conforme avant/après (35 lots, aucune
  nouvelle erreur).
- `node outils/guardians-router.js` (diff réel du commit) : **1 finding**,
  la collision `NexusStock` déjà connue et tracée (ARCH-002, hors périmètre
  de ce lot) — 0 finding nouveau. Le script de qualification a été déplacé
  vers `outils/` précisément pour ne pas déclencher
  `dependance_applicative_vers_gouvernance` (il référence
  `outils/recette-navigateur-test.js`, ce qui est son rôle, pas un défaut).
- `node outils/guardian-qa.js` : 0 finding (303 épreuves).
- `node outils/verifier-apprentissage.js` : conforme, 21 règles.
- `node outils/garde-langage-nexus.js` : conforme (aucun tiret cadratin
  ajouté).
- `node run-tests.js` (suite complète) : aucune régression, seuls les 9
  échecs historiques connus subsistent.
- `node run-tests.js fdj` : 35/35.

## 6. Ce qui reste hors de ce request

- Les 3 requêtes `SELECT` de `audit-production-lecture-seule-1.sql` (audit
  d'impact historique du bug §4 en Production) — toujours réservées à
  l'Orchestrator, aucun accès Production dans ce canal.
- Arbitrage sur la dette §8 (clés fraîches, 3 chemins) — confirmée réelle
  ici, toujours non tranchée (nouveau lot ou non, au choix de Frédéric).
- Point Zéro Inventaire FDJ — spécifié, toujours pas exécuté, conformément
  à `decision-1.md`.

## Verdict proposé

**`QUALIFIE_NEXUS_TEST`** — la correction de réconciliation et la fermeture
du gap d'idempotence sont toutes deux vérifiées en conditions réelles
(navigateur, session Manager Test, commit servi confirmé), sans divergence
masquée, sans régression. Ce verdict ne vaut ni promotion Production ni
clôture du lot : l'audit Production (point 3 ci-dessus) et l'arbitrage §8
restent ouverts.

## Invariants respectés

Aucun changement `main`/`production`, aucune fusion vers `production`,
aucun déploiement Production, aucune migration Production, aucune
écriture/réparation Production, aucune gate Pages Production, aucune
opération sur l'écart `20261004130000` de la branche `production`, aucun
secret créé/lu/exposé (PIN jamais journalisé — vérifié dans la sortie du
script), Point Zéro non exécuté, aucune réécriture d'un historique validé.
