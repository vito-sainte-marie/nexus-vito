-- Refonte Paye (#383) : une absence se déclare justifiée ou injustifiée.
-- Colonne nullable : les absences déjà saisies restent « justification non renseignée ».
-- Non appliquée. Retour arrière : alter table public.employee_indisponibilites drop column justifiee;
-- RLS : aucune nouvelle politique, la colonne hérite de celles de la table.
alter table public.employee_indisponibilites add column if not exists justifiee boolean;
comment on column public.employee_indisponibilites.justifiee is 'Absence justifiée (true), injustifiée (false), null = non renseignée. Saisie par le manager.';
