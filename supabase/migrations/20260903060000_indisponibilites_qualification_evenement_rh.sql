-- Un événement RH est une période qualifiée une seule fois (03/09/2026).
alter table public.employee_indisponibilites
  add column if not exists motif text,
  add column if not exists confirme_le timestamptz,
  add column if not exists confirme_par uuid,
  add column if not exists fin_indeterminee boolean not null default false,
  add column if not exists date_reprise date;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'employee_indisponibilites_motif_check') then
    alter table public.employee_indisponibilites
      add constraint employee_indisponibilites_motif_check
      check (motif is null or motif in ('conge','conge_maternite','conge_paternite','arret_maladie','formation','autre'));
  end if;
end $$;
