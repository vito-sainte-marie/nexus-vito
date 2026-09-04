-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260803021549 · planification_synthese_inventaire
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- ============================================================
-- NEXUS Inventaire — Planification automatique des synthèses
-- (02/08/2026, section 8 du cahier des charges).
-- ============================================================

-- 1) Extrait la logique de calcul dans une fonction interne sans contrôle
-- d'accès (appelée à la fois par le RPC manager, déjà protégé, et par le
-- traitement planifié qui tourne sans session utilisateur).
create or replace function public._generate_inventory_review_core(
  p_site text, p_period_start date, p_period_end date, p_review_type text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_total_counts int; v_missing_counts int; v_completed_categories int;
  v_total_discrepancies int; v_open_discrepancies int; v_resolved_discrepancies int;
  v_estimated_value numeric; v_repeated_products jsonb; v_category_summary jsonb;
begin
  select count(*) into v_total_counts from inventaire_comptages
  where site = p_site and type_comptage in ('ouverture','cloture') and compte_le::date between p_period_start and p_period_end;
  select count(*) into v_total_discrepancies from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end;
  select count(*) into v_open_discrepancies from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end and statut in ('ouverte','en_cours');
  select count(*) into v_resolved_discrepancies from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end and statut in ('resolue','archivee','ignoree');
  select coalesce(sum(valeur_estimee),0) into v_estimated_value from inventaire_alertes
  where site = p_site and cree_le::date between p_period_start and p_period_end;
  with quarts_periode as (select id from inventaire_quarts where site=p_site and date between p_period_start and p_period_end and statut='cloture'),
  produits_requis as (select count(*) as n from inventaire_zone_produit zp join inventaire_categories c on c.id=zp.categorie_id where zp.site=p_site and zp.actif=true and c.nom <> 'Jaugeage Carburant'),
  comptes_par_quart as (select qp.id as quart_id, count(distinct ic.produit_id) as n from quarts_periode qp left join inventaire_comptages ic on ic.quart_id=qp.id and ic.type_comptage='cloture' group by qp.id)
  select coalesce(sum(greatest(pr.n - cpq.n,0)),0) into v_missing_counts from comptes_par_quart cpq, produits_requis pr;
  with quarts_periode as (select id from inventaire_quarts where site=p_site and date between p_period_start and p_period_end and statut='cloture'),
  requis_par_categorie as (select zp.categorie_id, count(*) as total from inventaire_zone_produit zp join inventaire_categories c on c.id=zp.categorie_id where zp.site=p_site and zp.actif=true and c.nom <> 'Jaugeage Carburant' group by zp.categorie_id),
  comptes_par_categorie_quart as (select qp.id as quart_id, zp.categorie_id, count(distinct ic.produit_id) as comptes from quarts_periode qp join inventaire_comptages ic on ic.quart_id=qp.id and ic.type_comptage='cloture' join inventaire_zone_produit zp on zp.id=ic.produit_id group by qp.id, zp.categorie_id)
  select count(distinct ccq.categorie_id) into v_completed_categories from comptes_par_categorie_quart ccq join requis_par_categorie rpc on rpc.categorie_id=ccq.categorie_id where ccq.comptes >= rpc.total;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_repeated_products from (
    select a.produit_id as "productId", zp.designation as "productName", count(*) as "occurrenceCount",
      coalesce(sum(abs(coalesce(a.valeur_attendue,0)-coalesce(a.valeur_constatee,0))),0) as "totalDifference",
      coalesce(sum(a.valeur_estimee),0) as "estimatedValue"
    from inventaire_alertes a join inventaire_zone_produit zp on zp.id=a.produit_id
    where a.site=p_site and a.cree_le::date between p_period_start and p_period_end and a.produit_id is not null
    group by a.produit_id, zp.designation having count(*) > 1 order by count(*) desc limit 20
  ) x;
  select coalesce(jsonb_agg(y),'[]'::jsonb) into v_category_summary from (
    select c.id as "categoryId", c.nom as "categoryName",
      count(distinct ic.id) filter (where ic.id is not null) as "totalCounts",
      count(distinct a.id) as "discrepancies",
      count(distinct a.id) filter (where a.statut in ('ouverte','en_cours')) as "openAlerts"
    from inventaire_categories c
    left join inventaire_zone_produit zp on zp.categorie_id=c.id and zp.site=p_site
    left join inventaire_comptages ic on ic.produit_id=zp.id and ic.site=p_site and ic.type_comptage in ('ouverture','cloture') and ic.compte_le::date between p_period_start and p_period_end
    left join inventaire_alertes a on a.produit_id=zp.id and a.site=p_site and a.cree_le::date between p_period_start and p_period_end
    where c.site=p_site group by c.id, c.nom
  ) y;
  return jsonb_build_object('siteId',p_site,'periodStart',p_period_start,'periodEnd',p_period_end,'reviewType',p_review_type,
    'totalCounts',v_total_counts,'completedCategories',v_completed_categories,'missingCounts',v_missing_counts,
    'totalDiscrepancies',v_total_discrepancies,'openDiscrepancies',v_open_discrepancies,'resolvedDiscrepancies',v_resolved_discrepancies,
    'estimatedValue',v_estimated_value,'repeatedProducts',v_repeated_products,'categorySummary',v_category_summary);
end;
$$;

-- generate_inventory_review reste le point d'entrée protégé pour l'écran
-- manager (vérifie site + rôle), maintenant simple appelant du coeur ci-dessus.
create or replace function public.generate_inventory_review(
  p_site text, p_period_start date, p_period_end date, p_review_type text
) returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_review_type not in ('daily','weekly','monthly','exception_only') then
    raise exception 'review_type invalide : %', p_review_type;
  end if;
  if current_employee_site_id() is distinct from p_site or current_employee_role() not in ('manager','gerant') then
    raise exception 'accès refusé';
  end if;
  return public._generate_inventory_review_core(p_site, p_period_start, p_period_end, p_review_type);
end;
$$;

-- 2) Traitement planifié : génère et stocke une synthèse pour chaque site
-- dès que son heure de synthèse configurée est atteinte, sans jamais
-- recalculer inutilement (une seule ligne par période déjà couverte).
-- Vérifie aussi, indépendamment de la fréquence choisie, deux alertes
-- immédiates temporelles/statistiques que seul un traitement planifié
-- peut détecter (pas liées à un événement d'insertion précis) :
-- clôture non terminée après le délai prévu, et anomalie répétée sur un
-- même produit sur les 7 derniers jours.
create or replace function public.run_scheduled_inventory_reviews()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record; q record; p record;
  v_now_local timestamp; v_today date; v_isodow int;
  v_params jsonb; v_review_time time; v_window_start timestamp; v_window_end timestamp;
  v_period_start date; v_period_end date; v_summary jsonb; v_exists boolean;
  v_quart_cle text; v_fin_normal text; v_delai int; v_deadline timestamp; v_alerte_existe boolean;
begin
  v_now_local := now() at time zone 'America/Martinique';
  v_today := v_now_local::date;
  v_isodow := extract(isodow from v_now_local);

  for r in select * from station_config loop
    v_params := coalesce(r.parametres_inventaire, '{}'::jsonb);
    v_review_time := coalesce(nullif(v_params->>'reviewTime','')::time, '20:00'::time);
    v_window_start := v_today + v_review_time;
    v_window_end := v_window_start + interval '15 minutes';

    if v_params->>'reviewFrequency' = 'daily' and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_start := v_today; v_period_end := v_today;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'daily' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'daily');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'daily', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    if v_params->>'reviewFrequency' = 'weekly' and v_isodow = coalesce(nullif(v_params->>'weeklyReviewDay','')::int, 0) + 1
       and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_end := v_today - 1; v_period_start := v_period_end - 6;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'weekly' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'weekly');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'weekly', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    if v_params->>'reviewFrequency' = 'monthly'
       and extract(day from v_now_local)::int = least(coalesce(nullif(v_params->>'monthlyReviewDay','')::int, 1), extract(day from (date_trunc('month', v_today) + interval '1 month - 1 day'))::int)
       and v_now_local >= v_window_start and v_now_local < v_window_end then
      v_period_start := date_trunc('month', v_today - interval '1 month')::date;
      v_period_end := (date_trunc('month', v_today) - interval '1 day')::date;
      select exists(select 1 from inventory_reviews where site = r.site and review_type = 'monthly' and period_start = v_period_start and period_end = v_period_end) into v_exists;
      if not v_exists then
        v_summary := public._generate_inventory_review_core(r.site, v_period_start, v_period_end, 'monthly');
        insert into inventory_reviews (site, review_type, period_start, period_end, summary_json) values (r.site, 'monthly', v_period_start, v_period_end, v_summary);
      end if;
    end if;

    v_delai := coalesce(nullif(v_params->>'closureDelayMinutes','')::int, 30);
    for q in select * from inventaire_quarts where site = r.site and statut <> 'cloture' and date >= v_today - 2 loop
      v_quart_cle := case q.quart when 'matin' then 'quart1' when 'soir' then 'quart2' else null end;
      if v_quart_cle is not null and r.horaires ? v_quart_cle then
        v_fin_normal := r.horaires->v_quart_cle->>'fin_normal';
        if v_fin_normal is not null then
          v_deadline := q.date + v_fin_normal::time + (v_delai || ' minutes')::interval;
          if v_now_local > v_deadline then
            select exists(select 1 from inventaire_alertes where quart_id = q.id and type_alerte = 'cloture_en_retard' and statut in ('ouverte','en_cours')) into v_alerte_existe;
            if not v_alerte_existe then
              insert into inventaire_alertes (site, quart_id, type_alerte, gravite) values (r.site, q.id, 'cloture_en_retard', 'critique');
            end if;
          end if;
        end if;
      end if;
    end loop;

    for p in
      select produit_id, count(*) as n from inventaire_alertes
      where site = r.site and produit_id is not null and cree_le >= (v_now_local - interval '7 days')
        and type_alerte not in ('anomalie_repetee','cloture_en_retard','cloture_incomplete','reassort_non_justifie','modification_apres_validation')
      group by produit_id having count(*) >= 3
    loop
      select exists(select 1 from inventaire_alertes where produit_id = p.produit_id and type_alerte = 'anomalie_repetee' and statut in ('ouverte','en_cours') and cree_le >= (v_now_local - interval '7 days')) into v_alerte_existe;
      if not v_alerte_existe then
        insert into inventaire_alertes (site, produit_id, type_alerte, gravite, valeur_constatee) values (r.site, p.produit_id, 'anomalie_repetee', 'attention', p.n);
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.run_scheduled_inventory_reviews() from public;
revoke all on function public._generate_inventory_review_core(text, date, date, text) from public;

-- 3) Planification pg_cron : toutes les 15 minutes, chaque site est
-- évalué indépendamment selon ses propres réglages.
select cron.unschedule(jobid) from cron.job where jobname = 'nexus-inventaire-reviews';
select cron.schedule('nexus-inventaire-reviews', '*/15 * * * *', 'select public.run_scheduled_inventory_reviews();');
