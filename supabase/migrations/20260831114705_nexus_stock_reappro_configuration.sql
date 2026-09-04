-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831114705 · nexus_stock_reappro_configuration
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create table if not exists public.nexus_stock_reappro_config (
  site text primary key,
  actif boolean not null default true,
  seuil_critique_jours numeric not null default 2 check (seuil_critique_jours >= 0),
  seuil_court_jours numeric not null default 5 check (seuil_court_jours >= seuil_critique_jours),
  age_max_stock_heures numeric not null default 72 check (age_max_stock_heures > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

alter table public.nexus_stock_reappro_config enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='nexus_stock_reappro_config' and policyname='reappro_config_select_authenticated'
  ) then
    create policy reappro_config_select_authenticated on public.nexus_stock_reappro_config for select to authenticated using (true);
  end if;
end $$;

insert into public.nexus_stock_reappro_config(site)
select distinct site from public.station_config where site is not null
on conflict (site) do nothing;
