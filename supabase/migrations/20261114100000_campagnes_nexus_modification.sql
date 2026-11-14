-- Campagnes : un manager ou un gérant peut modifier une campagne de son site.
-- Jusqu'ici campagnes_nexus n'avait que l'INSERT (ecriture_manager_meme_site) et le SELECT ;
-- une modification était donc refusée par la RLS.
-- Deux colonnes de traçabilité, nulles tant que la campagne n'a pas été modifiée.
alter table public.campagnes_nexus
  add column if not exists modifie_par uuid references public.employees(id),
  add column if not exists modifie_le timestamptz;

drop policy if exists modification_manager_meme_site on public.campagnes_nexus;
create policy modification_manager_meme_site on public.campagnes_nexus
  for update
  using (
    ((select current_employee_role()) = any (array['manager'::text, 'gerant'::text]))
    and (site = (select current_employee_site_id()))
  )
  with check (
    ((select current_employee_role()) = any (array['manager'::text, 'gerant'::text]))
    and (site = (select current_employee_site_id()))
  );
-- Pas de politique DELETE : une campagne ne se supprime pas.
