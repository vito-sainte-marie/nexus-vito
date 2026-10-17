<!-- MIROIR v1 — NE PAS ÉDITER. Source canonique : docs/handoff/lots/FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016/request-5.md
     Régénéré par outils/handoff.js. Le protocole v2 lit le registre, pas ce fichier. -->
---
protocol: nexus-handoff/2
kind: request
lot_id: FAST-TRACK-POMPISTE-RELEVES-PISTE-20261016
seq: 5
author: Claude
branch: handoff-continuite-20260920
status: AWAITING_DECISION
token_mode: STANDARD
wake_to: https://github.com/vito-sainte-marie/nexus-vito/issues/28
preuves:
  - id: refs-protegees
    classe: VERIFIED
    valeur: main=55285d8b production=3a014991
  - id: merge-base-production
    classe: VERIFIED
    valeur: 501c0c744c3327dd5693a2bddc45d064045ca474
  - id: diff-applicatif-production
    classe: VERIFIED
    valeur: 155-fichiers
  - id: migration-ecrite
    classe: VERIFIED
    valeur: 20261016230000_creer_carburant_index_releves_piste.sql@e190bbe1
  - id: epreuve-statique
    classe: VERIFIED
    valeur: test_carburant_index_releves_piste_20261016.js-10sur10
  - id: migration-appliquee-test
    classe: NOT_APPLICABLE
    valeur: ecrite-non-appliquee-canal-sans-acces-supabase
---
# FAST TRACK — Parcours Pompiste : incrément 1 (persistance Test), suite demandée

Auteur : Claude, réveil CI sur le rail `handoff-continuite-20260920`. decision-3.md
(APPROVED_WITH_CONDITIONS) a été pris en charge (`consommer --prise-en-charge`,
commit `662605cf`), puis consommée par l'action ci-dessous
(`consommer --preuve-action`, commit `e190bbe1`).

## Ce que decision-3 autorisait

Lever la condition 3 de decision-1 (brief intégral) et « commencer l'incrément
Test autorisé » (`ACTION_NEXT`), dans les conditions reprises de decision-1 :
développement/migration/déploiement/recette limités à Test et à la branche,
aucune PR `main`/`production`, valeurs métier provisoires restant déclarées
comme telles, migration Test-only préservant `site_id`, l'isolation multisite
et les RLS.

## Preuve des conditions de decision-3

1. **Limité à Test et à la branche, aucune PR `main`/`production`.** Aucune
   écriture sur `main` ou `production` : seul le commit `e190bbe1` sur le rail
   `handoff-continuite-20260920`. `git merge-base --is-ancestor
   origin/handoff-continuite-20260920 HEAD` vérifié avant le push (aucune
   divergence). Aucune commande `git push` vers une autre réf.
2. **`site_id`, isolation multisite et RLS préservés.** La migration
   `supabase/migrations/20261016230000_creer_carburant_index_releves_piste.sql`
   active `enable row level security` sur les quatre tables créées
   (`carburant_index_releves`, `carburant_index_valeurs`,
   `carburant_index_corrections`, `carburant_gnr_statuts`) ; chaque `select`
   est borné à `site = current_employee_site_id()` (ou créateur avec
   `acces_createur_autorise`) ; `site` sur les deux tables filles est
   **hérité par trigger** depuis la déclaration parente, jamais fourni par
   l'appelant (aucun chemin pour écrire une valeur sous un autre site que le
   sien). Vérifié statiquement par `test_carburant_index_releves_piste_20261016.js`
   (10/10, exécuté localement : voir la sortie ci-dessous), qui échoue si une
   table perd sa RLS, si une policy UPDATE/DELETE apparaît sur une table
   append-only, ou si un trigger d'héritage disparaît.
3. **Migration Test-only, non appliquée en Production.** Classée dans
   l'addendum du 16/10/2026 de
   `docs/handoff/MANIFESTE-MIGRATIONS-PRODUCTION-COURANT.md` : « Proposée
   incluse dans une future release Production », **écrite et NON appliquée**.
   Aucune commande SQL exécutée sur `nexus-test` ni sur Production par ce
   canal (classe `DECLARED`, pas `VERIFIED` : ce canal n'a pas d'accès réseau
   à Supabase — voir « Limite nommée » ci-dessous).
