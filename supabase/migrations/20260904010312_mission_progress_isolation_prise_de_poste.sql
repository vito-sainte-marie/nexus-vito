-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260904010312 · mission_progress_isolation_prise_de_poste
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.mission_progress
  add column if not exists shift_id uuid references public.shifts(id) on delete cascade;

create table if not exists public.mission_progress_archive_2026_09 (
  like public.mission_progress including defaults
);

alter table public.mission_progress_archive_2026_09
  add column if not exists archive_le timestamptz not null default now();

comment on table public.mission_progress_archive_2026_09 is
  'Coches de missions antérieures à l''isolation par prise de poste (04/09/2026). Conservées en lecture pour le manager : elles n''étaient rattachées à aucun service identifiable, et ne peuvent donc plus être réinjectées dans mission_progress.';

do $$
declare
  a_archiver bigint;
  archivees  bigint;
  supprimees bigint;
begin
  select count(*) into a_archiver from public.mission_progress where shift_id is null;

  insert into public.mission_progress_archive_2026_09
    (id, employee_id, mission_id, checklist_index, checked, updated_at, site_id, photo_url, shift_id)
  select id, employee_id, mission_id, checklist_index, checked, updated_at, site_id, photo_url, shift_id
  from public.mission_progress
  where shift_id is null;
  get diagnostics archivees = row_count;

  if archivees <> a_archiver then
    raise exception 'Archivage incomplet : % ligne(s) recopiée(s) pour % à archiver. Aucune suppression effectuée.',
      archivees, a_archiver;
  end if;

  delete from public.mission_progress where shift_id is null;
  get diagnostics supprimees = row_count;

  if supprimees <> archivees then
    raise exception 'Écart archivage/suppression : % archivée(s), % supprimée(s). Transaction annulée.',
      archivees, supprimees;
  end if;

  raise notice 'mission_progress : % ligne(s) archivée(s) et supprimée(s).', supprimees;
end $$;

alter table public.mission_progress
  drop constraint if exists mission_progress_employee_id_mission_id_checklist_index_key;

alter table public.mission_progress
  alter column shift_id set not null;

alter table public.mission_progress
  add constraint mission_progress_shift_mission_index_key
  unique (shift_id, mission_id, checklist_index);

create index if not exists idx_mission_progress_shift_id
  on public.mission_progress using btree (shift_id);

alter table public.mission_progress_archive_2026_09 enable row level security;

drop policy if exists select_mission_progress_archive on public.mission_progress_archive_2026_09;
create policy select_mission_progress_archive
  on public.mission_progress_archive_2026_09 for select to public
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any (array['manager', 'gerant'])
        and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur())
        and exists (select 1 from public.sites s
                    where s.site_id = mission_progress_archive_2026_09.site_id
                      and s.acces_createur_autorise = true))
  );
