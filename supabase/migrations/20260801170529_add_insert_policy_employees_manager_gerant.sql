-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260801170529 · add_insert_policy_employees_manager_gerant
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- La table employees n'avait qu'une policy SELECT — aucune policy INSERT
-- n'existait, donc RLS bloquait silencieusement toute création de ligne
-- (confirme le 01/08/2026 : creation auto de vacataire depuis l'import
-- Google Sheets echouait pour un nom absent de la liste, ex. "Alex", alors
-- que le meme import fonctionnait pour un nom deja connu comme "samantha"
-- puisque ce cas ne necessite aucun INSERT). Scope identique a la policy
-- SELECT existante : un manager/gerant ne peut inserer que sur son propre
-- site_id.
create policy "insert_employees_manager_gerant"
on public.employees
for insert
to public
with check (
  current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text])
  and site_id = current_employee_site_id()
);
