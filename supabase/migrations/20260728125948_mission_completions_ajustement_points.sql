-- Ajustement de points par un manager (28/07/2026, demande de Frédéric) :
-- un manager qui juge une tâche mal exécutée peut retirer des points sur
-- une mission déjà validée, avec une raison FACULTATIVE. On ne modifie
-- jamais mission_completions.points (la trace originale reste honnête),
-- on ajoute un ajustement séparé, appliqué en plus au moment de l'affichage
-- et des totaux (points_total = points + points_ajustement).
alter table mission_completions add column if not exists points_ajustement integer not null default 0;
alter table mission_completions add column if not exists ajustement_raison text;
alter table mission_completions add column if not exists ajuste_par uuid references employees(id);
alter table mission_completions add column if not exists ajuste_le timestamptz;

create policy "manager_ajuste_points" on mission_completions
  for update using (
    current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text])
    and site_id = current_employee_site_id()
  ) with check (
    current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text])
    and site_id = current_employee_site_id()
  );
