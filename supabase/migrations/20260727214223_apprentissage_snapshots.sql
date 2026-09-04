-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260727214223 · apprentissage_snapshots
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- "Ce que NEXUS a appris sur moi" (27/07/2026, demande de Frédéric) : mémoire
-- du dernier état vu par l'employé, pour détecter une VRAIE nouveauté
-- (nouvelle qualité, nouvelle habitude, niveau franchi, badge obtenu) et
-- déclencher une petite notification "Nouveau constat" — jamais une
-- comparaison entre collègues (décision explicite de Frédéric, 27/07/2026),
-- uniquement la personne comparée à elle-même dans le temps.
create table if not exists apprentissage_snapshots (
  employee_id uuid primary key references employees(id) on delete cascade,
  site_id text not null,
  qualites jsonb not null default '[]'::jsonb,
  habitudes jsonb not null default '[]'::jsonb,
  niveau_id text,
  badges_obtenus jsonb not null default '[]'::jsonb,
  nouveaute_en_attente boolean not null default false,
  nouveaute_detail text,
  updated_at timestamptz not null default now()
);
alter table apprentissage_snapshots enable row level security;
create policy "employee_own_snapshot_select" on apprentissage_snapshots
  for select using (employee_id = auth.uid());
create policy "employee_own_snapshot_upsert" on apprentissage_snapshots
  for insert with check (employee_id = auth.uid());
create policy "employee_own_snapshot_update" on apprentissage_snapshots
  for update using (employee_id = auth.uid());
create policy "manager_sees_all_snapshots" on apprentissage_snapshots
  for select using (
    current_employee_role() = ANY (ARRAY['manager'::text, 'gerant'::text])
    and site_id = current_employee_site_id()
  );
create policy "createur_lit_si_autorise" on apprentissage_snapshots
  for select using (
    je_suis_createur() and exists (
      select 1 from sites s
      where s.site_id = apprentissage_snapshots.site_id
      and s.acces_createur_autorise = true
    )
  );
