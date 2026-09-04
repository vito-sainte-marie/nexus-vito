-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260829114753 · audits_caisse_versions_snapshot_restauration
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists audits_caisse_versions (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  audit_id uuid not null references audits_caisse(id),
  version_precedente_id uuid references audits_caisse_versions(id),
  action text not null check (action in ('modification','validation_piste','validation_boutique','restauration')),
  valeurs jsonb not null,
  acteur_id uuid references employees(id),
  motif text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audits_caisse_versions_audit_id on audits_caisse_versions(audit_id, created_at desc);

alter table audits_caisse_versions enable row level security;

create policy insert_audits_caisse_versions on audits_caisse_versions
  for insert with check (site = (select current_employee_site_id()));

create policy select_audits_caisse_versions on audits_caisse_versions
  for select using (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );
