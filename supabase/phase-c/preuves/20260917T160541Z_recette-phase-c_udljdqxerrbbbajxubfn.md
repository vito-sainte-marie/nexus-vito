# Preuve d'exécution — recette de la Phase C sur nexus-test

Fichier **engendré** par `supabase/phase-c/recette-test.sh`. Ne pas le
modifier à la main : il ne vaut que parce que personne ne l'a écrit.

## 1. Quand, quoi, où

| | |
|---|---|
| Date UTC | `2026-09-17T16:05:41Z` |
| Commit testé | `c94fe4544ecbb03c1cc69a932c0021f70a2df986` |
| Branche | `fdj-vague1-cycle-caisse-20260916` |
| État du dépôt au lancement | **propre** (mesuré avant l'écriture de cette preuve) |
| Cible | nexus-test — projet `udljdqxerrbbbajxubfn` — `db.udljdqxerrbbbajxubfn.supabase.co:5432` |
| Production | `uzhjpqpctpvxytxpxoqz` — jamais visée, refus câblé dans le script |
| Mutations de validation | jouées |

## 2. Empreintes des fichiers joués

| fichier | SHA-256 du contenu | blob git à HEAD |
|---|---|---|
| `supabase/phase-c/20260916230000_fdj_rls_definitives_phase_c.sql` | `4deefefd4e2a2467e60d71060303537ffd7ca8bc48862147192d553380984764` | `1cdde4aa62c269e9737bbef7737da81c45f58ab3` |
| `supabase/phase-c/20260916230000_mutations_de_validation.sql` | `c1effd8ef8b3927f3e34e6c44b61e90783eb7704769b53ae1d31b0f5625af5b6` | `f0a5564c1fbea43d4aaf914dc3ff06a5a31b6d74` |
| `supabase/phase-c/recette-test.sh` | `c4f35bf297de4080d1144b98ac0aeb8e09d26b4b5d64dd85b16085e3ed86d69a` | `d8aafa184cdad6f52c7d34fb4eafb76380372362` |

Le dépôt était propre : le contenu empreint et le blob du commit sont le même octet.

## 3. Commande exécutée (expurgée)

```
/opt/homebrew/opt/libpq/bin/psql 'postgresql://postgres:***@db.udljdqxerrbbbajxubfn.supabase.co:5432/postgres?sslmode=require' -v ON_ERROR_STOP=1 -f pilote.sql
```

Le mot de passe ne figure jamais sur la ligne de commande : il est lu au
trousseau et passé à psql par l'environnement (`PGPASSWORD`).

## 4. Diff appliqué au corps — 4 lignes

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

## 5. Sortie complète de psql (expurgée)

```
BEGIN
>> Phase A absente de cette base : chargée dans la transaction.
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
CREATE FUNCTION
COMMENT
REVOKE
REVOKE
GRANT
GRANT
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

## 6. Verdict

| | |
|---|---|
| Code de retour de psql | `0` |
| Dernière instruction rendue | `ROLLBACK` |

## 7. Portée — trois choses distinctes

1. **L'exécution** est établie par les §1 à §5 : une commande datée, une
   cible nommée, les empreintes des fichiers joués, la sortie complète du
   serveur et un code de retour.
2. **Le `ROLLBACK`** est établi par le §6 : la dernière instruction rendue
   par le serveur. Le script refuse de conclure si ce n'en est pas une.
3. **L'absence d'effet durable** n'est **pas** établie par ce fichier. Elle
   se vérifie en interrogeant la base APRÈS coup — aucune migration de la
   Phase A persistante, aucune RPC installée. Le raisonnement inverse,
   conclure de l'absence de trace que la recette a tourné, affirmerait le
   conséquent : une recette jamais lancée laisserait exactement le même
   état.
