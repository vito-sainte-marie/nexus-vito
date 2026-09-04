-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831134506 · stock_rpc_optimisee_sans_vue_lente
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace function public.nexus_stock_lire_etat(p_site text)
returns jsonb
language sql
stable
security definer
set search_path=public
set row_security=off
set statement_timeout='8s'
as $$
with produits as (
  select p.id produit_id,p.site,p.designation,p.code_barres,p.categorie_id,c.nom categorie,p.unite,p.actif
  from inventaire_zone_produit p left join inventaire_categories c on c.id=p.categorie_id
  where p.site=p_site
), zones_att as (
  select categorie_id,count(*)::int nb from inventaire_categories_zones_stock where site=p_site and actif=true group by categorie_id
), loc_zone as (
  select distinct on (r.produit_id,r.zone_id) r.produit_id,r.zone_id,r.quantite_base,r.releve_le,r.id
  from inventaire_stock_localise_releves r where r.site=p_site
  order by r.produit_id,r.zone_id,r.releve_le desc,r.created_at desc
), loc as (
  select l.produit_id,sum(l.quantite_base+coalesce(m.delta,0)) stock,max(l.releve_le) releve_le,count(*)::int nb
  from loc_zone l left join lateral (
    select sum(case when x.zone_destination_id=l.zone_id then x.quantite when x.zone_source_id=l.zone_id then -x.quantite else 0 end) delta
    from inventaire_mouvements x where x.site=p_site and x.produit_id=l.produit_id and x.type_mouvement='transfert' and coalesce(x.statut_validation,'valide')='valide' and x.cree_le>l.releve_le and (x.zone_source_id=l.zone_id or x.zone_destination_id=l.zone_id)
  ) m on true group by l.produit_id
), comptage as (
  select distinct on (c.produit_id) c.produit_id,c.quantite stock,c.compte_le releve_le,c.id
  from inventaire_comptages c where c.site=p_site and c.statut='valide' and c.source='manuel' and c.type_comptage in ('ouverture','intermediaire','cloture','recomptage_manager')
  order by c.produit_id,c.compte_le desc,c.created_at desc
), base as (
 select p.*,coalesce(z.nb,0) nb_att,coalesce(l.nb,0) nb_loc,l.stock loc_stock,l.releve_le loc_le,c.stock count_stock,c.releve_le count_le,c.id count_id,
   si.quantite_theorique imp_stock,si.releve_le imp_le,si.id imp_id,
   ss.quantite_stock snap_stock,ss.theorique_le snap_le,ss.snapshot_id,ss.confidence_level
 from produits p
 left join zones_att z on z.categorie_id=p.categorie_id
 left join loc l on l.produit_id=p.produit_id
 left join comptage c on c.produit_id=p.produit_id
 left join lateral (
   select s.quantite_theorique,s.releve_le,s.id from stock_releves s
   where s.site=p_site and s.quantite_theorique is not null and (
     (p.code_barres is not null and nullif(btrim(s.code_barres),'')=p.code_barres) or
     (p.code_barres is null and nullif(btrim(s.code_barres),'') is null and lower(btrim(s.article))=lower(btrim(p.designation)))
   ) order by s.releve_le desc,s.importe_le desc limit 1
 ) si on true
 left join lateral (
   select l.quantite_stock,coalesce(s.snapshot_reference_at,s.stock_export_at,l.importe_le) theorique_le,s.id snapshot_id,s.confidence_level
   from inventaire_decenium_snapshot_lignes l join inventaire_decenium_snapshots s on s.id=l.snapshot_id
   where l.site=p_site and l.produit_id=p.produit_id and l.quantite_stock is not null and coalesce(s.status,'') not in ('annule','supprime','failed','erreur')
   order by coalesce(s.snapshot_reference_at,s.stock_export_at,l.importe_le) desc,l.importe_le desc limit 1
 ) ss on true
), n as (
 select b.*,
   (nb_att>0 and nb_loc>=nb_att) loc_complet,
   case when nb_att>0 and nb_loc>=nb_att and (count_le is null or loc_le>=count_le) then loc_stock else count_stock end reel,
   case when nb_att>0 and nb_loc>=nb_att and (count_le is null or loc_le>=count_le) then loc_le else count_le end reel_le,
   case when nb_att>0 and nb_loc>=nb_att and (count_le is null or loc_le>=count_le) then 'inventaire_localise' when count_stock is not null then 'inventaire_physique' end reel_source,
   case when snap_stock is not null and (imp_le is null or snap_le>=imp_le) then snap_stock else imp_stock end theo,
   case when snap_stock is not null and (imp_le is null or snap_le>=imp_le) then snap_le else imp_le end theo_le,
   case when snap_stock is not null and (imp_le is null or snap_le>=imp_le) then 'decenium_snapshot' when imp_stock is not null then 'import_stock' end theo_source
 from base b
)
select coalesce(jsonb_agg(jsonb_build_object(
 'produit_id',produit_id,'site',site,'designation',designation,'code_barres',code_barres,'categorie_id',categorie_id,'categorie',categorie,'unite',unite,'actif',actif,
 'stock_reel',reel,'stock_reel_observe',reel,'stock_reel_le',reel_le,'stock_reel_observe_le',reel_le,'stock_reel_source',reel_source,
 'stock_theorique',theo,'stock_theorique_le',theo_le,'stock_theorique_source',theo_source,
 'ecart_reel_theorique',case when reel is not null and theo is not null then reel-theo end,
 'ecart_brut_non_aligne',case when reel is not null and theo is not null then reel-theo end,
 'delta_t_secondes',case when reel_le is not null and theo_le is not null then abs(extract(epoch from reel_le-theo_le))::bigint end,
 'comparaison_fiable',coalesce(reel is not null and theo is not null and reel_le is not null and theo_le is not null and abs(extract(epoch from reel_le-theo_le))<=900,false),
 'ecart_reference',case when reel is not null and theo is not null and reel_le is not null and theo_le is not null and abs(extract(epoch from reel_le-theo_le))<=900 then reel-theo end,
 'stock_reference',coalesce(reel,theo),'stock_reference_nature',case when reel is not null then 'reel' when theo is not null then 'theorique' else 'indisponible' end,
 'stock_reference_le',coalesce(reel_le,theo_le),'stock_localise_complet',loc_complet,'nb_zones_relevees',nb_loc,'nb_zones_attendues',nb_att,
 'stock_reel_comptage_id',count_id,'stock_theorique_import_id',imp_id,'stock_theorique_snapshot_id',snapshot_id,'confiance_snapshot',confidence_level,
 'stock_reference_confiance',case when reel is not null and reel_le>=now()-interval '15 min' then 'haute' when reel is not null and reel_le>=now()-interval '24 hour' then 'moyenne' when reel is not null then 'ancienne' when theo is not null then 'theorique' else 'insuffisante' end,
 'stock_reference_statut',case when reel is not null and reel_le>=now()-interval '15 min' then 'observe_recent' when reel is not null and reel_le>=now()-interval '24 hour' then 'observe_du_jour' when reel is not null then 'observe_ancien' when theo is not null then 'theorique_seul' else 'indisponible' end,
 'transferts_internes_integres',reel_source='inventaire_localise','calcule_le',now()
 ) order by designation),'[]'::jsonb) from n;
$$;
grant execute on function public.nexus_stock_lire_etat(text) to anon,authenticated,service_role;
notify pgrst,'reload schema';
