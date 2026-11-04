-- Clôture serveur du quart d'inventaire (lot INVENTAIRE-CAISSE-RENFORT-20261102).
-- Règle : request-14 + request-15, verdict de l'arbitre APPROVED_WITH_CONDITIONS
-- (issue #28, commentaire 6617300941) ; choix C1 et « prise de poste » de Frédéric
-- (03/11/2026, #160 6616736762 et 6617056409).
--
--   1. Population = lignes inventaire_quart_employes du quart dont le shift a le
--      même `quart` que le quart. shifts.quart fait seule foi du rattachement.
--      Toutes ont a_valide_cloture = true -> clôture anticipée, cloture_le = dernier
--      heure_depart. Population vide -> aucune clôture anticipée.
--   2. Repli : fin planifiée + closureDelayMinutes (30 par défaut) ;
--      cloture_le = fin planifiée + délai, exactement. Alerte `cloture_incomplete`
--      si des produits obligatoires du plan n'ont pas été comptés.
--   3. Aucune donnée existante n'est corrigée : les lignes divergentes sont
--      comptées et consignées dans l'audit, jamais déplacées.
--   4. Le cron ignore les quarts déjà clos ; filtre par site à chaque lecture et
--      écriture ; garde de statut ; unicité des alertes. Aucune politique, aucun
--      grant, aucune fonction employé n'est touché (CREATE OR REPLACE conserve les
--      droits de la fonction).
create or replace function public.run_scheduled_inventory_reviews()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  r record; q record; p record;
  v_fuseau text;
  v_now_local timestamp; v_today date; v_isodow int;
  v_params jsonb; v_review_time time; v_window_start timestamp; v_window_end timestamp;
  v_period_start date; v_period_end date; v_summary jsonb; v_exists boolean;
  v_quart_cle text; v_fin_normal text; v_delai int; v_deadline timestamp; v_alerte_existe boolean;
  v_population int; v_validees int; v_divergentes int; v_dernier_depart timestamptz;
  v_non_comptes int; v_cloture_le timestamptz; v_mode text; v_modifie int;
begin
  for r in select * from station_config loop
    -- A3-3 : le fuseau du site courant, jamais un fuseau global.
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
      v_fin_normal := case when v_quart_cle is not null and r.horaires ? v_quart_cle then r.horaires->v_quart_cle->>'fin_normal' else null end;
      v_deadline := case when v_fin_normal is not null then q.date + v_fin_normal::time + (v_delai || ' minutes')::interval else null end;

      -- Clôture anticipée (C1) : seul le shift de même quart fait foi.
      if q.statut in ('ouvert','cloture_en_cours') then
        select count(*) filter (where s.quart = q.quart),
               count(*) filter (where s.quart = q.quart and e.a_valide_cloture),
               count(*) filter (where s.quart is distinct from q.quart),
               max(e.heure_depart) filter (where s.quart = q.quart)
          into v_population, v_validees, v_divergentes, v_dernier_depart
          from inventaire_quart_employes e
          join inventaire_quarts qq on qq.id = e.quart_id and qq.site = r.site
          left join shifts s on s.id = e.shift_id and s.site = r.site
         where e.quart_id = q.id;

        if v_population > 0 and v_validees = v_population then
          v_cloture_le := coalesce(v_dernier_depart, now());
          v_mode := 'anticipee';
        elsif v_deadline is not null and v_now_local > v_deadline then
          v_cloture_le := v_deadline at time zone v_fuseau;
          v_mode := 'repli';
        else
          v_mode := null;
        end if;

        v_non_comptes := 0;
        if v_mode is not null then
          if v_mode = 'repli' then
            select count(*) into v_non_comptes
              from inventaire_plan_items i
              join inventaire_plans_comptage pl on pl.id = i.plan_id
             where pl.site = r.site and pl.date = q.date and pl.quart = q.quart
               and i.site = r.site and i.obligatoire and i.statut = 'a_faire' and i.comptage_id is null;
            if v_non_comptes > 0 then
              select exists(select 1 from inventaire_alertes where quart_id = q.id and type_alerte = 'cloture_incomplete' and statut in ('ouverte','en_cours')) into v_alerte_existe;
              if not v_alerte_existe then
                insert into inventaire_alertes (site, quart_id, type_alerte, gravite, valeur_constatee)
                values (r.site, q.id, 'cloture_incomplete', 'attention', v_non_comptes);
              end if;
            end if;
          end if;

          update inventaire_quarts
             set statut = 'cloture', cloture_le = v_cloture_le
           where id = q.id and site = r.site and statut in ('ouvert','cloture_en_cours');
          get diagnostics v_modifie = row_count;

          if v_modifie > 0 then
            insert into inventaire_audit_log (site, quart_id, entite_type, entite_id, action, ancienne_valeur, nouvelle_valeur, motif, metadata)
            values (r.site, q.id, 'inventaire_quart', q.id, 'cloture_serveur',
                    jsonb_build_object('statut', q.statut),
                    jsonb_build_object('statut', 'cloture', 'cloture_le', v_cloture_le),
                    case v_mode when 'anticipee' then 'Toute la population du quart a validé la clôture' else 'Repli : fin planifiée + délai de clôture' end,
                    jsonb_build_object('mode', v_mode, 'population', v_population, 'validees', v_validees,
                                       'lignes_divergentes', v_divergentes, 'produits_non_comptes', v_non_comptes));
            continue;
          end if;
        end if;
      end if;

      -- Alerte de clôture en retard (inchangée).
      if v_deadline is not null and v_now_local > v_deadline then
        select exists(select 1 from inventaire_alertes where quart_id = q.id and type_alerte = 'cloture_en_retard' and statut in ('ouverte','en_cours')) into v_alerte_existe;
        if not v_alerte_existe then
          insert into inventaire_alertes (site, quart_id, type_alerte, gravite) values (r.site, q.id, 'cloture_en_retard', 'critique');
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
$function$;

-- Restriction (GO de Frédéric 03/11 19:02, Guardian #160 6617703169) : la fonction
-- ferme des quarts sur tous les sites ; seul postgres (cron) doit l'exécuter, comme
-- en Production. Aucun grant n'est accordé.
revoke execute on function public.run_scheduled_inventory_reviews() from public, anon, authenticated;
