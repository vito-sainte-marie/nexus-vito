-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831134402 · optimiser_stock_releves_lecture_centrale
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create index if not exists idx_stock_releves_site_cle_releve on public.stock_releves (site, (coalesce(nullif(btrim(code_barres), ''), lower(btrim(article)))), releve_le desc, importe_le desc) where quantite_theorique is not null;
create index if not exists idx_stock_releves_site_barcode_releve on public.stock_releves (site, code_barres, releve_le desc, importe_le desc) where quantite_theorique is not null and code_barres is not null;
analyze public.stock_releves;
create or replace function public.nexus_stock_lire_etat(p_site text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
set work_mem = '64MB'
set statement_timeout = '25s'
as $$
declare v_result jsonb;
begin
  select coalesce(jsonb_agg(to_jsonb(x) order by x.designation), '[]'::jsonb)
  into v_result
  from public.nexus_stock_etat_v3 x
  where x.site = p_site;
  return v_result;
end;
$$;
grant execute on function public.nexus_stock_lire_etat(text) to anon, authenticated, service_role;
notify pgrst, 'reload schema';
