-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807153010 · securiser_rls_inventaire_corrections_regles_lots
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Même correctif de sécurité (07/08/2026), pour 3 tables d'inventaire
-- repérées par le même audit, sans rapport avec Comptes Clients mais tout
-- aussi exposées (RLS jamais activée). Droits calqués sur l'usage réel du
-- code : inventaire_regles_produit et inventaire_lots sont lues et/ou
-- écrites par tous les employés du site (Contrôle inventaire, Traçabilité),
-- inventaire_corrections est réservée à manager/gérant (correction
-- rétroactive, tâche #10).
alter table public.inventaire_regles_produit enable row level security;
create policy select_inventaire_regles_produit on public.inventaire_regles_produit for select
  using (public.nexus_clients_lecture_ok(site) or site = (select public.current_employee_site_id()));
create policy ecriture_inventaire_regles_produit on public.inventaire_regles_produit for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

alter table public.inventaire_lots enable row level security;
create policy select_inventaire_lots on public.inventaire_lots for select
  using (site = (select public.current_employee_site_id()) or public.nexus_clients_lecture_ok(site));
create policy ecriture_inventaire_lots on public.inventaire_lots for all
  using (site = (select public.current_employee_site_id()))
  with check (site = (select public.current_employee_site_id()));

alter table public.inventaire_corrections enable row level security;
create policy select_inventaire_corrections on public.inventaire_corrections for select
  using (public.nexus_clients_lecture_ok(site));
create policy ecriture_inventaire_corrections on public.inventaire_corrections for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));
