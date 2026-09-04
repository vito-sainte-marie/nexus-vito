-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803020504 · inventaire_valeur_estimee_et_review_function
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- NEXUS Inventaire — Supervision configurable, suite (02/08/2026)
-- ============================================================

-- Valeur estimée par anomalie (champ demandé section 3 du cahier des
-- charges). Additif, nullable : toutes les anomalies n'ont pas
-- nécessairement un prix connu au moment de leur création.
alter table public.inventaire_alertes add column if not exists valeur_estimee numeric;
comment on column public.inventaire_alertes.valeur_estimee is
  'Valeur monétaire estimée de l''écart (ex : quantité x prix de vente du fichier Decenium). NULL si aucun prix connu.';

-- Fonction d'agrégation générique : recalcule une synthèse à partir des
-- données sources (jamais stockée comme seule vérité — toujours
-- recalculable). Utilisée aussi bien à la demande (écran manager) que par
-- le traitement planifié qui alimente inventory_reviews.
create or replace function public.generate_inventory_review(
  p_site text,
  p_period_start date,
  p_period_end date,
  p_review_type text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_counts int;
  v_missing_counts int;
  v_completed_categories int;
  v_total_discrepancies int;
  v_open_discrepancies int;
  v_resolved_discrepancies int;
  v_estimated_value numeric;
  v_repeated_products jsonb;
  v_category_summary jsonb;
begin
  if p_review_type not in ('daily','weekly','monthly','exception_only') then
    raise exception 'review_type invalide : %', p_review_type;
  end if;
  if current_employee_site_id() is distinct from p_site or current_employee_role() not in ('manager','gerant') then
    raise exception 'accès refusé';
  end if;

  select count(*) into v_total_counts
  from inventaire_comptages
  where site = p_site and type_comptage in ('ouverture','cloture')
    and compte_le::date between p_period_start and p_period_end;

  select count(*) into v_total_discrepancies
  from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end;

  select count(*) into v_open_discrepancies
  from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end
    and statut in ('ouverte','en_cours');

  select count(*) into v_resolved_discrepancies
  from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end
    and statut in ('resolue','archivee','ignoree');

  select coalesce(sum(valeur_estimee), 0) into v_estimated_value
  from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end;

  -- Comptages manquants : quarts clôturés de la période, comparés au
  -- nombre de produits actifs hors jaugeage carburant (approximation
  -- volontaire — le mode jaugeage peut varier dans le temps, on ignore
  -- cette nuance au niveau agrégé).
  with quarts_periode as (
    select id from inventaire_quarts
    where site = p_site and date between p_period_start and p_period_end and statut = 'cloture'
  ),
  produits_requis as (
    select count(*) as n from inventaire_zone_produit zp
    join inventaire_categories c on c.id = zp.categorie_id
    where zp.site = p_site and zp.actif = true and c.nom <> 'Jaugeage Carburant'
  ),
  comptes_par_quart as (
    select qp.id as quart_id, count(distinct ic.produit_id) as n
    from quarts_periode qp
    left join inventaire_comptages ic on ic.quart_id = qp.id and ic.type_comptage = 'cloture'
    group by qp.id
  )
  select coalesce(sum(greatest(pr.n - cpq.n, 0)), 0) into v_missing_counts
  from comptes_par_quart cpq, produits_requis pr;

  with quarts_periode as (
    select id from inventaire_quarts
    where site = p_site and date between p_period_start and p_period_end and statut = 'cloture'
  ),
  requis_par_categorie as (
    select zp.categorie_id, count(*) as total
    from inventaire_zone_produit zp
    join inventaire_categories c on c.id = zp.categorie_id
    where zp.site = p_site and zp.actif = true and c.nom <> 'Jaugeage Carburant'
    group by zp.categorie_id
  ),
  comptes_par_categorie_quart as (
    select qp.id as quart_id, zp.categorie_id, count(distinct ic.produit_id) as comptes
    from quarts_periode qp
    join inventaire_comptages ic on ic.quart_id = qp.id and ic.type_comptage = 'cloture'
    join inventaire_zone_produit zp on zp.id = ic.produit_id
    group by qp.id, zp.categorie_id
  )
  select count(distinct ccq.categorie_id) into v_completed_categories
  from comptes_par_categorie_quart ccq
  join requis_par_categorie rpc on rpc.categorie_id = ccq.categorie_id
  where ccq.comptes >= rpc.total;

  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_repeated_products
  from (
    select
      a.produit_id as "productId",
      zp.designation as "productName",
      count(*) as "occurrenceCount",
      coalesce(sum(abs(coalesce(a.valeur_attendue,0) - coalesce(a.valeur_constatee,0))), 0) as "totalDifference",
      coalesce(sum(a.valeur_estimee), 0) as "estimatedValue"
    from inventaire_alertes a
    join inventaire_zone_produit zp on zp.id = a.produit_id
    where a.site = p_site and a.cree_le::date between p_period_start and p_period_end
      and a.produit_id is not null
    group by a.produit_id, zp.designation
    having count(*) > 1
    order by count(*) desc
    limit 20
  ) x;

  select coalesce(jsonb_agg(y), '[]'::jsonb) into v_category_summary
  from (
    select
      c.id as "categoryId",
      c.nom as "categoryName",
      count(distinct ic.id) filter (where ic.id is not null) as "totalCounts",
      count(distinct a.id) as "discrepancies",
      count(distinct a.id) filter (where a.statut in ('ouverte','en_cours')) as "openAlerts"
    from inventaire_categories c
    left join inventaire_zone_produit zp on zp.categorie_id = c.id and zp.site = p_site
    left join inventaire_comptages ic on ic.produit_id = zp.id and ic.site = p_site
      and ic.type_comptage in ('ouverture','cloture') and ic.compte_le::date between p_period_start and p_period_end
    left join inventaire_alertes a on a.produit_id = zp.id and a.site = p_site
      and a.cree_le::date between p_period_start and p_period_end
    where c.site = p_site
    group by c.id, c.nom
  ) y;

  return jsonb_build_object(
    'siteId', p_site,
    'periodStart', p_period_start,
    'periodEnd', p_period_end,
    'reviewType', p_review_type,
    'totalCounts', v_total_counts,
    'completedCategories', v_completed_categories,
    'missingCounts', v_missing_counts,
    'totalDiscrepancies', v_total_discrepancies,
    'openDiscrepancies', v_open_discrepancies,
    'resolvedDiscrepancies', v_resolved_discrepancies,
    'estimatedValue', v_estimated_value,
    'repeatedProducts', v_repeated_products,
    'categorySummary', v_category_summary
  );
end;
$$;

revoke all on function public.generate_inventory_review(text, date, date, text) from public;
grant execute on function public.generate_inventory_review(text, date, date, text) to authenticated;
