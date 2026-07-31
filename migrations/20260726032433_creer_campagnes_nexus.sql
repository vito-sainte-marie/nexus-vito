create table campagnes_nexus (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  nom text not null,
  date_debut date not null,
  date_fin date not null,
  type text not null,
  produits_concernes text[],
  nature text,
  objectif text,
  objectif_libre text,
  cree_par uuid references employees(id),
  cree_le timestamptz not null default now()
);

alter table campagnes_nexus enable row level security;

create policy lecture_meme_site on campagnes_nexus
  for select
  using (site = current_employee_site_id());

create policy ecriture_manager_meme_site on campagnes_nexus
  for all
  using (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'))
  with check (site = current_employee_site_id() and current_employee_role() in ('manager','gerant'));

create policy createur_lit_si_autorise on campagnes_nexus
  for select
  using (je_suis_createur());
