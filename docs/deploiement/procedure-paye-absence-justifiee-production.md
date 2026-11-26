# Paye : colonne `justifiee` sur `employee_indisponibilites` — procédure Production

Migration : `supabase/migrations/20261125200000_paye_absence_justifiee.sql` (md5 4cff13c661198d41e143bf61a4d7018b). Elle ajoute une colonne booléenne nullable, sans défaut, sur `public.employee_indisponibilites`. Aucune donnée touchée, aucune politique RLS ajoutée : la colonne hérite de celles de la table.

**État : NON appliquée, ni sur Test ni en Production.** Elle ne s'applique qu'avec un GO distinct du gérant, par Guardian.

## 1. Ordre

La migration passe avant le code. Le code de la PR #386 lit `justifiee` ; si la colonne manque, Postgres répond 42703 et l'écran affiche « justification non renseignée » au lieu de planter, mais la saisie manager est refusée avec un message clair tant que la colonne est absente.

## 2. Mesure à faire avant application (lecture seule, catalogue)

```sql
begin read only;
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'employee_indisponibilites' and column_name = 'justifiee';
rollback;
```

Attendu avant : 0 ligne. Attendu après : 1 ligne, `boolean`, `YES`.

## 3. Retour arrière

```sql
alter table public.employee_indisponibilites drop column justifiee;
```

Les justifications saisies depuis l'application seraient perdues ; les absences elles-mêmes restent intactes.
