---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 4
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: DEEP
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=a786408 production=6c3efcc
  - id: transport-14-migrations
    classe: VERIFIED
    valeur: git_show_origin_production_octet_pour_octet
  - id: identite-sha256
    classe: VERIFIED
    valeur: 14_sur_14_concordance
  - id: identite-blob-git
    classe: VERIFIED
    valeur: 14_sur_14_concordance_hash-object
  - id: immuabilite-rejouee
    classe: VERIFIED
    valeur: nouvel_echec_20260911180600_commentaire_seul_logique_identique
  - id: manifeste-migrations-effet-bord
    classe: VERIFIED
    valeur: test_manifeste_migrations_complet_20260909_nouvel_echec_hors_perimetre
  - id: non-regression-globale
    classe: VERIFIED
    valeur: 261_sur_272_9_connus_2_nouveaux_rapportes
  - id: guardians
    classe: VERIFIED
    valeur: 1_finding_nexusstock_deja_connu_arch-002_0_nouveau_imputable
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 31_lots_10_avertissements_0_nouvelle_erreur
  - id: refs-protegees-inchangees
    classe: VERIFIED
    valeur: main_a786408_production_6c3efcc
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# 14 migrations transportées octet pour octet, deux échecs nouveaux démasqués

Périmètre exécuté strictement conforme à `decision-3.md` : transport de dépôt
uniquement, aucune exécution SQL, aucun `supabase db push`, aucune fusion,
aucun rebase, aucun portage applicatif. `main` et `production` inchangées.

## Transport

Les 14 fichiers déjà présents sur `production` et absents du rail (listés par
`mesure-migrations-rail-production-1.md`) ont été copiés **octet pour octet**
via `git show origin/production:<chemin>` (lecture pure, aucune exécution) :

```
20260914210000_mes_ecarts_caisse_projection_employe.sql
20260916193000_prise_de_poste_ninvente_plus_la_fin.sql
20260916194000_regularisation_fins_inventees_prise_de_poste.sql
20260916195000_cloture_source_cycle_pilote.sql
20260916210000_mes_ecarts_caisse_masque_le_provisoire.sql
20260919160000_horaires_moteur_unique_et_retard_nullable.sql
20260919180000_planning_source_officielle_projection_normalisee.sql
20260919200000_import_planning_google_sheets.sql
20260919220000_bascule_source_planning_tracee.sql
20260919240000_horodatage_serveur_planning_shifts.sql
20260919260000_bascule_source_planning_date_effet.sql
20260919280000_source_precedente_a_la_date_d_effet.sql
20260920120000_droits_v_planning_officiel.sql
20260920140000_bascule_source_precedente_et_change_le.sql
```

## Preuves d'identité — deux méthodes indépendantes, concordance 100 %

