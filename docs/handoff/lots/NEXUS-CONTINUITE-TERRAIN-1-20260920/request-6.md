---
protocol: nexus-handoff/2
kind: request
lot_id: NEXUS-CONTINUITE-TERRAIN-1-20260920
seq: 6
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
  - id: garde1-migration-identique
    classe: VERIFIED
    valeur: sha256_identique_rail_production_git_diff_vide
  - id: garde1-guard-reelle
    classe: VERIFIED
    valeur: test_migrations_immuables_20260905_passe
  - id: contre-preuve-mutation-garde1
    classe: VERIFIED
    valeur: 8_sur_8_mutation_logique_toujours_detectee
  - id: garde2-manifeste-cable
    classe: VERIFIED
    valeur: test_manifeste_migrations_complet_20260909_6_sur_6
  - id: garde2-empreinte-verifiee
    classe: VERIFIED
    valeur: empreinte_sha256_addendum_concorde_manifeste_historique
  - id: manifeste-historique-inchange
    classe: VERIFIED
    valeur: empreinte_sha256_identique_avant_apres
  - id: contre-preuve-mutation-garde2
    classe: VERIFIED
    valeur: 8_sur_8_migration_manquante_et_manifeste_altere_detectes
  - id: non-regression-globale
    classe: VERIFIED
    valeur: 265_sur_274_9_connus_0_nouveau_2_gardes_desormais_vertes
  - id: guardians
    classe: VERIFIED
    valeur: 1_finding_nexusstock_deja_connu_arch-002_0_nouveau_imputable
  - id: apprentissage
    classe: VERIFIED
    valeur: 21_regles_conforme
  - id: handoff-verifier
    classe: VERIFIED
    valeur: 31_lots_10_avertissements_0_nouvelle_erreur
  - id: decision-5-consommee
    classe: VERIFIED
    valeur: commit_9b8e0b3
  - id: production
    classe: NOT_APPLICABLE
    valeur: aucune_requete_aucun_merge_aucun_deploiement
---
# Les deux corrections minimales de garde CI appliquées, sans rouvrir ce que `decision-5.md` protège

Périmètre exécuté strictement conforme à `decision-5.md` : les deux
corrections identifiées et proposées par `request-5.md` sont maintenant
appliquées, sans exécuter de SQL, sans opération Supabase/Production, sans
rouvrir le manifeste historique clos.

## Garde 1 — migration alignée octet pour octet sur `production`

`supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql`
sur le rail est remplacé par le contenu **exact** de sa version sur
`origin/production` (`git show` en lecture seule, copié tel quel — jamais
retapé à la main). Vérifié par trois voies indépendantes :

```
sha256sum(rail)       = 3a8c27b0c400679077e300644301098f2373091d9eeef7bc26f669f2cc637328
sha256sum(production)  = 3a8c27b0c400679077e300644301098f2373091d9eeef7bc26f669f2cc637328
git diff origin/production:<chemin> <chemin>   → vide
node outils/comparer-migration-documentaire.js 20260911180600_pointage_exige_service_et_evenement.sql
  → Verdict : IDENTIQUE (production: 6687 octets, rail: 6687 octets)
```

