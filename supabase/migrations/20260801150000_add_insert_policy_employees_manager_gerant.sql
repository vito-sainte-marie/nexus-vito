-- La table employees n'avait qu'une policy SELECT — aucune policy INSERT
-- n'existait, donc RLS bloquait silencieusement toute création de ligne
-- (confirmé le 01/08/2026 : la création auto de vacataire depuis l'import
-- Google Sheets échouait pour un nom absent de la liste, ex. "Alex", alors
-- que le même import fonctionnait pour un nom déjà connu comme "samantha"
-- puisque ce cas ne nécessite aucun INSERT). Scope identique à la policy
-- SELECT existante : un manager/gérant ne peut insérer que sur son propre
-- site_id.
create policy "insert_employees_manager_gerant"
on public.employees
for insert
to public
with check (
  current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text])
  and site_id = current_employee_site_id()
);
