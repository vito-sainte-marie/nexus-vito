-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807164857 · rls_invoices_supporting_documents_sans_client_assigne
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Correctif RLS (07/08/2026) : un document tout juste déposé dans la
-- Boîte de réception n'a pas forcément de client_id (facture non
-- reconnue, bon en attente d'OCR) — les politiques posées ce matin, qui ne
-- passaient que par clients.site, rendaient ces lignes invisibles à tout
-- le monde tant qu'aucun client n'était rattaché. On ajoute un second
-- chemin via billing_periods.site (toujours renseigné dès le dépôt), pour
-- qu'un document "à confirmer" reste visible et modifiable par le manager
-- qui doit justement lui assigner un client.
drop policy if exists select_invoices on public.invoices;
drop policy if exists ecriture_invoices on public.invoices;
create policy select_invoices on public.invoices for select
  using (
    exists (select 1 from public.clients c where c.id = invoices.client_id and public.nexus_clients_lecture_ok(c.site))
    or exists (select 1 from public.billing_periods bp where bp.id = invoices.billing_period_id and public.nexus_clients_lecture_ok(bp.site))
  );
create policy ecriture_invoices on public.invoices for all
  using (
    exists (select 1 from public.clients c where c.id = invoices.client_id and public.nexus_clients_ecriture_ok(c.site))
    or exists (select 1 from public.billing_periods bp where bp.id = invoices.billing_period_id and public.nexus_clients_ecriture_ok(bp.site))
  )
  with check (
    exists (select 1 from public.clients c where c.id = invoices.client_id and public.nexus_clients_ecriture_ok(c.site))
    or exists (select 1 from public.billing_periods bp where bp.id = invoices.billing_period_id and public.nexus_clients_ecriture_ok(bp.site))
  );

drop policy if exists select_supporting_documents on public.supporting_documents;
drop policy if exists ecriture_supporting_documents on public.supporting_documents;
create policy select_supporting_documents on public.supporting_documents for select
  using (
    exists (select 1 from public.clients c where c.id = supporting_documents.client_id and public.nexus_clients_lecture_ok(c.site))
    or exists (select 1 from public.billing_periods bp where bp.id = supporting_documents.billing_period_id and public.nexus_clients_lecture_ok(bp.site))
  );
create policy ecriture_supporting_documents on public.supporting_documents for all
  using (
    exists (select 1 from public.clients c where c.id = supporting_documents.client_id and public.nexus_clients_ecriture_ok(c.site))
    or exists (select 1 from public.billing_periods bp where bp.id = supporting_documents.billing_period_id and public.nexus_clients_ecriture_ok(bp.site))
  )
  with check (
    exists (select 1 from public.clients c where c.id = supporting_documents.client_id and public.nexus_clients_ecriture_ok(c.site))
    or exists (select 1 from public.billing_periods bp where bp.id = supporting_documents.billing_period_id and public.nexus_clients_ecriture_ok(bp.site))
  );