Pour chacun des 14 fichiers : SHA256 du contenu et SHA du blob git
(`git rev-parse origin/production:<chemin>` vs `git hash-object <chemin>`).
Les deux méthodes concordent sur les 14 fichiers, sans exception. Le diff de
ce geste (`ef12e7e`/`b4878f8`) est strictement limité aux 14 nouveaux fichiers
+ `docs/handoff/STATE.json` (consommation de `decision-3.md`) +
`docs/handoff/DECISION.md` (miroir régénéré par l'outil).

## Immuabilité rejouée — un nouvel échec, exactement démasqué comme prévu

`node test_migrations_immuables_20260905.js` ne bloque plus sur les migrations
manquantes. L'étape suivante échoue : **`20260911180600_pointage_exige_service_et_evenement.sql`**
a un contenu divergent entre le rail et `production`. Diff exact (`git diff
origin/production:<chemin> <chemin>`) : uniquement un bloc de commentaire de
32 lignes documentant l'ordre de déploiement (« LE CODE D'ABORD, LE TRIGGER
ENSUITE », état mesuré le 16/09/2026) présent sur le rail et absent de la
version réellement appliquée en Production. **Aucune divergence de logique
SQL** — le `create or replace function` et tout ce qui suit sont identiques
byte pour byte. Le fichier n'est pas un des 14 transportés dans ce lot ; il
préexistait sur le rail (seul commit : `f682ed6`, "Plus aucun pointage ne se
cherche un service : la règle passe en base"), et son écart était **masqué**
par l'échec précédent sur les migrations manquantes — exactement ce que
`decision-3.md` anticipait.

**Non ajouté à `docs/qa/ECHECS-CONNUS.json`** (toujours 9 entrées, `mesure_le:
2026-09-08`), conformément à l'instruction explicite. Non corrigé : modifier
ce fichier serait un portage applicatif hors périmètre de ce lot.

## Second échec, effet de bord non anticipé par `decision-3.md`

`node run-tests.js` complet : **261/272** (9 connus + 2 nouveaux, contre
262/272 déclaré par `request-3.md` avant ce transport). Le second nouvel
échec n'est pas une réapparition de l'immuabilité : c'est
**`test_manifeste_migrations_complet_20260909.js`**, qui appartient au lot
distinct et déjà clos `NEXUS-PRODUCTION-READINESS-1-20260908`
(`DECISION_CONSOMMEE`, `decision-9.md`). Ce test lit
`docs/handoff/lots/NEXUS-PRODUCTION-READINESS-1-20260908/manifeste-migrations-production-1.md`
et exige que toute migration postérieure à `20260904175722` (dernière connue
appliquée en Production le 08/09) y soit classée incluse/exclue/bloquée. Les
14 migrations transportées par ce lot sont toutes postérieures à cette borne
et n'apparaissent pas dans ce manifeste écrit avant leur existence sur ce
rail — le test le détecte exactement comme sa propre doctrine le prévoit
(« un contrôle refait à la main ne se refait pas », cf. son en-tête).

**Cause directe de ce transport**, pas préexistante : avant le transport,
ces 14 fichiers n'existaient pas dans `supabase/migrations/` sur ce rail, donc
`promotion.filter(...)` ne les voyait pas. Le manifeste appartient à un lot
fermé le 11/09 ; le mettre à jour dépasse le périmètre de `decision-3.md`
(transport uniquement, aucun travail hors des 14 migrations et de leurs
preuves). Non corrigé, non ajouté aux échecs connus — rapporté ici pour
arbitrage.

## Guardians / apprentissage / Handoff

- `node outils/guardians-router.js` sur le diff réel de ce lot (14 migrations
  + `STATE.json`) → 1 finding, la collision `NexusStock` déjà connue et
  tracée (Backlog `ARCH-002`, non bloquante par arbitrage Q73/Q74 du
  07/09/2026) — **0 nouveau finding imputable**, aucun des 14 fichiers
  transportés n'y est impliqué.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles, aucun
  doublon, aucune récurrence non promue.
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt (31
  lots, 10 avertissements préexistants, 0 nouvelle erreur).

## Refs protégées

`main = a786408`, `production = 6c3efcc` — identiques avant et après ce
geste, confirmé par `git rev-parse`. Aucune écriture, aucun fetch de push,
aucun accès Supabase.

## Ce que ce lot ne fait pas

Aucune correction du contenu de `20260911180600_pointage_exige_service_et_evenement.sql`
(portage applicatif, hors périmètre). Aucune mise à jour du manifeste du lot
`NEXUS-PRODUCTION-READINESS-1-20260908` (lot distinct, déjà clos). Aucun
transport des 11 migrations Test/CI vers Production. Aucun portage applicatif
des 79 commits, de `dd4d0f3`, P0-1/P0-3 ou NEXUS Live. Aucun travail #62/#65,
P0-2, B1 ou `public.rappels`. Aucun élargissement des permissions GitHub.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
promotion Production, aucun secret exposé, aucun merge/rebase/squash de
`production` vers le rail, aucun portage applicatif.

## STOP

Conformément à `decision-3.md` : ce lot ne se déclare pas terminé et ne
demande pas de promotion Production. Deux échecs nouveaux rapportés pour
arbitrage — ni corrigés, ni maquillés, ni ajoutés silencieusement aux échecs
connus. STOP à cette gate — aucune exécution supplémentaire sans nouvelle
décision.
