-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831013447 · nexus_stock_etat_central_separe_reel_theorique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create or replace view public.nexus_stock_etat
with (security_invoker = true)
as
with
zones_attendues as (
  select site, categorie_id, count(*)::integer as nb_zones_attendues
  from public.inventaire_categories_zones_stock
  where actif = true
  group by site, categorie_id
),
localise_dernier_par_zone as (
  select distinct on (r.site, r.produit_id, r.zone_id)
    r.site,
    r.produit_id,
    r.zone_id,
    r.quantite_base,
    r.releve_le,
    r.id as releve_id
  from public.inventaire_stock_localise_releves r
  order by r.site, r.produit_id, r.zone_id, r.releve_le desc, r.created_at desc
),
localise_agrege as (
  select
    z.site,
    z.produit_id,
    sum(z.quantite_base)::numeric as quantite_reelle_localisee,
    max(z.releve_le) as reel_localise_le,
    count(*)::integer as nb_zones_relevees,
    array_agg(z.releve_id) as releves_ids
  from localise_dernier_par_zone z
  group by z.site, z.produit_id
),
comptage_physique_dernier as (
  select distinct on (c.site, c.produit_id)
    c.site,
    c.produit_id,
    c.quantite as quantite_reelle_comptage,
    c.compte_le as reel_comptage_le,
    c.id as comptage_id,
    c.type_comptage,
    c.employee_id
  from public.inventaire_comptages c
  where c.statut = 'valide'
    and c.source = 'manuel'
    and c.type_comptage in ('ouverture','intermediaire','cloture','recomptage_manager')
  order by c.site, c.produit_id, c.compte_le desc, c.created_at desc
),
stock_import_dernier as (
  select distinct on (s.site, coalesce(nullif(trim(s.code_barres),''), lower(trim(s.article))))
    s.site,
    s.article,
    nullif(trim(s.code_barres),'') as code_barres,
    s.quantite_theorique,
    s.releve_le,
    s.id as releve_stock_id
  from public.stock_releves s
  where s.quantite_theorique is not null
  order by s.site,
           coalesce(nullif(trim(s.code_barres),''), lower(trim(s.article))),
           s.releve_le desc,
           s.importe_le desc
),
snapshot_theorique_dernier as (
  select distinct on (l.site, l.produit_id)
    l.site,
    l.produit_id,
    l.quantite_stock,
    coalesce(s.snapshot_reference_at, s.stock_export_at, l.importe_le) as theorique_le,
    l.id as snapshot_ligne_id,
    s.id as snapshot_id,
    s.confidence_level as confiance_snapshot
  from public.inventaire_decenium_snapshot_lignes l
  join public.inventaire_decenium_snapshots s on s.id = l.snapshot_id
  where l.quantite_stock is not null
    and coalesce(s.status,'') not in ('annule','supprime','failed','erreur')
  order by l.site, l.produit_id,
           coalesce(s.snapshot_reference_at, s.stock_export_at, l.importe_le) desc,
           l.importe_le desc
),
base as (
  select
    p.id as produit_id,
    p.site,
    p.designation,
    p.code_barres,
    p.categorie_id,
    cat.nom as categorie,
    p.unite,
    p.actif,
    coalesce(za.nb_zones_attendues,0) as nb_zones_attendues,
    coalesce(la.nb_zones_relevees,0) as nb_zones_relevees,
    case
      when coalesce(za.nb_zones_attendues,0) > 0
       and coalesce(la.nb_zones_relevees,0) >= za.nb_zones_attendues
      then true else false
    end as stock_localise_complet,
    la.quantite_reelle_localisee,
    la.reel_localise_le,
    cp.quantite_reelle_comptage,
    cp.reel_comptage_le,
    cp.comptage_id,
    cp.type_comptage,
    cp.employee_id,
    si.quantite_theorique as quantite_theorique_import,
    si.releve_le as theorique_import_le,
    si.releve_stock_id,
    st.quantite_stock as quantite_theorique_snapshot,
    st.theorique_le as theorique_snapshot_le,
    st.snapshot_ligne_id,
    st.snapshot_id,
    st.confiance_snapshot
  from public.inventaire_zone_produit p
  left join public.inventaire_categories cat on cat.id = p.categorie_id
  left join zones_attendues za on za.site = p.site and za.categorie_id = p.categorie_id
  left join localise_agrege la on la.site = p.site and la.produit_id = p.id
  left join comptage_physique_dernier cp on cp.site = p.site and cp.produit_id = p.id
  left join lateral (
    select s.*
    from stock_import_dernier s
    where s.site = p.site
      and (
        (p.code_barres is not null and s.code_barres = p.code_barres)
        or (s.code_barres is null and lower(trim(s.article)) = lower(trim(p.designation)))
      )
    order by
      case when p.code_barres is not null and s.code_barres = p.code_barres then 0 else 1 end,
      s.releve_le desc
    limit 1
  ) si on true
  left join snapshot_theorique_dernier st on st.site = p.site and st.produit_id = p.id
)
select
  b.produit_id,
  b.site,
  b.designation,
  b.code_barres,
  b.categorie_id,
  b.categorie,
  b.unite,
  b.actif,

  /* Vérité physique : jamais additionnée au théorique et jamais écrasée par un import. */
  case
    when b.stock_localise_complet
      and (b.reel_comptage_le is null or b.reel_localise_le >= b.reel_comptage_le)
      then b.quantite_reelle_localisee
    else b.quantite_reelle_comptage
  end as stock_reel,
  case
    when b.stock_localise_complet
      and (b.reel_comptage_le is null or b.reel_localise_le >= b.reel_comptage_le)
      then b.reel_localise_le
    else b.reel_comptage_le
  end as stock_reel_le,
  case
    when b.stock_localise_complet
      and (b.reel_comptage_le is null or b.reel_localise_le >= b.reel_comptage_le)
      then 'inventaire_localise'
    when b.quantite_reelle_comptage is not null then 'inventaire_physique'
    else null
  end as stock_reel_source,

  /* Théorique : dernière source logicielle connue. Un Snapshot Decenium plus récent
     prend la place de l'ancien import, sans toucher au stock réel. */
  case
    when b.quantite_theorique_snapshot is not null
      and (b.theorique_import_le is null or b.theorique_snapshot_le >= b.theorique_import_le)
      then b.quantite_theorique_snapshot
    else b.quantite_theorique_import
  end as stock_theorique,
  case
    when b.quantite_theorique_snapshot is not null
      and (b.theorique_import_le is null or b.theorique_snapshot_le >= b.theorique_import_le)
      then b.theorique_snapshot_le
    else b.theorique_import_le
  end as stock_theorique_le,
  case
    when b.quantite_theorique_snapshot is not null
      and (b.theorique_import_le is null or b.theorique_snapshot_le >= b.theorique_import_le)
      then 'decenium_snapshot'
    when b.quantite_theorique_import is not null then 'import_stock'
    else null
  end as stock_theorique_source,

  /* Écart = comparaison, jamais fusion. */
  (case
    when b.stock_localise_complet
      and (b.reel_comptage_le is null or b.reel_localise_le >= b.reel_comptage_le)
      then b.quantite_reelle_localisee
    else b.quantite_reelle_comptage
   end)
  -
  (case
    when b.quantite_theorique_snapshot is not null
      and (b.theorique_import_le is null or b.theorique_snapshot_le >= b.theorique_import_le)
      then b.quantite_theorique_snapshot
    else b.quantite_theorique_import
   end) as ecart_reel_theorique,

  /* Stock de référence pour les moteurs NEXUS : priorité au physique lorsqu'il existe.
     L'origine reste toujours explicitement exposée. */
  coalesce(
    case
      when b.stock_localise_complet
        and (b.reel_comptage_le is null or b.reel_localise_le >= b.reel_comptage_le)
        then b.quantite_reelle_localisee
      else b.quantite_reelle_comptage
    end,
    case
      when b.quantite_theorique_snapshot is not null
        and (b.theorique_import_le is null or b.theorique_snapshot_le >= b.theorique_import_le)
        then b.quantite_theorique_snapshot
      else b.quantite_theorique_import
    end
  ) as stock_reference,
  case
    when (case
      when b.stock_localise_complet
        and (b.reel_comptage_le is null or b.reel_localise_le >= b.reel_comptage_le)
        then b.quantite_reelle_localisee
      else b.quantite_reelle_comptage
    end) is not null then 'reel'
    when (case
      when b.quantite_theorique_snapshot is not null
        and (b.theorique_import_le is null or b.theorique_snapshot_le >= b.theorique_import_le)
        then b.quantite_theorique_snapshot
      else b.quantite_theorique_import
    end) is not null then 'theorique'
    else 'indisponible'
  end as stock_reference_nature,

  b.stock_localise_complet,
  b.nb_zones_relevees,
  b.nb_zones_attendues,
  b.comptage_id as stock_reel_comptage_id,
  b.releve_stock_id as stock_theorique_import_id,
  b.snapshot_id as stock_theorique_snapshot_id,
  b.confiance_snapshot,
  now() as calcule_le
from base b;

comment on view public.nexus_stock_etat is
'NEXUS Stock Engine — lecture centrale séparant strictement stock réel (inventaire physique) et stock théorique (imports/Decenium). Aucun stock n’est additionné ou écrasé entre sources. stock_reference privilégie le réel lorsqu’il existe et expose toujours sa nature.';