4. **Valeurs métier provisoires déclarées comme telles.** Cet incrément
   n'écrit aucune des six valeurs provisoires listées par request-4 (seuil
   4000 L, régularisation Q1/Q2, durée de conservation, OCR différé, remise
   en service GNR, quart sans Q2) : il pose la persistance, pas les contrôles
   métier qui les consomment. Le seul chiffre métier du brief (l'index GNR de
   référence `1191213`) n'est écrit par aucune ligne de cette migration —
   vérifié par `test_carburant_index_releves_piste_20261016.js` (« aucune
   donnée n'est semée »).

## Preuve d'exécution

```
$ node test_carburant_index_releves_piste_20261016.js
OK — les quatre tables sont créées
OK — RLS activée sur les quatre tables
OK — chaque table append-only ne porte aucune policy UPDATE/DELETE
OK — carburant_index_releves porte une policy UPDATE bornée (brouillon ou manager), jamais DELETE
OK — site est hérité par trigger sur les deux tables filles qui le portent
OK — les deux RPC sont SECURITY DEFINER avec search_path fixé
OK — les deux RPC révoquent public/anon et déclarent authenticated par un marqueur
OK — la correction annule systématiquement recopiee et exige un motif
OK — aucune donnée n'est semée (pas d'INSERT hors des deux triggers de la migration elle-même)
OK — les contraintes de format 7/6 chiffres sont présentes
Tout est vert — test_carburant_index_releves_piste_20261016.js
```

Gardes existantes rejouées sans régression de leur part : `test_manifeste_
migrations_complet_20260909.js` (6/6 — la nouvelle migration est classée dans
l'addendum), `test_garde_revoke_fonction_roles_nommes_20261001.js` (14/14 —
dette gelée toujours à 43, les deux nouvelles RPC sont pleinement statuées dès
leur création), `test_migrations_immuables_20260905.js` (5/5),
`test_droits_ci_dans_migrations_20260909.js` (10/10).

## Écart constaté, non causé par ce lot

`node run-tests.js` signale `test_executants_fermes_20261014.js` et
`test_relais_arbitre_openai_20261007.js` en régression dans CETTE session
interactive. Cause mesurée, pas supposée : les deux comparent
`process.env.GITHUB_SHA` à `git rev-parse HEAD` du dépôt
(`outils/relais-arbitre-openai.js:191-193`) ; `GITHUB_SHA` hérité de cette
session vaut `55285d8b…`, SHA actuel de `main` (confirmé par
`git log -1 55285d8b…` et `git branch -a --contains`), parce que cette session
a été ouverte sur l'évènement `main` avant de travailler sur le rail. Toute
nouvelle écriture sur le rail avance `HEAD` sans jamais faire bouger
`GITHUB_SHA` hérité, donc ce désaccord existait déjà après le commit de prise
en charge (`662605cf`), avant la moindre ligne de cette migration. Dans le job
réel `tests.yml`, `GITHUB_SHA` est celui du commit poussé sur le rail et
concorde avec `HEAD` au checkout : ceci n'est pas un défaut du code de ce lot,
et rien n'a été modifié dans `outils/relais-arbitre-openai.js` ni dans
`test_executants_fermes_20261014.js` pour le faire taire.

## Limite nommée — application de la migration sur `nexus-test`

Pré-autorisation 1 de `CLAUDE.md` (« alimenter, réinitialiser ou corriger la
base de recette Test ») couvre le geste, mais ce canal (session Claude sans
`SUPABASE_TEST_DB_URL_WRITE`, sans accès réseau à Supabase) ne peut pas
l'exécuter lui-même. La migration est **écrite et non appliquée**, comme
plusieurs entrées antérieures du même manifeste (02/10, 03/10 17 h-19 h).
Reste à faire par un canal avec accès réel à `nexus-test` : appliquer le
fichier, relire le schéma, puis — hors périmètre de cette demande — semer la
valeur GNR de référence (`1191213`) sur `nexus-station-test` sous la même
pré-autorisation.

## Reste à faire sur ce lot (non bloquant pour ce tour)

- Écrans : un par pompe (ordre physique P1 GO|SP, P2 SP|GO, P3 GO|SP, P4
  SP|GO), saisie 7 chiffres, pavé numérique, entrée contextuelle (ouverture /
  Q2 / fin de quart), reprise de brouillon.
- OCR Veeder-Root (cadrage, file `documents_ocr_file` existante, vérification
  visuelle, repli manuel).
- Écran de recopie Decenium (ordre SP puis GO par pompe puis GNR, coche de
  progression, confirmation texte exact).
- Contrôles métier applicatifs : index inférieur au précédent, écart > 4000 L,
  comparaison fin Q1 / début Q2.
- Recette navigateur (mobile, Safari iOS si disponible) et rapports C
  (preuves), D (UX), E (livraison).

Ce lot reste ouvert (`closes: false`). Hors périmètre, non demandé : fusion
vers `main`, déploiement ou migration Production, données réelles, OCR payant,
remise en service du GNR.
