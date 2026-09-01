-- NEXUS Inventaire — sécurisation RLS des règles de réassort interne
-- 01/09/2026
--
-- Cette table faisait partie du domaine Inventaire mais restait la seule
-- table inventaire_* avec RLS désactivée, alors que les rôles anon et
-- authenticated disposent des privilèges standards Supabase. On l'aligne
-- sur les autres tables de règles Inventaire : lecture limitée au site
-- autorisé et écriture soumise au garde-fou multi-site NEXUS.

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
