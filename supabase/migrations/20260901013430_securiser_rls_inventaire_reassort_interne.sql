-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260901013430 · securiser_rls_inventaire_reassort_interne
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_reassort_interne_regles enable row level security;

drop policy if exists select_inventaire_reassort_interne_regles on public.inventaire_reassort_interne_regles;
create policy select_inventaire_reassort_interne_regles
on public.inventaire_reassort_interne_regles
for select
to public
using (nexus_clients_lecture_ok(site) OR site = current_employee_site_id());

drop policy if exists ecriture_inventaire_reassort_interne_regles on public.inventaire_reassort_interne_regles;
create policy ecriture_inventaire_reassort_interne_regles
on public.inventaire_reassort_interne_regles
for all
to public
using (nexus_clients_ecriture_ok(site))
with check (nexus_clients_ecriture_ok(site));
