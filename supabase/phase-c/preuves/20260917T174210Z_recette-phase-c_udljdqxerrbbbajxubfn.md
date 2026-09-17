# Preuve d'exécution — recette de la Phase C sur nexus-test

Fichier **engendré** par `supabase/phase-c/recette-test.sh`. Ne pas le
modifier à la main : il ne vaut que parce que personne ne l'a écrit.

## 1. Quand, quoi, où

| | |
|---|---|
| Date UTC | `2026-09-17T17:42:10Z` |
| Commit testé | `ee16e66127c81f50687839b80c8204c91550323b` |
| Branche | `fdj-vague1-cycle-caisse-20260916` |
| État du dépôt au lancement | **propre** (mesuré avant l'écriture de cette preuve) |
| Cible | nexus-test — projet `udljdqxerrbbbajxubfn` — `db.udljdqxerrbbbajxubfn.supabase.co:5432` |
| Production | `uzhjpqpctpvxytxpxoqz` — jamais visée, refus câblé dans le script |
| Mutations de validation | jouées |
| Prérequis Phase A disponibles | 12 fichiers (motif `2026091622*.sql`) — chargés seulement si la base ne les a pas ; voir §3 et §7 |

## 2. Empreintes des fichiers joués

| fichier | SHA-256 du contenu | blob git à HEAD |
|---|---|---|
| `supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` | `4deefefd4e2a2467e60d71060303537ffd7ca8bc48862147192d553380984764` | `1cdde4aa62c269e9737bbef7737da81c45f58ab3` |
| `supabase/phase-c/20260916230000_mutations_de_validation.sql` | `c1effd8ef8b3927f3e34e6c44b61e90783eb7704769b53ae1d31b0f5625af5b6` | `f0a5564c1fbea43d4aaf914dc3ff06a5a31b6d74` |
| `supabase/phase-c/recette-test.sh` | `aa453296a5f8d428ed2b760f9b4e543e5fc9bbf5091e466c7f39df685de2fbd5` | `02e6ec5a9380a28038279580286fd7a3fd8f9645` |

Le dépôt était propre : le contenu empreint et le blob du commit sont le même octet.

## 3. Prérequis de la Phase A retenus par le script

Ce que le glob a trouvé, dans l'ordre de chargement. Ce tableau dit ce
que le script **a l'intention** de charger ; le §7 dit ce qui a
**réellement** été chargé, chaque fichier s'y annonçant lui-même.

| # | fichier de `supabase/migrations/` | SHA-256 |
|---|---|---|
| 1 | `20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql` | `5144625c8f403401f7d279ee30c54f4054ec15b024a0ac6dcd1d8c26e70af4f6` |
| 2 | `20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql` | `bfd9365da593daaecfd19b4db7aef766f6f247b8383fd4609e22337524cf1a48` |
| 3 | `20260916220200_fdj_caisse_journal_evenements.sql` | `f2ef2ba214b8db201f18c5211bda12f38b3e75622bde3660f5917245935979a4` |
| 4 | `20260916220300_fdj_demandes_correction_apres_validation.sql` | `3b6b41082609e7e5d99bdc5a55e444be6a3f5d40f6c9bcd1b7a4175ed5125eb2` |
| 5 | `20260916220400_fdj_mouvements_auteur_et_date_effet.sql` | `00f59f8e19dd552d37ce795b1979dfd40d210a1dd72dab92f26be77d6cd1348a` |
| 6 | `20260916220500_fdj_commande_ouverture_quart.sql` | `c0783bcb4ad724e4c477980c195d229176e0c0d79d05e450bc1ebde1cfb65385` |
| 7 | `20260916220600_fdj_commandes_caisse_employe.sql` | `ae7529ff14e93f4069df536b8d1f5ec0f62e051d9468240f95f82e98bfc776d0` |
| 8 | `20260916220700_fdj_commandes_caisse_manager.sql` | `d75dd22ed0914867beaf6fa9086dd77d488a5cb9680035429057bb53e01c89a1` |
| 9 | `20260916220800_fdj_projection_employe.sql` | `213e58ee3236671ccce17b71e4fc02806bdb7043425050da4290d5eafdb3d27a` |
| 10 | `20260916220900_fdj_projection_progression.sql` | `6d3e5d649a1320d0445575fc26ba948aa4042eebeb1516f47bcd1369f0f9244d` |
| 11 | `20260916221000_fdj_commandes_activations_et_mouvements.sql` | `86f7d9b83dbab18eb6dd0f69a493cb84ed58b51cf6ae26dc2f90059517d26e47` |
| 12 | `20260916221100_fdj_commande_saisie_caisse_manager.sql` | `8463288fda5ad83b40039bf8bdc5275c36f77235b79e9857cfde7490a2a345a8` |

## 4. Le pilote réellement soumis à psql (expurgé)

Aucun des fichiers ci-dessus n'est joué seul : psql reçoit ce pilote, et
lui seul. Il est reproduit ici en entier — c'est lui qui ouvre la
transaction, décide de charger ou non la Phase A, appelle le corps, les
mutations, et termine par `rollback;`.

```
begin;
select (to_regclass('public.fdj_caisse_evenements') is null) as charger_phase_a \gset
\if :charger_phase_a
\echo '>> Phase A absente de cette base : chargée dans la transaction.'
\ir <travail>/prerequis.sql
\else
\echo '>> Phase A déjà présente : le corps est joué sur le schéma en place.'
\endif
\ir <travail>/corps.sql
\ir supabase/phase-c/20260916230000_mutations_de_validation.sql
rollback;
```

SHA-256 de ce texte expurgé : `95a5dfba0ca51abdb32b24c1ed0da1fe1e2a81916929f4ef8b64ef14c057ae83`. Le fichier
`<travail>/prerequis.sql` qu'il inclut est exactement la liste du §3,
dans cet ordre, chaque entrée précédée d'un `\echo` qui la nomme.

## 5. Commande exécutée (expurgée)

```
/opt/homebrew/opt/libpq/bin/psql 'postgresql://postgres@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require' -v ON_ERROR_STOP=1 -f pilote.sql
```

Le mot de passe ne figure jamais sur la ligne de commande : il est lu au
trousseau et passé à psql par l'environnement (`PGPASSWORD`).

## 6. Diff appliqué au corps — 4 lignes

Deux lignes substituées, le `begin;` et le `commit;`. Le script refuse
de continuer si ce diff n'en fait pas exactement quatre.

```diff
191c191
< begin;
---
> -- [RECETTE] begin;  -- la transaction est ouverte par la recette
782c782
< commit;
---
> -- [RECETTE] commit;  -- la recette termine par rollback
```

## 7. Sortie complète de psql (expurgée)

```
BEGIN
>> Phase A absente de cette base : chargée dans la transaction.
>> prerequis 01/12 : 20260916220000_fdj_quart_relie_a_la_prise_de_poste.sql
ALTER TABLE
DO
COMMENT
CREATE INDEX
ALTER TABLE
DO
COMMENT
ALTER TABLE
DO
COMMENT
ALTER TABLE
DO
COMMENT
COMMENT
COMMENT
CREATE FUNCTION
COMMENT
REVOKE
REVOKE
GRANT
GRANT
CREATE FUNCTION
COMMENT
REVOKE
REVOKE
GRANT
GRANT
CREATE INDEX
>> prerequis 02/12 : 20260916220100_fdj_caisse_cycle_de_vie_colonnes.sql
ALTER TABLE
DO
COMMENT
COMMENT
COMMENT
COMMENT
ALTER TABLE
DO
COMMENT
COMMENT
ALTER TABLE
ALTER TABLE
DO
CREATE INDEX
CREATE INDEX
>> prerequis 03/12 : 20260916220200_fdj_caisse_journal_evenements.sql
CREATE TABLE
COMMENT
COMMENT
COMMENT
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE FUNCTION
psql:supabase/migrations/20260916220200_fdj_caisse_journal_evenements.sql:152: NOTICE:  trigger "fdj_caisse_evenements_pas_de_modification" for relation "public.fdj_caisse_evenements" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
ALTER TABLE
REVOKE
REVOKE
GRANT
>> prerequis 04/12 : 20260916220300_fdj_demandes_correction_apres_validation.sql
CREATE TABLE
COMMENT
COMMENT
COMMENT
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
REVOKE
REVOKE
GRANT
>> prerequis 05/12 : 20260916220400_fdj_mouvements_auteur_et_date_effet.sql
ALTER TABLE
DO
COMMENT
COMMENT
COMMENT
DO
CREATE INDEX
CREATE INDEX
psql:supabase/migrations/20260916220400_fdj_mouvements_auteur_et_date_effet.sql:117: NOTICE:  fdj_stock_movements : un index unique couvre déjà idempotency_key, rien à créer.
DO
>> prerequis 06/12 : 20260916220500_fdj_commande_ouverture_quart.sql
CREATE FUNCTION
COMMENT
REVOKE
REVOKE
GRANT
GRANT
CREATE FUNCTION
COMMENT
REVOKE
REVOKE
GRANT
GRANT
>> prerequis 07/12 : 20260916220600_fdj_commandes_caisse_employe.sql
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
DO
DO
>> prerequis 08/12 : 20260916220700_fdj_commandes_caisse_manager.sql
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
DO
>> prerequis 09/12 : 20260916220800_fdj_projection_employe.sql
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
DO
>> prerequis 10/12 : 20260916220900_fdj_projection_progression.sql
CREATE FUNCTION
COMMENT
REVOKE
REVOKE
GRANT
GRANT
>> prerequis 11/12 : 20260916221000_fdj_commandes_activations_et_mouvements.sql
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
DO
DO
>> prerequis 12/12 : 20260916221100_fdj_commande_saisie_caisse_manager.sql
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
CREATE FUNCTION
COMMENT
CREATE FUNCTION
COMMENT
DO
CREATE FUNCTION
REVOKE
REVOKE
GRANT
GRANT
COMMENT
psql:<travail>/corps.sql:241: NOTICE:  function public.fdj_est_mon_quart(uuid) does not exist, skipping
DROP FUNCTION
DROP POLICY
CREATE POLICY
DROP POLICY
DROP POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
DROP POLICY
CREATE POLICY
DROP POLICY
CREATE POLICY
CREATE FUNCTION
psql:<travail>/corps.sql:429: NOTICE:  trigger "fdj_audit_log_garde_acteur" for relation "public.fdj_audit_log" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
COMMENT
CREATE FUNCTION
psql:<travail>/corps.sql:543: NOTICE:  trigger "fdj_shifts_garde_colonnes" for relation "public.fdj_shifts" does not exist, skipping
DROP TRIGGER
CREATE TRIGGER
COMMENT
DROP POLICY
DROP POLICY
CREATE POLICY
psql:<travail>/corps.sql:780: NOTICE:  Phase C — les huit contrôles passent.
DO
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
INSERT 0 1
UPDATE 1
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:144: NOTICE:  M1 PASSE — refus RLS : new row violates row-level security policy for table "fdj_cash_controls"
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:168: NOTICE:  M2 PASSE — 0 ligne modifiée (la caisse est invisible en écriture à l'employé).
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:180: NOTICE:  M2 bis PASSE — la caisse est intacte : 455 / provisoire.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:200: NOTICE:  M3 PASSE — un employé ne peut pas valider la caisse d'un collègue.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:233: NOTICE:  M4 PASSE — lecture directe fermée : 0 pour sa caisse, 0 pour celle du collègue.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:265: NOTICE:  M4 bis PASSE — 1 quart rendu, écarts -2.50 puis -1.00, aucun champ manager.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:291: NOTICE:  M5 PASSE — refus du trigger : Quart FDJ : changer de titulaire est un transfert de responsabilité, pas une modification de champ.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:313: NOTICE:  M6 PASSE — refus (42501) : Quart FDJ : cette modification passe par une commande NEXUS (ouverture, transfert, validation), pas par une écriture directe.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:337: NOTICE:  M7 PASSE — validation d'ouverture et chaînage de quart toujours possibles.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:359: NOTICE:  M8 PASSE — refus (42501) : Journal FDJ : une action ne peut être imputée qu'à soi-même (acteur_id attendu : 868d0b92-bf65-4c99-be43-656911919afd).
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:377: NOTICE:  M8 bis PASSE — journalisation en son nom et journalisation automatique intactes.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:443: NOTICE:  M9 PASSE — le manager contrôle, valide, saisit une feuille et dépose un rapport.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:464: NOTICE:  M10 PASSE — refus (42501) : new row violates row-level security policy for table "fdj_corrections"
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:495: NOTICE:  M11 PASSE — refus RLS : new row violates row-level security policy for table "fdj_stock_movements"
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:558: NOTICE:  M11 bis PASSE — employee_id vient du quart, created_by de auth.uid(), y compris en saisie manager.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:648: NOTICE:  M12 PASSE — refus du trigger : Quart FDJ : changer de titulaire est un transfert de responsabilité, pas une modification de champ.
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:648: NOTICE:  M12 PASSE — transfert sans motif refusé : Un transfert de responsabilité exige un motif explicite
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:648: NOTICE:  M12 PASSE — écriture directe refusée, transfert motivé accepté et journalisé.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:679: NOTICE:  M13 PASSE — update direct du manager sans effet : 0 ligne, aucune erreur.
DO
psql:supabase/phase-c/20260916230000_mutations_de_validation.sql:681: NOTICE:  ===== LES TREIZE MUTATIONS ONT LE COMPORTEMENT ATTENDU =====
DO
ROLLBACK
```

## 8. Verdict

| | |
|---|---|
| Code de retour de psql | `0` |
| Dernière instruction rendue | `ROLLBACK` |

## 9. Portée — trois choses distinctes

1. **L'exécution** est établie par les §1 à §7 : une commande datée, une
   cible nommée, les empreintes des fichiers joués, le pilote intégral,
   la sortie complète du serveur et un code de retour.
2. **Le `ROLLBACK`** est établi par le §8 : la dernière instruction rendue
   par le serveur. Le script refuse de conclure si ce n'en est pas une.
3. **L'absence d'effet durable** n'est **pas** établie par ce fichier, et
   ne peut pas l'être : il est écrit par le processus qui vient de
   tourner, pas par la base. Elle se vérifie hors d'ici, en interrogeant
   la base APRÈS coup — migrations de la Phase A, tables, fonctions,
   politiques, triggers — et en comparant à un relevé pris AVANT.
   **Ce fichier ne dit rien du résultat de cette comparaison** : écrire
   ici « rien n'a persisté » serait une phrase que ce script imprimerait
   à l'identique dans le cas contraire. Le raisonnement inverse,
   conclure de l'absence de trace que la recette a tourné, affirmerait le
   conséquent : une recette jamais lancée laisserait exactement le même
   état.
