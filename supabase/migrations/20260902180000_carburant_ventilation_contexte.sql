-- Journal du contexte de ventilation d'une fenêtre de contrôle carburant.
-- Doctrine posée par Frédéric le 02/09/2026 : « mémoriser le contexte
-- estimation, sans enregistrer cette estimation comme une vérité métier
-- dans carburant_controles ».
create table if not exists public.carburant_ventilation_contexte (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  date date not null,
  calcul_id uuid not null,
  fenetre_debut timestamptz,
  fenetre_fin timestamptz,
  quart_date date not null,
  quart text not null check (quart in ('1','2')),
  nature text not null check (nature in ('reel','estime_chevauchement','estime_absent')),
  fraction numeric not null check (fraction >= 0 and fraction <= 1),
  volume_go numeric,
  volume_sp95 numeric,
  volume_gnr numeric,
  methode text,
  estimable boolean not null default true,
  cree_le timestamptz not null default now()
);

create index if not exists idx_cvc_site_date on public.carburant_ventilation_contexte (site, date desc);
create index if not exists idx_cvc_calcul on public.carburant_ventilation_contexte (site, calcul_id);

alter table public.carburant_ventilation_contexte enable row level security;

create policy select_carburant_ventilation_contexte
  on public.carburant_ventilation_contexte for select
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (
      select 1 from sites s
      where s.site_id = carburant_ventilation_contexte.site
        and s.acces_createur_autorise = true))
  );

create policy ecriture_manager_meme_site
  on public.carburant_ventilation_contexte for insert
  with check (
    (select current_employee_role()) = any (array['manager','gerant'])
    and site = (select current_employee_site_id())
  );
-- Aucune policy UPDATE ni DELETE : append-only par construction.
