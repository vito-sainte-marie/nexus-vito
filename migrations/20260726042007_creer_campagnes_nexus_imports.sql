create table campagnes_nexus_imports (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  campagne_id uuid not null references campagnes_nexus(id),
  phase text not null,
  periode_debut date not null,
  periode_fin date not null,
  importe_par uuid references employees(id),
  importe_le timestamptz not null default now(),
  unique (campagne_id, phase)
);

alter table campagnes_nexus_imports enable row level security;

create policy lecture_meme_site on campagnes_nexus_imports
  for select
  using (site = current_employee_site_id());

create policy ecriture_manager_meme_site on campagnes_nexus_imports
  for insert
  with check (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'));

create policy suppression_manager_meme_site on campagnes_nexus_imports
  for delete
  using (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'));

create policy createur_lit_si_autorise on campagnes_nexus_imports
  for select
  using (je_suis_createur());
