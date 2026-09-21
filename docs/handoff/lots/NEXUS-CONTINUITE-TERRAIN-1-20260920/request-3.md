---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 3
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408_production=6c3efcc
  - id: candidat-sha
    classe: VERIFIED
    valeur: 8a5fc2b1ec2f19d67ce34bcde4d6d4431a761169
  - id: decision-2-consommee
    classe: VERIFIED
    valeur: commit_845e01e
  - id: tests-nouveaux
    classe: VERIFIED
    valeur: test_continuite_terrain_p0_20260920.js_10_sur_10
  - id: non-regression-ciblee
    classe: VERIFIED
    valeur: verify_8sur8_carburant_commande_21sur21_app_donnees_1sur1_continuite_4sur4
  - id: non-regression-globale
    classe: VERIFIED
    valeur: 262_sur_272_1_seul_echec_hors_liste_connue_topologie_migrations
  - id: handoff-v2-fixture
    classe: VERIFIED
    valeur: test_handoff_v2_20260905.js_53_sur_53_disparu
  - id: migrations-immuables-residuel
    classe: VERIFIED
    valeur: 14_migrations_production_absentes_du_checkout_topologie_non_imputable
  - id: guardians
    classe: VERIFIED
    valeur: guardians-router_0_finding_verifier-apprentissage_conforme_21_regles
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 31_lots_10_avertissements_0_nouvelle_erreur
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Candidat P0-1/P0-3 figé sur le rail canonique, tests rejoués, chemin Production restant

Périmètre exécuté strictement conforme à `decision-2.md` : aucun nouveau diff
métier — le code P0-1/P0-3 était déjà transporté sur le rail canonique par le
commit `8a5fc2b` avant ce réveil. Ce lot consomme `decision-2.md`, rejoue les
tests ciblés et la suite complète sur ce HEAD, et vérifie le sort des deux
échecs précédemment attribués à la topologie/aux fixtures Handoff. Aucun
geste Production. `config-par-environnement` non touchée.

## Candidat figé

- **SHA du diff métier P0-1/P0-3** (inchangé depuis le dépôt de `request-2.md`) :
  `8a5fc2b1ec2f19d67ce34bcde4d6d4431a761169` — "handoff: transporter
  request-2 sur le rail canonique".
- **HEAD de ce réveil** : `845e01e2cd61335641d3dbb270f6c46da158ebf8` — ajoute
  uniquement `decision-2.md` par-dessus, aucun changement de code.
- Fichiers touchés par le candidat (inchangés depuis `request-2.md`) :
  `nexus-app-donnees.js`, `nexus-conseiller-donnees.js`, `NEXUS-App-v1.html`,
  `test_continuite_terrain_p0_20260920.js`.

## Tests rejoués sur ce HEAD (pas recopiés d'un rapport antérieur)

- `node test_continuite_terrain_p0_20260920.js` → **10/10**.
- `node run-tests.js verify` → **8/8**.
- `node run-tests.js carburant_commande` → **21/21**.
- `node run-tests.js app_donnees` → **1/1**.
- `node run-tests.js continuite` → **4/4**.
- Suite complète : **262/272** (contre 261/272 déclaré par `request-2.md`).

## Sort des deux échecs Handoff signalés par `request-2.md`

- **`test_handoff_v2_20260905.js` → DISPARU, 53/53.** La fixture attendait
  `branch: config-par-environnement` en dur ; le commit `d9f1841` (« aligner
  le validateur sur le rail actif »), déjà présent sur ce rail avant ce
  réveil, fait désormais écrire `handoff-continuite-20260920` — exactement ce
  que `decision-2.md` demandait de vérifier après « le transport canonique de
  `request-2.md` et les corrections d'infrastructure Handoff déjà présentes
  sur le rail ».
- **`test_migrations_immuables_20260905.js` → RÉSIDUEL, cause confirmée
  identique à celle déjà rapportée.** Compare `supabase/migrations/` de la
  branche courante à celles de `production` par `git ls-tree`/`git show` — un
  contrôle de contenu, aucun accès réseau/secret. 14 fichiers présents sur
  `production` sont absents de ce checkout
  (`20260914210000_mes_ecarts_caisse_projection_employe.sql` …
  `20260920140000_bascule_source_precedente_et_change_le.sql`) : ce sont des
  migrations livrées sur `production`/`main` après la création de la branche
  `handoff-continuite-20260920`, jamais rebasées sur ce rail de travail.
  Vérifié : aucun de ces 14 noms n'existe nulle part dans
  `supabase/migrations/` sur ce checkout (pas seulement modifié), et le
  candidat P0-1/P0-3 (`8a5fc2b`) ne touche aucun fichier sous
  `supabase/migrations/`. Purement topologique, non imputable à ce diff — ni
  ajouté à `docs/qa/ECHECS-CONNUS.json` (toujours 9 entrées, `mesure_le:
  2026-09-08`, ni l'un ni l'autre des deux fichiers n'y figure).

Total 262/272 = 9 échecs connus + ce seul résiduel topologique.

## Guardians / apprentissage

- `node outils/guardians-router.js` → 0 finding (1 fichier changé dans ce
  lot — `decision-2.md` lui-même —, scopes `orchestrator`/`handoff`, 3 règles
  en portée).
- `node outils/verifier-apprentissage.js` → conforme, 21 règles, aucun
  doublon, aucune récurrence non promue.
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt (31
  lots, 10 avertissements préexistants, 0 nouvelle erreur).

## Chemin restant jusqu'à Production

Aucun changement de code n'est requis pour P0-1/P0-3 eux-mêmes (diff minimal,
rétrocompatible, sans migration ni RLS — déjà noté par `request-2.md`). Ce
qui reste, dans l'ordre :

1. **Résoudre la divergence de topologie** avant toute promotion : rebaser ou
   fusionner `handoff-continuite-20260920` sur les 14 migrations déjà
   présentes sur `production`/`main`, sinon `test_migrations_immuables` reste
   rouge et la promotion réelle recréerait l'incohérence qu'il détecte.
2. **Décision distincte sur la promotion Production de P0-1/P0-3** — non
   demandée ici, conformément au critère de sortie de `decision-2.md` : ce
   dépôt ne fait que préparer et prouver, il ne demande pas le GO.
3. **P0-2** reste une écriture de donnée Production (`station_config.raccourcis`)
   — non exécutée, GO Créateur toujours requis, chiffrage inchangé depuis
   `request-2.md`.
4. **B1** reste fermé — aucun changement de rôle/RLS/compte/PIN dans ce lot.
5. Les trois points laissés ouverts par `request-1.md` (B1, calendrier
   P0-1/P0-3, porteur de `public.rappels`) restent sans arbitrage.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase (aucun accès
depuis ce canal), aucune écriture `station_config.raccourcis`/`public.rappels`
en Production, aucune promotion/réinitialisation de compte (B1 fermé), aucune
fusion #62/#65, `config-par-environnement` non touchée, aucun secret exposé,
aucun refactor opportuniste.

## STOP

Conformément à `decision-2.md` : ce lot ne se déclare pas terminé et ne
demande pas la promotion Production. STOP à cette gate — aucune exécution
supplémentaire sans nouvelle décision.
