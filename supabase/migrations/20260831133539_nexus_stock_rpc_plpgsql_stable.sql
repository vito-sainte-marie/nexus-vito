-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831133539 · nexus_stock_rpc_plpgsql_stable
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.nexus_stock_lire_etat(p_site text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  resultat jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x) order by x.designation), '[]'::jsonb)
    into resultat
  from public.nexus_stock_etat_v3 x
  where x.site = p_site;
  return resultat;
end;
$$;
grant execute on function public.nexus_stock_lire_etat(text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
