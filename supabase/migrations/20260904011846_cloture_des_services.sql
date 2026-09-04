-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260904011846 · cloture_des_services
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.shifts
  add column if not exists cloture_par uuid references public.employees(id),
  add column if not exists cloture_le timestamptz,
  add column if not exists cloture_source text,
  add column if not exists cloture_motif text;

alter table public.shifts drop constraint if exists shifts_cloture_source_check;
alter table public.shifts add constraint shifts_cloture_source_check
  check (cloture_source is null or cloture_source = any (array[
    'employe', 'pointage_depart', 'manager', 'prise_de_poste_suivante', 'systeme_legacy', 'test'
  ]));

alter table public.shifts drop constraint if exists shifts_statut_check;
alter table public.shifts add constraint shifts_statut_check
  check (statut = any (array['en_cours', 'termine', 'clos_sans_pointage', 'legacy', 'test']));

alter table public.shifts drop constraint if exists shifts_heure_fin_coherente;
alter table public.shifts add constraint shifts_heure_fin_coherente check (
  (statut = 'termine' and heure_fin is not null)
  or (statut = 'en_cours' and heure_fin is null)
  or (statut in ('clos_sans_pointage', 'legacy', 'test') and heure_fin is null)
);

alter table public.shifts drop constraint if exists shifts_journal_cloture;
alter table public.shifts add constraint shifts_journal_cloture check (
  statut = 'en_cours'
  or (cloture_source is not null and cloture_le is not null)
);

update public.shifts
set statut = 'test',
    cloture_source = 'test',
    cloture_le = now(),
    cloture_motif = 'Prise de poste de test du 04/09/2026 (contrôle de l''isolation des missions) — hors résultats de l''employé.'
where id = 'cef4fd7b-3430-4e5d-b6bb-07b26e9b83fd';

update public.shifts
set statut = 'legacy',
    cloture_source = 'systeme_legacy',
    cloture_le = now(),
    cloture_motif = 'Service antérieur à la clôture des services (04/09/2026) : jamais clôturé, heure de fin inconnue. Aucune heure de départ n''a été inventée.'
where statut = 'en_cours';

create index if not exists idx_shifts_employee_statut
  on public.shifts using btree (employee_id, statut, heure_debut desc);

comment on column public.shifts.statut is
  'en_cours = service ouvert · termine = clôturé, heure_fin connue · clos_sans_pointage = clôturé, fin réelle inconnue (jamais inventée) · legacy = service antérieur au mécanisme de clôture · test = prise de poste de test, hors résultats.';
comment on column public.shifts.cloture_source is
  'Par quel chemin le service a été clôturé. Jamais par la seule heure courante : l''horloge ne fait que signaler au manager un service resté ouvert.';
