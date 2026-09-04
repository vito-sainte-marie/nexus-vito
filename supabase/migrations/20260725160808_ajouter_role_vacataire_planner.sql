-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260725160808 · ajouter_role_vacataire_planner
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- NEXUS Planner — introduction du rôle "vacataire"
-- Demande Frédéric (25/07/2026) : un vacataire n'est jamais dans la
-- rotation régulière. Il ne doit être placé par le générateur QUE si
-- un trou réel subsiste après épuisement du personnel régulier, et
-- UNIQUEMENT en piste — jamais en caisse, jamais en renfort.

-- 1) Autoriser le nouveau rôle.
alter table employees drop constraint employees_role_check;
alter table employees add constraint employees_role_check
  check (role = any (array['caissier'::text, 'pompiste'::text, 'renfort'::text, 'manager'::text, 'gerant'::text, 'vacataire'::text]));
-- 2) Réécriture du générateur mensuel avec la règle vacataire.
CREATE OR REPLACE FUNCTION public.generer_planning_mensuel(p_site text, p_mois date, p_genere_par uuid DEFAULT NULL::uuid)
 RETURNS TABLE(date_gap date, quart_gap text, effectif_attendu integer, effectif_obtenu integer)
 LANGUAGE plpgsql
AS $function$
declare
  v_mois_cible date := date_trunc('month', p_mois)::date;
  v_fin date := (date_trunc('month', p_mois) + interval '1 month')::date; -- borne exclusive
  -- Ne jamais commencer avant le lundi de la semaine suivante (par
  -- rapport à AUJOURD'HUI), même si le mois choisi est en cours.
  v_debut date := greatest(v_mois_cible, (date_trunc('week', current_date)::date + 7));
  v_date date;
  v_jour text;
  v_indispo boolean;
  v_repos boolean;
  v_emp record;
  v_mgr record;
  v_horaire record;
  v_quart_type record;
  v_cand record;
  v_effectif_min int;
  v_effectif_min_renfort int;
  v_compte int;
  v_femme_quart2_prise boolean;
  v_piste_donnee boolean;
  v_caisse_donnee boolean;
  v_tache text;
  v_semaine_courante int;
  v_semaine_debut date;
  v_semaine_fin date;
  v_flex record;
  v_jour_cible_dow int;
  v_jour_repos_auto date;
  v_dernier_repos_date date;
  v_renfort_primaire uuid;
  v_gap_min interval := interval '11 hours';
  v_nb_trous int := 0;
  v_nb_lignes int := 0;
begin
  -- Nettoie TOUT le mois cible (pas seulement à partir de v_debut) :
  -- les éventuels brouillons non publiés laissés par un run précédent
  -- entre le 1er du mois et v_debut doivent disparaître. Le passé
  -- réel (publié) n'est jamais concerné grâce à publie = false.
  delete from planning_shifts
  where site_id = p_site
    and date >= v_mois_cible and date < v_fin
    and publie = false;

  create temporary table if not exists tmp_planning_heures (
    employee_id uuid primary key,
    heures numeric not null default 0,
    heures_renfort numeric not null default 0
  ) on commit drop;
  delete from tmp_planning_heures where true;

  insert into tmp_planning_heures (employee_id)
  select id from employees where site_id = p_site and actif = true;

  create temporary table if not exists tmp_planning_historique (
    employee_id uuid primary key,
    weekends_travailles integer not null default 0,
    quart1_travailles integer not null default 0,
    quart2_travailles integer not null default 0
  ) on commit drop;
  delete from tmp_planning_historique where true;

  insert into tmp_planning_historique (employee_id, weekends_travailles, quart1_travailles, quart2_travailles)
  select e.id,
    coalesce((
      select count(distinct ps.date) from planning_shifts ps
      where ps.employee_id = e.id and ps.publie = true
        and ps.statut in ('travail_normal','manager','renfort')
        and extract(dow from ps.date) in (0, 6)
    ), 0),
    coalesce((
      select count(*) from planning_shifts ps
      where ps.employee_id = e.id and ps.publie = true and ps.statut = 'travail_normal' and ps.quart = 'quart1'
    ), 0),
    coalesce((
      select count(*) from planning_shifts ps
      where ps.employee_id = e.id and ps.publie = true and ps.statut = 'travail_normal' and ps.quart = 'quart2'
    ), 0)
  from employees e
  where e.site_id = p_site and e.actif = true;

  create temporary table if not exists tmp_repos_auto (
    employee_id uuid primary key,
    jour_repos date
  ) on commit drop;
  delete from tmp_repos_auto where true;

  create temporary table if not exists tmp_dernier_repos (
    employee_id uuid primary key,
    derniere_date date
  ) on commit drop;
  delete from tmp_dernier_repos where true;

  v_semaine_courante := -1;
  v_renfort_primaire := null;
  v_date := v_debut;

  while v_date < v_fin loop

    if extract(week from v_date)::int <> v_semaine_courante then
      v_semaine_courante := extract(week from v_date)::int;
      update tmp_planning_heures set heures = 0 where true;
      v_renfort_primaire := null;

      v_semaine_debut := v_date;
      v_semaine_fin := least(v_fin - 1, (date_trunc('week', v_date)::date + 6));
      delete from tmp_repos_auto where true;

      -- Un vacataire n'entre jamais dans la rotation automatique de
      -- repos : il n'a pas de jour de repos hebdomadaire fixe, il
      -- n'est appelé qu'au coup par coup en cas de trou.
      for v_flex in
        select e.id,
          c.jours_repos_habituels,
          row_number() over (order by coalesce(h.weekends_travailles, 0) desc, e.nom) as rang
        from employees e
        left join employee_contraintes c on c.employee_id = e.id
        left join tmp_planning_historique h on h.employee_id = e.id
        where e.site_id = p_site and e.actif = true
          and (e.role not in ('manager','gerant') or coalesce(c.integre_au_planning, false) = true)
          and e.role <> 'vacataire'
      loop
        v_jour_repos_auto := null;

        if v_semaine_debut = v_debut and v_flex.jours_repos_habituels is not null and array_length(v_flex.jours_repos_habituels, 1) > 0 then
          select gs.d::date into v_jour_repos_auto
          from generate_series(v_semaine_debut::timestamp, v_semaine_fin::timestamp, interval '1 day') gs(d)
          where (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from gs.d)::int + 1] = any(v_flex.jours_repos_habituels)
          limit 1;
        end if;

        if v_jour_repos_auto is null then
          if v_flex.rang % 3 = 1 then
            v_jour_cible_dow := case when v_semaine_courante % 2 = 0 then 6 else 0 end;
          else
            v_jour_cible_dow := 1 + ((v_flex.rang + v_semaine_courante) % 5);
          end if;

          select gs.d::date into v_jour_repos_auto
          from generate_series(v_semaine_debut::timestamp, v_semaine_fin::timestamp, interval '1 day') gs(d)
          where extract(dow from gs.d)::int = v_jour_cible_dow
          limit 1;
        end if;

        select derniere_date into v_dernier_repos_date from tmp_dernier_repos where employee_id = v_flex.id;
        if v_dernier_repos_date is not null and v_jour_repos_auto is not null and (v_jour_repos_auto - v_dernier_repos_date) > 7 then
          v_jour_repos_auto := v_dernier_repos_date + 7;
        end if;

        if v_jour_repos_auto is not null and v_jour_repos_auto >= v_debut and v_jour_repos_auto < v_fin then
          insert into tmp_repos_auto (employee_id, jour_repos) values (v_flex.id, v_jour_repos_auto)
          on conflict (employee_id) do update set jour_repos = excluded.jour_repos;
          insert into tmp_dernier_repos (employee_id, derniere_date) values (v_flex.id, v_jour_repos_auto)
          on conflict (employee_id) do update set derniere_date = excluded.derniere_date;
        end if;
      end loop;
    end if;

    v_jour := (array['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'])[extract(dow from v_date)::int + 1];

    -- Étape 1 : congés et repos.
    for v_emp in
      select e.id from employees e
      left join employee_contraintes c on c.employee_id = e.id
      where e.site_id = p_site and e.actif = true
        and (e.role not in ('manager','gerant') or coalesce(c.integre_au_planning, false) = true)
    loop
      v_indispo := exists (
        select 1 from employee_indisponibilites i
        where i.employee_id = v_emp.id and v_date between i.date_debut and i.date_fin
      );
      v_repos := (not v_indispo) and exists (
        select 1 from tmp_repos_auto ra
        where ra.employee_id = v_emp.id and ra.jour_repos = v_date
      );
      if v_indispo then
        insert into planning_shifts (site_id, employee_id, date, quart, statut, genere_par)
        values (p_site, v_emp.id, v_date, 'quart1', 'conge', p_genere_par),
               (p_site, v_emp.id, v_date, 'quart2', 'conge', p_genere_par)
        on conflict (employee_id, date, quart) do nothing;
      elsif v_repos then
        insert into planning_shifts (site_id, employee_id, date, quart, statut, genere_par)
        values (p_site, v_emp.id, v_date, 'quart1', 'repos', p_genere_par),
               (p_site, v_emp.id, v_date, 'quart2', 'repos', p_genere_par)
        on conflict (employee_id, date, quart) do nothing;
      end if;
    end loop;

    -- Étape 2 : manager, quart1 ET quart2.
    for v_mgr in
      select e.id from employees e
      join employee_contraintes c on c.employee_id = e.id
      where e.site_id = p_site and e.actif = true and e.role in ('manager','gerant')
        and c.integre_au_planning = true
        and not exists (select 1 from planning_shifts ps where ps.employee_id = e.id and ps.date = v_date and ps.quart = 'quart1')
    loop
      for v_horaire in select * from calculer_horaires_quart(p_site, 'quart1', v_date) loop
        insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, genere_par)
        values (p_site, v_mgr.id, v_date, 'quart1', 'manager', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, p_genere_par)
        on conflict (employee_id, date, quart) do nothing;
        update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_mgr.id;
      end loop;
      for v_horaire in select * from calculer_horaires_quart(p_site, 'quart2', v_date) loop
        insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, genere_par)
        values (p_site, v_mgr.id, v_date, 'quart2', 'manager', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, p_genere_par)
        on conflict (employee_id, date, quart) do nothing;
        update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_mgr.id;
      end loop;
    end loop;

    -- Étape 3 : quart1 puis quart2 — couverture minimum en priorité,
    -- puis attribution piste/caisse (voir en tête de fichier).
    for v_quart_type in select unnest(array['quart1','quart2']) as quart loop
      select effectif_min into v_effectif_min
      from planning_regles_effectif
      where site_id = p_site and quart = v_quart_type.quart and v_jour = any(jours_semaine)
      order by array_length(jours_semaine, 1) asc
      limit 1;
      v_effectif_min := coalesce(v_effectif_min, 2);

      v_compte := 0;
      v_femme_quart2_prise := false;
      v_piste_donnee := false;
      v_caisse_donnee := false;
      for v_horaire in select * from calculer_horaires_quart(p_site, v_quart_type.quart, v_date) loop
        for v_cand in
          select e.id, e.role, ec.sexe from employees e
          join tmp_planning_heures h on h.employee_id = e.id
          left join employee_contraintes ec on ec.employee_id = e.id
          left join tmp_planning_historique hist on hist.employee_id = e.id
          where e.site_id = p_site and e.actif = true and e.role in ('caissier','pompiste','renfort')
            and not exists (
              select 1 from planning_shifts ps
              where ps.employee_id = e.id and ps.date = v_date and ps.quart in ('quart1','quart2','renfort')
            )
            and not exists (
              select 1 from planning_shifts ps
              join calculer_horaires_quart(p_site, ps.quart, ps.date) ch on true
              where ps.employee_id = e.id and ps.date = v_date - 1
                and ps.statut in ('travail_normal','manager','renfort')
                and ps.heure_fin is not null
                and (ps.date + ps.heure_fin + v_gap_min) > (v_date + v_horaire.heure_debut)
            )
          order by
            (case when e.role = 'renfort' then 1 else 0 end),
            (case when ec.heures_contrat_semaine is not null and (h.heures + v_horaire.duree_heures) > ec.heures_contrat_semaine then 1 else 0 end),
            h.heures asc,
            (case when v_quart_type.quart = 'quart1' then coalesce(hist.quart1_travailles, 0) else coalesce(hist.quart2_travailles, 0) end) asc,
            e.nom asc
        loop
          exit when v_compte >= v_effectif_min;

          if v_quart_type.quart = 'quart2' and v_cand.sexe = 'F' and v_femme_quart2_prise then
            continue;
          end if;

          -- Attribution de la tâche : un homme prend la piste en
          -- priorité, une femme prend la caisse en priorité ; sinon
          -- on complète simplement le poste manquant.
          if v_cand.sexe = 'M' and not v_piste_donnee then
            v_tache := 'piste'; v_piste_donnee := true;
          elsif v_cand.sexe = 'F' and not v_caisse_donnee then
            v_tache := 'caisse'; v_caisse_donnee := true;
          elsif not v_piste_donnee then
            v_tache := 'piste'; v_piste_donnee := true;
          elsif not v_caisse_donnee then
            v_tache := 'caisse'; v_caisse_donnee := true;
          else
            v_tache := case when v_compte % 2 = 0 then 'piste' else 'caisse' end;
          end if;

          insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, tache, genere_par)
          values (p_site, v_cand.id, v_date, v_quart_type.quart, 'travail_normal', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, v_tache, p_genere_par)
          on conflict (employee_id, date, quart) do nothing;
          update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_cand.id;
          v_compte := v_compte + 1;
          if v_quart_type.quart = 'quart2' and v_cand.sexe = 'F' then
            v_femme_quart2_prise := true;
          end if;
        end loop;

        -- Étape 3bis : dernier recours "vacataire". Uniquement si un
        -- trou réel subsiste après épuisement du personnel régulier,
        -- et uniquement pour la tâche piste — jamais caisse, jamais
        -- renfort (le rôle 'vacataire' n'est de toute façon jamais
        -- éligible au renfort, voir étape 4).
        if v_compte < v_effectif_min and not v_piste_donnee then
          for v_cand in
            select e.id from employees e
            join tmp_planning_heures h on h.employee_id = e.id
            where e.site_id = p_site and e.actif = true and e.role = 'vacataire'
              and not exists (
                select 1 from planning_shifts ps
                where ps.employee_id = e.id and ps.date = v_date and ps.quart in ('quart1','quart2','renfort')
              )
              and not exists (
                select 1 from planning_shifts ps
                join calculer_horaires_quart(p_site, ps.quart, ps.date) ch on true
                where ps.employee_id = e.id and ps.date = v_date - 1
                  and ps.statut in ('travail_normal','manager','renfort')
                  and ps.heure_fin is not null
                  and (ps.date + ps.heure_fin + v_gap_min) > (v_date + v_horaire.heure_debut)
              )
            order by h.heures asc, e.nom asc
          loop
            exit when v_compte >= v_effectif_min or v_piste_donnee;
            insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, tache, genere_par)
            values (p_site, v_cand.id, v_date, v_quart_type.quart, 'travail_normal', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, 'piste', p_genere_par)
            on conflict (employee_id, date, quart) do nothing;
            update tmp_planning_heures set heures = heures + v_horaire.duree_heures where employee_id = v_cand.id;
            v_compte := v_compte + 1;
            v_piste_donnee := true;
          end loop;
        end if;

        if v_compte < v_effectif_min then
          date_gap := v_date; quart_gap := v_quart_type.quart; effectif_attendu := v_effectif_min; effectif_obtenu := v_compte;
          v_nb_trous := v_nb_trous + 1;
          return next;
        end if;
      end loop;
    end loop;

    -- Étape 4 : renfort. Éligible si : rôle "renfort" (directement,
    -- sans réglage manuel requis) OU peut_faire_renfort = true dans
    -- employee_contraintes (cas des caissier(e)s en renfort ponctuel).
    -- Un vacataire n'est jamais éligible au renfort, quel que soit le
    -- réglage peut_faire_renfort.
    select effectif_min into v_effectif_min_renfort
    from planning_regles_effectif
    where site_id = p_site and quart = 'renfort' and v_jour = any(jours_semaine)
    order by array_length(jours_semaine, 1) asc
    limit 1;
    v_effectif_min_renfort := coalesce(v_effectif_min_renfort, 1);

    if v_renfort_primaire is null and v_effectif_min_renfort > 0 then
      select e.id into v_renfort_primaire
      from employees e
      left join employee_contraintes c on c.employee_id = e.id
      join tmp_planning_heures h on h.employee_id = e.id
      where e.site_id = p_site and e.actif = true
        and e.role <> 'vacataire'
        and (e.role = 'renfort' or coalesce(c.peut_faire_renfort, false) = true)
      order by h.heures_renfort asc, e.nom asc
      limit 1;
    end if;

    v_compte := 0;
    for v_horaire in select * from calculer_horaires_quart(p_site, 'renfort', v_date) loop
      for v_cand in
        select e.id from employees e
        left join employee_contraintes c on c.employee_id = e.id
        join tmp_planning_heures h on h.employee_id = e.id
        where e.site_id = p_site and e.actif = true
          and e.role <> 'vacataire'
          and (e.role = 'renfort' or coalesce(c.peut_faire_renfort, false) = true)
          and not exists (select 1 from planning_shifts ps where ps.employee_id = e.id and ps.date = v_date and ps.quart in ('quart1','quart2'))
        order by (e.id <> v_renfort_primaire), h.heures_renfort asc, e.nom asc
      loop
        exit when v_compte >= v_effectif_min_renfort;
        insert into planning_shifts (site_id, employee_id, date, quart, statut, duree_heures, heure_debut, heure_fin, genere_par)
        values (p_site, v_cand.id, v_date, 'renfort', 'renfort', v_horaire.duree_heures, v_horaire.heure_debut, v_horaire.heure_fin, p_genere_par)
        on conflict (employee_id, date, quart) do nothing;
        update tmp_planning_heures
          set heures = heures + v_horaire.duree_heures, heures_renfort = heures_renfort + v_horaire.duree_heures
          where employee_id = v_cand.id;
        v_compte := v_compte + 1;
      end loop;

      if v_compte < v_effectif_min_renfort then
        date_gap := v_date; quart_gap := 'renfort'; effectif_attendu := v_effectif_min_renfort; effectif_obtenu := v_compte;
        v_nb_trous := v_nb_trous + 1;
        return next;
      end if;
    end loop;

    v_date := v_date + 1;
  end loop;

  select count(*) into v_nb_lignes
  from planning_shifts
  where site_id = p_site and date >= v_debut and date < v_fin and publie = false;

  insert into planning_generations (site_id, mois, genere_par, debut_reel, fin_reel, nb_lignes, nb_trous)
  values (p_site, v_mois_cible, p_genere_par, v_debut, v_fin - 1, v_nb_lignes, v_nb_trous);

  return;
end;
$function$;
