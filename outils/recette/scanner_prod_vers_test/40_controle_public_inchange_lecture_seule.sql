-- LECTURE SEULE : empreinte de public.products et public.stock_releves (site vito-sainte-marie) pour le contrôle avant/après import.
-- À jouer avec 73_empreintes_registres_t2_sm_lecture_seule.sql (dossier 07-T3-recette-test) avant et après : les sorties doivent être identiques.
begin transaction read only;
select 'products' as table_, count(*) n, md5(coalesce(string_agg(t.r, ';' order by t.r), '')) empreinte from (select p::text r from public.products p where p.site = 'vito-sainte-marie') t
union all
select 'stock_releves', count(*), md5(coalesce(string_agg(t.r, ';' order by t.r), '')) from (select s::text r from public.stock_releves s where s.site = 'vito-sainte-marie') t;
rollback;
