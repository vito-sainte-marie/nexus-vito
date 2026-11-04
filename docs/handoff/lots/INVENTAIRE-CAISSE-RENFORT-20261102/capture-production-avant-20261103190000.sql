CREATE OR REPLACE FUNCTION public.run_scheduled_inventory_reviews()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  r record; q record; p record;
  v_fuseau text;
  v_now_local timestamp; v_today date; v_isodow int;
  v_params jsonb; v_review_time time; v_window_start timestamp; v_window_end timestamp;
  v_period_start date; v_period_end date; v_summary jsonb; v_exists boolean;
  v_quart_cle text; v_fin_normal text; v_delai int; v_deadline timestamp; v_alerte_existe boolean;
begin
  for r in select * from station_config loop
    select s.timezone into v_fuseau from sites s where s.site_id = r.site;
    if v_fuseau is null then
      raise warning 'Synthèse inventaire ignorée pour le site % : aucun fuseau déclaré. NEXUS ne traite pas un site à l''heure d''un autre.', r.site;
      continue;
    end if;
    v_now_local := now() at time zone v_fuseau;
    v_today := v_now_local::date;
    v_isodow := extract(isodow from v_now_local);

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
$function$
