-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831130914 · nexus_stock_rpc_lecture_stable
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.nexus_stock_lire_etat(p_site text)
returns setof public.nexus_stock_etat_v3
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select *
  from public.nexus_stock_etat_v3
  where site = p_site
  order by designation;
$$;

grant execute on function public.nexus_stock_lire_etat(text) to authenticated;
comment on function public.nexus_stock_lire_etat(text) is 'Lecture stable du Stock Engine central. Evite les erreurs REST/RLS sur les vues imbriquees tout en conservant le filtrage par site.';
