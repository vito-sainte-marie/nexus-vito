-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830220711 · inventaire_stock_par_emplacement_categorie
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists public.inventaire_categories_zones_stock (
  id uuid primary key default gen_random_uuid(),
  site text not null,
  categorie_id uuid not null references public.inventaire_categories(id) on delete cascade,
  zone_id uuid not null references public.inventaire_zones(id) on delete cascade,
  ordre integer not null default 10,
  actif boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site,categorie_id,zone_id)
);

alter table public.inventaire_categories_zones_stock enable row level security;

drop policy if exists select_inventaire_categories_zones_stock on public.inventaire_categories_zones_stock;
create policy select_inventaire_categories_zones_stock on public.inventaire_categories_zones_stock
for select using (site = current_employee_site_id());

drop policy if exists ecriture_inventaire_categories_zones_stock on public.inventaire_categories_zones_stock;
create policy ecriture_inventaire_categories_zones_stock on public.inventaire_categories_zones_stock
for all using (current_employee_role() = any(array['manager'::text,'gerant'::text]) and site = current_employee_site_id())
with check (current_employee_role() = any(array['manager'::text,'gerant'::text]) and site = current_employee_site_id());

grant select,insert,update,delete on public.inventaire_categories_zones_stock to authenticated;

insert into public.inventaire_categories_zones_stock(site,categorie_id,zone_id,ordre,actif)
select c.site,c.id,z.id,case z.code when 'bureau' then 10 when 'boutique' then 20 else 30 end,true
from public.inventaire_categories c
join public.inventaire_zones z on z.site=c.site and z.code in ('bureau','boutique')
where c.site='vito-sainte-marie' and lower(c.nom)='cigarettes' and c.actif=true
on conflict(site,categorie_id,zone_id) do update set actif=true, ordre=excluded.ordre, updated_at=now();

update public.inventaire_zone_produit p
set comptage_deux_lieux=true
from public.inventaire_categories c
where p.categorie_id=c.id and p.site=c.site and c.site='vito-sainte-marie' and lower(c.nom)='cigarettes' and c.actif=true and p.actif=true;
