-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260807152929 · securiser_rls_comptes_clients_et_boite_reception
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Correctif de sécurité urgent (07/08/2026) : les tables créées ce matin par
-- la migration creer_module_comptes_clients (clients, invoices, etc.) ont été
-- créées SANS activer la Row Level Security. Avec les droits par défaut de
-- Postgres/Supabase sur le schéma public, cela rendait les 24 fiches clients
-- réelles (coordonnées, préférences, factures) intégralement lisibles et
-- modifiables par n'importe qui disposant de la clé publique — laquelle est
-- présente en clair dans nexus-auth.js sur chaque page NEXUS. Cette migration
-- active la RLS et réplique la règle déjà appliquée côté interface
-- (NEXUS-Comptes-Clients-v1.html ligne ~202) : accès réservé à
-- manager/gérant du site concerné, plus consultation multi-site pour le
-- créateur (même principe que la table rappels).

create or replace function public.nexus_clients_lecture_ok(p_site text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (
    public.current_employee_role() = any(array['manager','gerant'])
    and p_site = public.current_employee_site_id()
  ) or (
    public.je_suis_createur()
    and exists (select 1 from public.sites s where s.site_id = p_site and s.acces_createur_autorise = true)
  )
$$;

create or replace function public.nexus_clients_ecriture_ok(p_site text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_employee_role() = any(array['manager','gerant'])
    and p_site = public.current_employee_site_id()
$$;

comment on function public.nexus_clients_lecture_ok(text) is 'Lecture des données Comptes Clients / boîte de réception : manager ou gérant du site, ou créateur en consultation multi-site autorisée.';
comment on function public.nexus_clients_ecriture_ok(text) is 'Écriture (insert/update/delete) des données Comptes Clients / boîte de réception : manager ou gérant du site concerné uniquement — jamais le créateur en consultation externe, jamais un employé simple, conformément au garde-fou déjà présent dans NEXUS-Comptes-Clients-v1.html.';

-- Tables avec colonne site directe --------------------------------------
alter table public.clients enable row level security;
create policy select_clients on public.clients for select using (public.nexus_clients_lecture_ok(site));
create policy ecriture_clients on public.clients for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

alter table public.billing_periods enable row level security;
create policy select_billing_periods on public.billing_periods for select using (public.nexus_clients_lecture_ok(site));
create policy ecriture_billing_periods on public.billing_periods for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

alter table public.client_comptes_audit_logs enable row level security;
create policy select_client_comptes_audit_logs on public.client_comptes_audit_logs for select using (public.nexus_clients_lecture_ok(site));
create policy ecriture_client_comptes_audit_logs on public.client_comptes_audit_logs for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

alter table public.client_comptes_parametres enable row level security;
create policy select_client_comptes_parametres on public.client_comptes_parametres for select using (public.nexus_clients_lecture_ok(site));
create policy ecriture_client_comptes_parametres on public.client_comptes_parametres for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

alter table public.email_templates enable row level security;
create policy select_email_templates on public.email_templates for select using (public.nexus_clients_lecture_ok(site));
create policy ecriture_email_templates on public.email_templates for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

alter table public.normalisation_alias enable row level security;
create policy select_normalisation_alias on public.normalisation_alias for select using (public.nexus_clients_lecture_ok(site));
create policy ecriture_normalisation_alias on public.normalisation_alias for all
  using (public.nexus_clients_ecriture_ok(site)) with check (public.nexus_clients_ecriture_ok(site));

-- Tables rattachées à clients via client_id --------------------------------
alter table public.client_contacts enable row level security;
create policy select_client_contacts on public.client_contacts for select
  using (exists (select 1 from public.clients c where c.id = client_contacts.client_id and public.nexus_clients_lecture_ok(c.site)));
create policy ecriture_client_contacts on public.client_contacts for all
  using (exists (select 1 from public.clients c where c.id = client_contacts.client_id and public.nexus_clients_ecriture_ok(c.site)))
  with check (exists (select 1 from public.clients c where c.id = client_contacts.client_id and public.nexus_clients_ecriture_ok(c.site)));

alter table public.client_preferences enable row level security;
create policy select_client_preferences on public.client_preferences for select
  using (exists (select 1 from public.clients c where c.id = client_preferences.client_id and public.nexus_clients_lecture_ok(c.site)));
create policy ecriture_client_preferences on public.client_preferences for all
  using (exists (select 1 from public.clients c where c.id = client_preferences.client_id and public.nexus_clients_ecriture_ok(c.site)))
  with check (exists (select 1 from public.clients c where c.id = client_preferences.client_id and public.nexus_clients_ecriture_ok(c.site)));

alter table public.invoices enable row level security;
create policy select_invoices on public.invoices for select
  using (exists (select 1 from public.clients c where c.id = invoices.client_id and public.nexus_clients_lecture_ok(c.site)));
create policy ecriture_invoices on public.invoices for all
  using (exists (select 1 from public.clients c where c.id = invoices.client_id and public.nexus_clients_ecriture_ok(c.site)))
  with check (exists (select 1 from public.clients c where c.id = invoices.client_id and public.nexus_clients_ecriture_ok(c.site)));

alter table public.supporting_documents enable row level security;
create policy select_supporting_documents on public.supporting_documents for select
  using (exists (select 1 from public.clients c where c.id = supporting_documents.client_id and public.nexus_clients_lecture_ok(c.site)));
create policy ecriture_supporting_documents on public.supporting_documents for all
  using (exists (select 1 from public.clients c where c.id = supporting_documents.client_id and public.nexus_clients_ecriture_ok(c.site)))
  with check (exists (select 1 from public.clients c where c.id = supporting_documents.client_id and public.nexus_clients_ecriture_ok(c.site)));

alter table public.delivery_records enable row level security;
create policy select_delivery_records on public.delivery_records for select
  using (exists (select 1 from public.clients c where c.id = delivery_records.client_id and public.nexus_clients_lecture_ok(c.site)));
create policy ecriture_delivery_records on public.delivery_records for all
  using (exists (select 1 from public.clients c where c.id = delivery_records.client_id and public.nexus_clients_ecriture_ok(c.site)))
  with check (exists (select 1 from public.clients c where c.id = delivery_records.client_id and public.nexus_clients_ecriture_ok(c.site)));

alter table public.email_messages enable row level security;
create policy select_email_messages on public.email_messages for select
  using (exists (select 1 from public.clients c where c.id = email_messages.client_id and public.nexus_clients_lecture_ok(c.site)));
create policy ecriture_email_messages on public.email_messages for all
  using (exists (select 1 from public.clients c where c.id = email_messages.client_id and public.nexus_clients_ecriture_ok(c.site)))
  with check (exists (select 1 from public.clients c where c.id = email_messages.client_id and public.nexus_clients_ecriture_ok(c.site)));

-- Tables à un niveau d'indirection supplémentaire --------------------------
alter table public.invoice_lines enable row level security;
create policy select_invoice_lines on public.invoice_lines for select
  using (exists (
    select 1 from public.invoices i join public.clients c on c.id = i.client_id
    where i.id = invoice_lines.invoice_id and public.nexus_clients_lecture_ok(c.site)
  ));
create policy ecriture_invoice_lines on public.invoice_lines for all
  using (exists (
    select 1 from public.invoices i join public.clients c on c.id = i.client_id
    where i.id = invoice_lines.invoice_id and public.nexus_clients_ecriture_ok(c.site)
  ))
  with check (exists (
    select 1 from public.invoices i join public.clients c on c.id = i.client_id
    where i.id = invoice_lines.invoice_id and public.nexus_clients_ecriture_ok(c.site)
  ));

alter table public.voucher_extractions enable row level security;
create policy select_voucher_extractions on public.voucher_extractions for select
  using (exists (
    select 1 from public.supporting_documents sd join public.clients c on c.id = sd.client_id
    where sd.id = voucher_extractions.supporting_document_id and public.nexus_clients_lecture_ok(c.site)
  ));
create policy ecriture_voucher_extractions on public.voucher_extractions for all
  using (exists (
    select 1 from public.supporting_documents sd join public.clients c on c.id = sd.client_id
    where sd.id = voucher_extractions.supporting_document_id and public.nexus_clients_ecriture_ok(c.site)
  ))
  with check (exists (
    select 1 from public.supporting_documents sd join public.clients c on c.id = sd.client_id
    where sd.id = voucher_extractions.supporting_document_id and public.nexus_clients_ecriture_ok(c.site)
  ));

alter table public.document_matches enable row level security;
create policy select_document_matches on public.document_matches for select
  using (exists (
    select 1 from public.voucher_extractions ve
    join public.supporting_documents sd on sd.id = ve.supporting_document_id
    join public.clients c on c.id = sd.client_id
    where ve.id = document_matches.voucher_extraction_id and public.nexus_clients_lecture_ok(c.site)
  ));
create policy ecriture_document_matches on public.document_matches for all
  using (exists (
    select 1 from public.voucher_extractions ve
    join public.supporting_documents sd on sd.id = ve.supporting_document_id
    join public.clients c on c.id = sd.client_id
    where ve.id = document_matches.voucher_extraction_id and public.nexus_clients_ecriture_ok(c.site)
  ))
  with check (exists (
    select 1 from public.voucher_extractions ve
    join public.supporting_documents sd on sd.id = ve.supporting_document_id
    join public.clients c on c.id = sd.client_id
    where ve.id = document_matches.voucher_extraction_id and public.nexus_clients_ecriture_ok(c.site)
  ));

alter table public.email_batches enable row level security;
create policy select_email_batches on public.email_batches for select
  using (exists (
    select 1 from public.billing_periods bp where bp.id = email_batches.billing_period_id and public.nexus_clients_lecture_ok(bp.site)
  ));
create policy ecriture_email_batches on public.email_batches for all
  using (exists (
    select 1 from public.billing_periods bp where bp.id = email_batches.billing_period_id and public.nexus_clients_ecriture_ok(bp.site)
  ))
  with check (exists (
    select 1 from public.billing_periods bp where bp.id = email_batches.billing_period_id and public.nexus_clients_ecriture_ok(bp.site)
  ));
