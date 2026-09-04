-- Isolation de la progression des missions par PRISE DE POSTE (04/09/2026)
--
-- Test réel de Frédéric avec le compte de Nadine, caissière du quart du
-- soir : dès sa connexion, la mission « Balayer et nettoyer la piste »
-- s'affichait avec sa checklist entièrement cochée.
--
-- Cause : mission_progress était unique sur
--   (employee_id, mission_id, checklist_index)
-- — ni date, ni site, ni quart, ni rôle, ni prise de poste. Une coche
-- posée un jour restait donc vraie pour toujours, sur tous les services
-- suivants. Constat en base avant correction : 525 lignes, 488 cochées,
-- dont 487 antérieures au jour du test, remontant au 19/07/2026, sur 10
-- employés. Rien n'avait jamais été remis à zéro depuis un mois et demi.
--
-- Correction : la table `shifts` porte déjà, pour chaque prise de poste,
-- son id, son employé, son site, son quart, son rôle et son heure de
-- début. Une seule colonne `shift_id` isole donc les six dimensions
-- demandées d'un coup — plutôt que six colonnes à maintenir cohérentes
-- entre elles, dont la moindre divergence rouvrirait la fuite.
--
-- `shift_id` est NOT NULL : après cette migration, il devient
-- structurellement impossible d'enregistrer une coche qui ne soit pas
-- rattachée à une prise de poste précise. C'est la garantie, pas la
-- discipline d'appel, qui empêche la régression.
--
-- Les lignes historiques sont ARCHIVÉES avant suppression (décision de
-- Frédéric, 04/09/2026) : rien n'est perdu, le manager peut toujours les
-- relire. La suppression n'a lieu que si le nombre de lignes archivées
-- est exactement égal au nombre de lignes à supprimer — sinon la
-- transaction entière est annulée.

-- 1. Rattachement à la prise de poste.
alter table public.mission_progress
  add column if not exists shift_id uuid references public.shifts(id) on delete cascade;

-- 2. Archive des lignes historiques. Même structure que la source, plus
--    la date d'archivage — on n'invente aucune colonne, ce qui garde
--    l'historique relisible avec les mêmes requêtes qu'avant.
create table if not exists public.mission_progress_archive_2026_09 (
  like public.mission_progress including defaults
);

alter table public.mission_progress_archive_2026_09
  add column if not exists archive_le timestamptz not null default now();

comment on table public.mission_progress_archive_2026_09 is
  'Coches de missions antérieures à l''isolation par prise de poste (04/09/2026). Conservées en lecture pour le manager : elles n''étaient rattachées à aucun service identifiable, et ne peuvent donc plus être réinjectées dans mission_progress.';

-- 3. Archivage, puis suppression sous condition d'égalité stricte.
--    Tout écart annule la transaction : on ne supprime jamais plus que
--    ce qui a été effectivement recopié.
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

-- 4. Nouvelle clé d'unicité. L'ancienne portait sur l'employé — c'est
--    elle qui faisait qu'une coche valait pour tous ses services à venir.
alter table public.mission_progress
  drop constraint if exists mission_progress_employee_id_mission_id_checklist_index_key;

alter table public.mission_progress
  alter column shift_id set not null;

alter table public.mission_progress
  add constraint mission_progress_shift_mission_index_key
  unique (shift_id, mission_id, checklist_index);

create index if not exists idx_mission_progress_shift_id
  on public.mission_progress using btree (shift_id);

-- 5. L'archive suit exactement les mêmes règles de lecture que la table
--    d'origine : son propre historique pour l'employé, celui du site pour
--    le manager et le gérant. Aucune écriture n'est ouverte — une archive
--    ne se modifie pas.
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
