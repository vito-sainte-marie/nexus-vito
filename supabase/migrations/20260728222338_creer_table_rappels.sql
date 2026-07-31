create table if not exists public.rappels (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  texte text not null,
  date_echeance date,
  cree_par uuid references public.employees(id),
  fait boolean not null default false,
  fait_le timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.rappels is 'Rappels manuels (28/07/2026, demande de Frédéric) : texte libre + date d''échéance optionnelle, cochés une fois faits. Affichés dans le Cockpit, séparés de la liste scorée des priorités — pas de règle de calcul, juste ce que le manager déclare lui-même (ex : passation de commande, avant qu''un vrai suivi piloté par le stock n''existe).';

alter table public.rappels enable row level security;

create policy select_rappels on public.rappels for select
  using (
    site = (select public.current_employee_site_id())
    or (
      (select public.je_suis_createur())
      and exists (select 1 from public.sites s where s.site_id = rappels.site and s.acces_createur_autorise = true)
    )
  );

create policy ecriture_manager_meme_site_rappels on public.rappels for insert
  with check (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  );

create policy modification_manager_meme_site_rappels on public.rappels for update
  using (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  )
  with check (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  );

create policy suppression_manager_meme_site_rappels on public.rappels for delete
  using (
    (select public.current_employee_role()) = any (array['manager','gerant'])
    and site = (select public.current_employee_site_id())
  );
