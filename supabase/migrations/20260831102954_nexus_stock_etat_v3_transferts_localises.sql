-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831102954 · nexus_stock_etat_v3_transferts_localises
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace view public.nexus_stock_etat_v3 as
with zones_attendues as (
  select site, categorie_id, count(*)::integer as nb_zones_attendues
  from public.inventaire_categories_zones_stock
  where actif = true
  group by site, categorie_id
),
dernier_releve_zone as (
  select distinct on (r.site, r.produit_id, r.zone_id)
    r.site, r.produit_id, r.zone_id, r.quantite_base, r.releve_le, r.id as releve_id
  from public.inventaire_stock_localise_releves r
  order by r.site, r.produit_id, r.zone_id, r.releve_le desc, r.created_at desc
),
localise_courant_zone as (
  select
    r.site,
    r.produit_id,
    r.zone_id,
    r.quantite_base
      + coalesce((
          select sum(case
            when m.zone_destination_id = r.zone_id then m.quantite
            when m.zone_source_id = r.zone_id then -m.quantite
            else 0 end)
          from public.inventaire_mouvements m
          where m.site = r.site
            and m.produit_id = r.produit_id
            and m.type_mouvement = 'transfert'
            and coalesce(m.statut_validation, 'valide') = 'valide'
            and m.cree_le > r.releve_le
            and (m.zone_source_id = r.zone_id or m.zone_destination_id = r.zone_id)
        ), 0) as quantite_reelle_localisee_courante,
    r.releve_le,
    r.releve_id
  from dernier_releve_zone r
),
localise_courant as (
  select
    l.site,
    l.produit_id,
    sum(l.quantite_reelle_localisee_courante) as stock_reel_localise_courant,
    max(l.releve_le) as stock_reel_localise_observe_le,
    count(*)::integer as nb_zones_relevees,
    array_agg(l.releve_id) as releves_ids
  from localise_courant_zone l
  group by l.site, l.produit_id
),
base as (
  select
    e.*,
    coalesce(za.nb_zones_attendues, 0) as v3_nb_zones_attendues,
    coalesce(lc.nb_zones_relevees, 0) as v3_nb_zones_relevees,
    (coalesce(za.nb_zones_attendues, 0) > 0 and coalesce(lc.nb_zones_relevees, 0) >= za.nb_zones_attendues) as v3_localise_complet,
    lc.stock_reel_localise_courant,
    lc.stock_reel_localise_observe_le
  from public.nexus_stock_etat_v2 e
  left join zones_attendues za on za.site=e.site and za.categorie_id=e.categorie_id
  left join localise_courant lc on lc.site=e.site and lc.produit_id=e.produit_id
),
normalise as (
  select b.*,
    case
      when b.stock_reel_source='inventaire_localise' and b.v3_localise_complet then b.stock_reel_localise_courant
      else b.stock_reel
    end as v3_stock_reel,
    case
      when b.stock_reel_source='inventaire_localise' and b.v3_localise_complet then b.stock_reel_localise_observe_le
      else b.stock_reel_le
    end as v3_stock_reel_le
  from base b
)
select
  produit_id, site, designation, code_barres, categorie_id, categorie, unite, actif,
  v3_stock_reel as stock_reel,
  v3_stock_reel_le as stock_reel_le,
  stock_reel_source,
  stock_theorique,
  stock_theorique_le,
  stock_theorique_source,
  case when v3_stock_reel is not null and stock_theorique is not null then v3_stock_reel-stock_theorique else null end as ecart_reel_theorique,
  coalesce(v3_stock_reel, stock_theorique) as stock_reference,
  case when v3_stock_reel is not null then 'reel'::text when stock_theorique is not null then 'theorique'::text else 'indisponible'::text end as stock_reference_nature,
  case when stock_reel_source='inventaire_localise' then v3_localise_complet else stock_localise_complet end as stock_localise_complet,
  case when stock_reel_source='inventaire_localise' then v3_nb_zones_relevees else nb_zones_relevees end as nb_zones_relevees,
  case when stock_reel_source='inventaire_localise' then v3_nb_zones_attendues else nb_zones_attendues end as nb_zones_attendues,
  stock_reel_comptage_id,
  stock_theorique_import_id,
  stock_theorique_snapshot_id,
  confiance_snapshot,
  now() as calcule_le,
  v3_stock_reel as stock_reel_observe,
  v3_stock_reel_le as stock_reel_observe_le,
  case when v3_stock_reel_le is not null and stock_theorique_le is not null then abs(extract(epoch from (v3_stock_reel_le-stock_theorique_le)))::bigint else null::bigint end as delta_t_secondes,
  case when v3_stock_reel is not null and stock_theorique is not null and v3_stock_reel_le is not null and stock_theorique_le is not null and abs(extract(epoch from (v3_stock_reel_le-stock_theorique_le))) <= 900 then true else false end as comparaison_fiable,
  case when v3_stock_reel is not null and stock_theorique is not null then v3_stock_reel-stock_theorique else null end as ecart_brut_non_aligne,
  case when v3_stock_reel is not null and stock_theorique is not null and v3_stock_reel_le is not null and stock_theorique_le is not null and abs(extract(epoch from (v3_stock_reel_le-stock_theorique_le))) <= 900 then v3_stock_reel-stock_theorique else null::numeric end as ecart_reference,
  case when v3_stock_reel_le is not null then greatest(0::numeric, extract(epoch from (now()-v3_stock_reel_le)))::bigint else null::bigint end as age_stock_reel_secondes,
  case
    when v3_stock_reel is not null and v3_stock_reel_le >= now()-interval '15 minutes' then 'haute'
    when v3_stock_reel is not null and v3_stock_reel_le >= now()-interval '24 hours' then 'moyenne'
    when v3_stock_reel is not null then 'ancienne'
    when stock_theorique is not null then 'theorique'
    else 'insuffisante'
  end::text as stock_reference_confiance,
  case
    when v3_stock_reel is not null and v3_stock_reel_le >= now()-interval '15 minutes' then 'observe_recent'
    when v3_stock_reel is not null and v3_stock_reel_le >= now()-interval '24 hours' then 'observe_du_jour'
    when v3_stock_reel is not null then 'observe_ancien'
    when stock_theorique is not null then 'theorique_seul'
    else 'indisponible'
  end::text as stock_reference_statut,
  case when v3_stock_reel is not null then v3_stock_reel_le when stock_theorique is not null then stock_theorique_le else null::timestamptz end as stock_reference_le,
  (stock_reel_source='inventaire_localise' and v3_localise_complet) as transferts_internes_integres
from normalise;