Aucune ligne SQL exécutable n'a jamais divergé (déjà établi par
`request-5.md`) ; les 31 lignes de commentaire ajoutées sont l'intégralité de
l'écart, désormais résorbé dans le sens que `test_migrations_immuables_20260905.js`
exige (le rail reflète ce qui est réellement appliqué en Production, jamais
l'inverse). **Aucun SQL exécuté.**

## Garde 2 — contrôle réel câblé sur le manifeste append-only, manifeste historique intact

`test_manifeste_migrations_complet_20260909.js` lit désormais le manifeste
historique **et**
`docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md` (le même mécanisme
que `outils/verifier-manifeste-migrations-complet.js`, réutilisé — pas
redupliqué), et refuse de conclure si l'empreinte SHA256 figée dans
l'addendum ne concorde plus avec le manifeste historique réel :

```
node test_manifeste_migrations_complet_20260909.js
OK — la promotion n'est pas vide et part du bon endroit
OK — l'addendum porte l'empreinte exacte du manifeste historique réel — sinon on refuse de conclure
OK — CHAQUE migration de la promotion est citée au manifeste historique ou à son addendum
OK — le manifeste (historique + addendum) ne cite aucune migration qui n'existe plus
OK — une migration qui SE DÉCLARE Test/CI est marquée exclue
OK — toute migration touchant le rôle CI se DÉCLARE Test/CI
6/6 vérifications passées
```

Le manifeste historique du lot clos `NEXUS-PRODUCTION-READINESS-1-20260908`
n'est ni rouvert ni modifié — vérifié par SHA256 avant et après ce geste,
identique à l'empreinte déjà figée dans l'addendum le 21/09/2026 :
`59f9f95e9fe03e9227f1355885da3f68474a1fae097dfa58193ed1ae3dc90fa7`. La
proposition « 14 migrations incluses, non arbitrée » de l'addendum n'est pas
non plus modifiée par ce geste : ce lot câble la LECTURE du mécanisme, il ne
tranche toujours pas la promotion réelle de ces 14 migrations.

## Tests des deux gardes rejoués — mutations toujours actives

`test_comparer_migration_documentaire_20260921.js` (8/8) : les trois épreuves
qui portaient sur l'état AVANT correction sont mises à jour pour vérifier
l'état APRÈS (verdict `IDENTIQUE`, SHA256 identique, `git diff` vide) — sans
retirer aucune contre-preuve par mutation : une divergence de logique SQL
reste classée `DIVERGENCE_LOGIQUE` (jamais documentaire), un commentaire en
fin de ligne de code reste comparé tel quel.

`test_manifeste_migrations_append_only_20260921.js` (8/8, **inchangé**) :
les deux contre-preuves par mutation continuent de fonctionner à l'identique
— une migration retirée de l'addendum est détectée comme non classée, un
manifeste historique altéré (en mémoire, jamais écrit) fait échouer le
contrôle plutôt que de certifier sur une base mouvante.

## Régression, Guardians, Handoff

- `node run-tests.js` : **265/274** — les 9 échecs connus habituels, plus les
  deux fichiers de test des gardes (déjà comptés dans les 265, désormais
  verts). **+2 par rapport à `request-5.md` (263/274)**, exactement les deux
  tests que ce lot corrige. **0 nouvelle régression.**
- `node outils/guardians-router.js` sur le diff réel de ce lot
  (`9b8e0b3...HEAD`) → 1 finding, la collision `NexusStock` déjà connue et
  tracée (Backlog `ARCH-002`, non bloquante) — **0 nouveau finding
  imputable**.
- `node outils/verifier-apprentissage.js` → conforme, 21 règles.
- `node outils/handoff.js verifier` → conforme avant et après ce dépôt (31
  lots, 10 avertissements préexistants, 0 nouvelle erreur).
- `decision-5.md` consommée (`outils/handoff.js consommer`).

## Refs protégées

`main = a786408`, `production = 6c3efcc` — identiques avant et après ce
geste. Aucune opération Supabase.

## Impact exact en fichiers

```
supabase/migrations/20260911180600_pointage_exige_service_et_evenement.sql   (contenu remplacé, octet pour octet = production)
outils/verifier-manifeste-migrations-complet.js                              (commentaire d'en-tête mis à jour : câblage effectif)
docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md                      (note mise à jour : mécanisme câblé, pas seulement proposé)
test_manifeste_migrations_complet_20260909.js                                (câblage réel : lit aussi l'addendum + vérifie l'empreinte)
test_comparer_migration_documentaire_20260921.js                             (3 épreuves alignées sur l'état corrigé, mutations conservées)
```

Aucun fichier applicatif métier. Aucune migration Production exécutée.
Manifeste historique jamais réécrit.

## Ce que ce lot ne fait pas

Ne tranche pas la promotion réelle des 14 migrations de l'addendum en
Production (reste une gate distincte, déjà signalée comme « PROPOSITION —
non arbitrée »). Aucun transport de migration Test/CI vers Production. Aucun
portage applicatif, `dd4d0f3`, P0-1/P0-3, NEXUS Live, #62/#65, P0-2, B1,
rappels. Aucun merge/rebase/squash, aucune écriture Supabase, aucune
Production, aucun élargissement de permissions GitHub.

## Invariants respectés

Aucun changement `main`/`production`, aucune opération Supabase, aucune
promotion Production, aucun secret exposé, aucun merge/rebase/squash de
`production` vers le rail, aucun portage applicatif, aucune réécriture du
manifeste historique clos.

## STOP

Conformément à `decision-5.md` §6 : les deux corrections minimales sont
appliquées et prouvées (preuve, contre-preuve par mutation, régression,
Guardians, apprentissage, Handoff). STOP à cette gate — aucune exécution
supplémentaire sans nouvelle décision, en particulier aucune décision sur la
promotion réelle des 14 migrations proposées par l'addendum.
