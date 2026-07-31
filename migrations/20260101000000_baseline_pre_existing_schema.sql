-- ============================================================
-- NEXUS — Baseline du schéma pré-existant (généré le 31/07/2026)
-- Capture les objets créés AVANT toute migration trackée par
-- Supabase : 34 tables, 7 vues et 13 fonctions qui existaient déjà
-- en production sans qu'aucune migration n'ait jamais enregistré
-- leur création. Extrait fidèlement d'un dump réel (supabase db
-- dump --linked --schema public), jamais reconstruit de mémoire —
-- conforme au principe NEXUS : jamais un schéma inventé.
--
-- Ce fichier doit rester le TOUT PREMIER migré (horodatage le plus
-- ancien) : les 26 migrations suivantes supposent que ces tables
-- existent déjà.
-- ============================================================




SET statement_timeout = 0;

SET lock_timeout = 0;

SET idle_in_transaction_session_timeout = 0;

SET client_encoding = 'UTF8';

SET standard_conforming_strings = on;

SET check_function_bodies = false;

SET xmloption = content;

SET client_min_messages = warning;

SET row_security = off;


CREATE OR REPLACE FUNCTION "public"."assigner_controles_tenue_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_site text;
  v_nb integer := 0;
  r record;
begin
  select site_id into v_site from advisor_messages where id = p_message_id;
  if v_site is null then
    raise exception 'Message % introuvable', p_message_id;
  end if;

  for r in
    select ame.source_id as employee_id_text
    from advisor_message_evidence ame
    where ame.advisor_message_id = p_message_id
      and ame.source_type = 'controles_tenue'
  loop
    insert into mission_assignments (
      mission_id, assigned_to_role, assigned_by_employee_id, note, status, site_id
    ) values (
      'qualite-controle-tenue-employe',
      'manager',
      p_assigne_par,
      'Employé à contrôler : ' || coalesce((select nom from employees where id = r.employee_id_text::uuid), r.employee_id_text),
      'assignee',
      v_site
    );
    v_nb := v_nb + 1;
  end loop;

  update advisor_messages
  set status = 'converti_action', converted_to_action_at = now()
  where id = p_message_id;

  return v_nb; -- nombre d'assignations reellement creees
end;
$$;




ALTER FUNCTION "public"."assigner_controles_tenue_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."assigner_justifications_caisse_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_site text;
  v_nb integer := 0;
  r record;
begin
  select site_id into v_site from advisor_messages where id = p_message_id;
  if v_site is null then
    raise exception 'Message % introuvable', p_message_id;
  end if;

  for r in
    select ame.source_id as audit_id_text, ame.observed_value, ame.period_end
    from advisor_message_evidence ame
    where ame.advisor_message_id = p_message_id
      and ame.source_type = 'audits_caisse'
  loop
    insert into mission_assignments (
      mission_id, assigned_to_role, assigned_by_employee_id, note, status, site_id
    ) values (
      'caisse-justifier-ecart',
      'manager',
      p_assigne_par,
      'Quart du ' || coalesce(r.period_end::text, '?') || ' — écart de ' || coalesce(r.observed_value::text, '?') || ' €',
      'assignee',
      v_site
    );
    v_nb := v_nb + 1;
  end loop;

  update advisor_messages
  set status = 'converti_action', converted_to_action_at = now()
  where id = p_message_id;

  return v_nb;
end;
$$;




ALTER FUNCTION "public"."assigner_justifications_caisse_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."calculer_caisse_sante"("p_site" "text", "p_mois" "date" DEFAULT ("date_trunc"('month'::"text", (CURRENT_DATE)::timestamp with time zone))::"date") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_debut date := date_trunc('month', p_mois)::date;
  v_fin date := (date_trunc('month', p_mois) + interval '1 month')::date; -- borne exclusive
  v_ecart_net numeric;
  v_ecart_absolu numeric;
  v_nb_audits integer;
  v_nb_anomalies integer;
  v_id uuid;
begin
  select
    coalesce(sum(ecart_total), 0),
    coalesce(sum(abs(ecart_total)), 0),
    count(*),
    count(*) filter (where statut in ('anomalie', 'critique'))
  into v_ecart_net, v_ecart_absolu, v_nb_audits, v_nb_anomalies
  from audits_caisse
  where site = p_site
    and date >= v_debut
    and date < v_fin;

  insert into caisse_sante_historique (site, mois, ecart_net_cumule, ecart_absolu_cumule, nb_audits, nb_anomalies, calcule_le)
  values (p_site, v_debut, v_ecart_net, v_ecart_absolu, v_nb_audits, v_nb_anomalies, now())
  on conflict (site, mois) do update set
    ecart_net_cumule = excluded.ecart_net_cumule,
    ecart_absolu_cumule = excluded.ecart_absolu_cumule,
    nb_audits = excluded.nb_audits,
    nb_anomalies = excluded.nb_anomalies,
    calcule_le = now()
  returning id into v_id;

  return v_id;
end;
$$;




ALTER FUNCTION "public"."calculer_caisse_sante"("p_site" "text", "p_mois" "date") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."calculer_horaires_quart"("p_site" "text", "p_quart" "text", "p_date" "date") RETURNS TABLE("heure_debut" time without time zone, "heure_fin" time without time zone, "duree_heures" numeric)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_horaires jsonb;
  v_dow int := extract(dow from p_date); -- 0 = dimanche ... 6 = samedi
  v_debut time;
  v_fin time;
  v_pause_debut time;
  v_pause_fin time;
begin
  select sc.horaires into v_horaires from station_config sc where sc.site = p_site;
  if v_horaires is null then
    return;
  end if;

  if p_quart in ('quart1', 'quart2') then
    if v_dow between 0 and 3 then -- dimanche à mercredi -> "normal"
      v_debut := (v_horaires -> p_quart ->> 'normal')::time;
      v_fin := coalesce((v_horaires -> p_quart ->> 'fin_normal')::time, v_debut + interval '7 hours');
    else -- jeudi à samedi -> "etendu"
      v_debut := (v_horaires -> p_quart ->> 'etendu')::time;
      v_fin := coalesce((v_horaires -> p_quart ->> 'fin_etendu')::time, v_debut + interval '8 hours');
    end if;
    return query select v_debut, v_fin, (extract(epoch from (v_fin - v_debut)) / 3600.0)::numeric;

  elsif p_quart = 'renfort' then
    v_debut := (v_horaires -> 'renfort' ->> 'debut')::time;
    v_fin := (v_horaires -> 'renfort' ->> 'fin')::time;
    v_pause_debut := (v_horaires -> 'renfort' ->> 'pause_debut')::time;
    v_pause_fin := (v_horaires -> 'renfort' ->> 'pause_fin')::time;
    return query select v_debut, v_fin,
      (extract(epoch from ((v_fin - v_debut) - (v_pause_fin - v_pause_debut))) / 3600.0)::numeric;
  end if;

  return;
end;
$$;




ALTER FUNCTION "public"."calculer_horaires_quart"("p_site" "text", "p_quart" "text", "p_date" "date") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."current_employee_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select role from employees where id = auth.uid();
$$;




ALTER FUNCTION "public"."current_employee_role"() OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."current_employee_site_id"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select site_id from employees where id = auth.uid();
$$;




ALTER FUNCTION "public"."current_employee_site_id"() OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."generer_message_caisse_ecart_non_justifie"("p_site" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule_id uuid;
  v_body_template text;
  v_cooldown_hours integer;
  v_count integer;
  v_fingerprint text;
  v_existing_id uuid;
  v_existing_count integer;
  v_message_id uuid;
  v_body text;
  r record;
begin
  select id, cooldown_hours into v_rule_id, v_cooldown_hours
  from advisor_rules where code = 'CAISSE_ECART_NON_JUSTIFIE';

  select body_template into v_body_template
  from nexus_language_templates where code = 'CAISSE_ECART_NON_JUSTIFIE';

  select count(*) into v_count from v_caisse_ecart_non_justifie where site = p_site;

  if v_count = 0 then
    return null;
  end if;

  v_fingerprint := 'caisse_ecart_non_justifie:' || p_site;

  select id into v_existing_id
  from advisor_messages
  where fingerprint = v_fingerprint
    and status not in ('resolu', 'expire')
    and generated_at >= now() - make_interval(hours => v_cooldown_hours)
  order by generated_at desc
  limit 1;

  if v_existing_id is not null then
    select count(*) into v_existing_count
    from advisor_message_evidence where advisor_message_id = v_existing_id;

    if v_count <= v_existing_count then
      return v_existing_id;
    end if;

    update advisor_messages set status = 'expire' where id = v_existing_id;
  end if;

  v_body := replace(replace(v_body_template, '{{count}}', v_count::text), '{{period}}', '14');

  insert into advisor_messages (
    site_id, message_type, subject_type, subject_id, rule_id,
    priority, confidence_level, message_text, fingerprint, status
  ) values (
    p_site, 'alerte', 'caisse', null, v_rule_id,
    'a_surveiller', 'A', v_body, v_fingerprint, 'nouveau'
  )
  returning id into v_message_id;

  for r in select * from v_caisse_ecart_non_justifie where site = p_site loop
    insert into advisor_message_evidence (
      advisor_message_id, source_type, source_id, metric_code,
      observed_value, period_end
    ) values (
      v_message_id, 'audits_caisse', r.audit_id::text, 'ecart_total',
      r.ecart_total, r.date
    );
  end loop;

  return v_message_id;
end;
$$;




ALTER FUNCTION "public"."generer_message_caisse_ecart_non_justifie"("p_site" "text") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."generer_message_caisse_ecart_recurrent"("p_site" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule_id uuid;
  v_body_template text;
  v_cooldown_hours integer;
  v_row record;
  v_fingerprint text;
  v_existing_id uuid;
  v_message_id uuid;
  v_body text;
begin
  select id, cooldown_hours into v_rule_id, v_cooldown_hours
  from advisor_rules where code = 'CAISSE_ECART_RECURRENT';

  select body_template into v_body_template
  from nexus_language_templates where code = 'CAISSE_ECART_RECURRENT';

  select * into v_row from v_caisse_ecart_recurrent where site = p_site;

  if v_row is null then
    return null;
  end if;

  v_fingerprint := 'caisse_ecart_recurrent:' || p_site;

  select id into v_existing_id
  from advisor_messages
  where fingerprint = v_fingerprint
    and status not in ('resolu', 'expire')
    and generated_at >= now() - make_interval(hours => v_cooldown_hours);

  if v_existing_id is not null then
    return v_existing_id; -- pas d'escalade fine ici, cf. limite documentee en bas de fichier
  end if;

  v_body := replace(replace(v_body_template, '{{count}}', v_row.nb_anomalies::text), '{{period}}', '14');

  insert into advisor_messages (
    site_id, message_type, subject_type, subject_id, rule_id,
    priority, confidence_level, message_text, fingerprint, status
  ) values (
    p_site, 'alerte', 'caisse', null, v_rule_id,
    v_row.priorite_calculee, v_row.confiance_calculee, v_body, v_fingerprint, 'nouveau'
  )
  returning id into v_message_id;

  insert into advisor_message_evidence (
    advisor_message_id, source_type, metric_code, observed_value, period_end
  ) values (
    v_message_id, 'audits_caisse', 'nb_anomalies_14j', v_row.nb_anomalies, current_date
  );

  return v_message_id;
end;
$$;




ALTER FUNCTION "public"."generer_message_caisse_ecart_recurrent"("p_site" "text") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."generer_message_controle_tenue_absent"("p_site" "text") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_rule_id uuid;
  v_body_template text;
  v_cooldown_hours integer;
  v_count integer;
  v_fingerprint text;
  v_existing_id uuid;
  v_ids_actuels uuid[];
  v_ids_existants uuid[];
  v_message_id uuid;
  v_body text;
  r record;
begin
  select id, cooldown_hours into v_rule_id, v_cooldown_hours
  from advisor_rules where code = 'QUALITE_CONTROLE_TENUE_ABSENT';

  select body_template into v_body_template
  from nexus_language_templates where code = 'QUALITE_CONTROLE_TENUE_ABSENT';

  select count(*), array_agg(employee_id order by employee_id)
    into v_count, v_ids_actuels
  from v_qualite_controle_absent where site = p_site;

  if v_count = 0 then
    return null; -- rien a signaler, tout le monde a ete controle recemment
  end if;

  v_fingerprint := 'qualite_controle_tenue_absent:' || p_site;

  select id into v_existing_id
  from advisor_messages
  where fingerprint = v_fingerprint
    and status not in ('resolu', 'expire')
    and generated_at >= now() - make_interval(hours => v_cooldown_hours)
  order by generated_at desc
  limit 1;

  if v_existing_id is not null then
    select array_agg(source_id::uuid order by source_id) into v_ids_existants
    from advisor_message_evidence
    where advisor_message_id = v_existing_id and source_type = 'controles_tenue';

    if v_ids_actuels = v_ids_existants then
      return v_existing_id; -- exactement les memes personnes qu'au dernier message actif
    end if;

    -- la composition a change (quelqu'un controle aujourd'hui, ou
    -- quelqu'un de nouveau concerne) : le message precedent est
    -- perime par un message a jour, dans les deux sens.
    update advisor_messages set status = 'expire' where id = v_existing_id;
  end if;

  v_body := replace(
    replace(v_body_template, '{{employee_name}}', 'l''équipe (' || v_count || ' personne' || (case when v_count > 1 then 's' else '' end) || ')'),
    '{{count}}', v_count::text
  );

  insert into advisor_messages (
    site_id, message_type, subject_type, subject_id, rule_id,
    priority, confidence_level, message_text, fingerprint, status
  ) values (
    p_site, 'organisation', 'equipe', null, v_rule_id,
    'a_surveiller', 'A', v_body, v_fingerprint, 'nouveau'
  )
  returning id into v_message_id;

  for r in select * from v_qualite_controle_absent where site = p_site loop
    insert into advisor_message_evidence (
      advisor_message_id, source_type, source_id, metric_code,
      observed_value, threshold_value, period_end
    ) values (
      v_message_id, 'controles_tenue', r.employee_id::text, 'jours_sans_controle',
      coalesce(r.jours_sans_controle, 9999), 21, current_date
    );
  end loop;

  return v_message_id;
end;
$$;




ALTER FUNCTION "public"."generer_message_controle_tenue_absent"("p_site" "text") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."heures_ouverture_publique"("p_site" "text", "p_date" "date") RETURNS TABLE("quart" "text", "ouverture" time without time zone, "fermeture" time without time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_horaires jsonb;
  v_habillage int;
begin
  select sc.horaires into v_horaires from station_config sc where sc.site = p_site;
  if v_horaires is null then
    return;
  end if;
  v_habillage := coalesce((v_horaires ->> 'temps_habillage_min')::int, 0);

  return query
    select h.quart_calc, (h.heure_debut + make_interval(mins => v_habillage))::time, (h.heure_fin - make_interval(mins => v_habillage))::time
    from (
      select 'quart1' as quart_calc, * from calculer_horaires_quart(p_site, 'quart1', p_date)
      union all
      select 'quart2' as quart_calc, * from calculer_horaires_quart(p_site, 'quart2', p_date)
    ) h;
end;
$$;




ALTER FUNCTION "public"."heures_ouverture_publique"("p_site" "text", "p_date" "date") OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."je_suis_createur"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce((select est_createur from employees where id = auth.uid()), false);
$$;




ALTER FUNCTION "public"."je_suis_createur"() OWNER TO "postgres";





CREATE OR REPLACE FUNCTION "public"."stats_fondateur"() RETURNS TABLE("site_id" "text", "nom_entreprise" "text", "missions_assignees" bigint, "missions_terminees" bigint, "decisions_30j" bigint)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not je_suis_createur() then
    raise exception 'Non autorisé';
  end if;

  return query
  select
    s.site_id,
    s.nom_entreprise,
    coalesce(ma.total, 0) as missions_assignees,
    coalesce(mc.total, 0) as missions_terminees,
    coalesce(jd.total, 0) as decisions_30j
  from sites s
  left join (select mission_assignments.site_id, count(*) as total from mission_assignments group by mission_assignments.site_id) ma
    on ma.site_id = s.site_id
  left join (select mission_completions.site_id, count(*) as total from mission_completions group by mission_completions.site_id) mc
    on mc.site_id = s.site_id
  left join (select journal_decisions.site, count(*) as total from journal_decisions
             where journal_decisions.created_at >= now() - interval '30 days'
             group by journal_decisions.site) jd
    on jd.site = s.site_id
  order by s.nom_entreprise;
end;
$$;




ALTER FUNCTION "public"."stats_fondateur"() OWNER TO "postgres";




CREATE OR REPLACE FUNCTION "public"."verifier_depassements_heures"("p_site" "text", "p_mois" "date") RETURNS TABLE("employee_id" "uuid", "nom" "text", "semaine_debut" "date", "heures_planifiees" numeric, "heures_contrat" numeric, "depassement" numeric)
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
  select ps.employee_id, e.nom, date_trunc('week', ps.date)::date as semaine_debut,
         sum(ps.duree_heures) as heures_planifiees, ec.heures_contrat_semaine,
         sum(ps.duree_heures) - ec.heures_contrat_semaine as depassement
  from planning_shifts ps
  join employees e on e.id = ps.employee_id
  join employee_contraintes ec on ec.employee_id = ps.employee_id
  where ps.site_id = p_site
    and ps.date >= date_trunc('month', p_mois)::date
    and ps.date < (date_trunc('month', p_mois) + interval '1 month')::date
    and ps.duree_heures is not null
    and ec.heures_contrat_semaine is not null
  group by ps.employee_id, e.nom, date_trunc('week', ps.date)::date, ec.heures_contrat_semaine
  having sum(ps.duree_heures) > ec.heures_contrat_semaine
  order by semaine_debut, e.nom;
$$;




ALTER FUNCTION "public"."verifier_depassements_heures"("p_site" "text", "p_mois" "date") OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."advisor_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "text" NOT NULL,
    "advisor_message_id" "uuid" NOT NULL,
    "manager_id" "uuid" NOT NULL,
    "feedback_type" "text" NOT NULL,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "advisor_feedback_feedback_type_check" CHECK (("feedback_type" = ANY (ARRAY['pertinent'::"text", 'non_pertinent'::"text", 'deja_traite'::"text", 'faux_signal'::"text", 'a_surveiller'::"text", 'priorite_surestimee'::"text", 'priorite_sous_estimee'::"text"])))
);




ALTER TABLE "public"."advisor_feedback" OWNER TO "postgres";





CREATE TABLE IF NOT EXISTS "public"."advisor_message_evidence" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advisor_message_id" "uuid" NOT NULL,
    "source_type" "text" NOT NULL,
    "source_id" "text",
    "metric_code" "text" NOT NULL,
    "observed_value" numeric,
    "threshold_value" numeric,
    "comparison_value" numeric,
    "period_start" "date",
    "period_end" "date"
);




ALTER TABLE "public"."advisor_message_evidence" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."advisor_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "text" NOT NULL,
    "message_type" "text",
    "subject_type" "text",
    "subject_id" "text",
    "rule_id" "uuid",
    "priority" "text",
    "confidence_level" "text",
    "message_text" "text" NOT NULL,
    "fingerprint" "text" NOT NULL,
    "generated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "displayed_at" timestamp with time zone,
    "acknowledged_at" timestamp with time zone,
    "converted_to_action_at" timestamp with time zone,
    "resolved_at" timestamp with time zone,
    "status" "text" DEFAULT 'nouveau'::"text" NOT NULL,
    CONSTRAINT "advisor_messages_confidence_level_check" CHECK (("confidence_level" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"]))),
    CONSTRAINT "advisor_messages_priority_check" CHECK (("priority" = ANY (ARRAY['critique'::"text", 'haute'::"text", 'a_surveiller'::"text", 'normale'::"text", 'information'::"text"]))),
    CONSTRAINT "advisor_messages_status_check" CHECK (("status" = ANY (ARRAY['nouveau'::"text", 'affiche'::"text", 'acquitte'::"text", 'converti_action'::"text", 'resolu'::"text", 'expire'::"text"])))
);




ALTER TABLE "public"."advisor_messages" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."advisor_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "description" "text",
    "data_requirements" "text",
    "trigger_expression" "text",
    "severity_expression" "text",
    "confidence_expression" "text",
    "default_priority" "text" DEFAULT 'normale'::"text" NOT NULL,
    "message_template_id" "uuid",
    "cooldown_hours" integer DEFAULT 72 NOT NULL,
    "escalation_delay_hours" integer,
    "action_type" "text",
    "enabled" boolean DEFAULT true NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "site_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "advisor_rules_default_priority_check" CHECK (("default_priority" = ANY (ARRAY['critique'::"text", 'haute'::"text", 'a_surveiller'::"text", 'normale'::"text", 'information'::"text"]))),
    CONSTRAINT "advisor_rules_domain_check" CHECK (("domain" = ANY (ARRAY['commerce'::"text", 'qualite'::"text", 'securite'::"text", 'caisse'::"text", 'stock'::"text", 'equipe'::"text", 'meta'::"text"])))
);




ALTER TABLE "public"."advisor_rules" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."audits_caisse" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "quart" "text" DEFAULT '1'::"text" NOT NULL,
    "vente_piste" numeric DEFAULT 0,
    "vente_boutique" numeric DEFAULT 0,
    "piste_regle_a_la_caisse" numeric DEFAULT 0,
    "drop_piste_billets" numeric DEFAULT 0,
    "drop_piste_pieces" numeric DEFAULT 0,
    "drop_piste_chq" numeric DEFAULT 0,
    "drop_piste_cb" numeric DEFAULT 0,
    "drop_piste_vitocarte" numeric DEFAULT 0,
    "clients_compte_piste" numeric DEFAULT 0,
    "depense_ponctuelle_piste" numeric DEFAULT 0,
    "drop_boutique_billets" numeric DEFAULT 0,
    "drop_boutique_pieces" numeric DEFAULT 0,
    "drop_boutique_chq" numeric DEFAULT 0,
    "drop_boutique_cb" numeric DEFAULT 0,
    "clients_compte_boutique" numeric DEFAULT 0,
    "depense_ponctuelle_boutique" numeric DEFAULT 0,
    "remise_cuve" numeric DEFAULT 0,
    "caisse_incidents" numeric DEFAULT 0,
    "ecart_piste" numeric,
    "ecart_boutique" numeric,
    "ecart_total" numeric,
    "statut" "text",
    "commentaire" "text",
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "remise_cuve_detail" "jsonb",
    "employes_piste" "jsonb",
    "employes_boutique" "jsonb",
    "reglement_compte_anterieur_boutique" numeric DEFAULT 0 NOT NULL,
    "paiement_vacataire_piste" numeric DEFAULT 0 NOT NULL,
    "paiement_vacataire_boutique" numeric DEFAULT 0 NOT NULL,
    CONSTRAINT "audits_caisse_statut_check" CHECK (("statut" = ANY (ARRAY['conforme'::"text", 'surveiller'::"text", 'anomalie'::"text", 'critique'::"text"])))
);




ALTER TABLE "public"."audits_caisse" OWNER TO "postgres";




COMMENT ON COLUMN "public"."audits_caisse"."reglement_compte_anterieur_boutique" IS 'Argent recu ce quart pour solder une facture client boutique d''un mois anterieur (ex: facture de juillet reglee en aout). A distinguer de clients_compte_boutique, qui concerne une vente a credit du jour meme (deja incluse dans vente_boutique par Decenium). Ce nouveau montant, lui, n''apparait PAS dans vente_boutique puisque la vente correspondante a deja ete comptabilisee un mois precedent - il doit donc etre ajoute au theorique attendu en caisse boutique pour ne pas creer un faux ecart positif.';





COMMENT ON COLUMN "public"."audits_caisse"."paiement_vacataire_piste" IS 'Paiement en especes (vacataire ou heures supplementaires) sorti de la caisse piste. Remplace l''usage de caisse_incidents (champ desormais legacy/inactif dans Nexus Verify), qui n''entrait dans aucun calcul.';





COMMENT ON COLUMN "public"."audits_caisse"."paiement_vacataire_boutique" IS 'Paiement en especes (vacataire ou heures supplementaires) sorti de la caisse boutique. Remplace l''usage de caisse_incidents (champ desormais legacy/inactif dans Nexus Verify), qui n''entrait dans aucun calcul.';





CREATE TABLE IF NOT EXISTS "public"."caisse_sante_historique" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "mois" "date" NOT NULL,
    "calcule_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ecart_net_cumule" numeric DEFAULT 0 NOT NULL,
    "ecart_absolu_cumule" numeric DEFAULT 0 NOT NULL,
    "nb_audits" integer DEFAULT 0 NOT NULL,
    "nb_anomalies" integer DEFAULT 0 NOT NULL
);




ALTER TABLE "public"."caisse_sante_historique" OWNER TO "postgres";





CREATE TABLE IF NOT EXISTS "public"."controles_stock" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "article" "text" NOT NULL,
    "quantite_theorique" numeric NOT NULL,
    "quantite_comptee" numeric NOT NULL,
    "ecart" numeric NOT NULL,
    "controle_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "controle_par" "uuid"
);




ALTER TABLE "public"."controles_stock" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."controles_tenue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "controleur_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "conforme" boolean NOT NULL,
    "items" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "points" numeric,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."controles_tenue" OWNER TO "postgres";





CREATE TABLE IF NOT EXISTS "public"."employee_contraintes" (
    "employee_id" "uuid" NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "heures_contrat_semaine" numeric,
    "jours_repos_habituels" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "peut_faire_renfort" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "sexe" "text",
    "ne_fait_pas_caisse" boolean DEFAULT false NOT NULL,
    "integre_au_planning" boolean DEFAULT false NOT NULL,
    CONSTRAINT "employee_contraintes_sexe_check" CHECK (("sexe" = ANY (ARRAY['F'::"text", 'M'::"text"])))
);




ALTER TABLE "public"."employee_contraintes" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."employee_indisponibilites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "date_debut" "date" NOT NULL,
    "date_fin" "date" NOT NULL,
    "type" "text" NOT NULL,
    "commentaire" "text",
    "cree_par" "uuid",
    "cree_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "employee_indisponibilites_dates_coherentes" CHECK (("date_fin" >= "date_debut")),
    CONSTRAINT "employee_indisponibilites_type_check" CHECK (("type" = ANY (ARRAY['conge'::"text", 'indisponible'::"text"])))
);




ALTER TABLE "public"."employee_indisponibilites" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."employees" (
    "id" "uuid" NOT NULL,
    "username" "text" NOT NULL,
    "nom" "text" NOT NULL,
    "role" "text" NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "est_createur" boolean DEFAULT false NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "compte_test" boolean DEFAULT false NOT NULL,
    CONSTRAINT "employees_role_check" CHECK (("role" = ANY (ARRAY['caissier'::"text", 'pompiste'::"text", 'renfort'::"text", 'manager'::"text", 'gerant'::"text", 'vacataire'::"text"])))
);




ALTER TABLE "public"."employees" OWNER TO "postgres";




CREATE OR REPLACE VIEW "public"."employees_public" AS
 SELECT "id",
    "username",
    "nom"
   FROM "public"."employees"
  WHERE (("actif" = true) OR ("compte_test" = true));




ALTER VIEW "public"."employees_public" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."evaluations_employes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "evaluateur_id" "uuid",
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "type" "text" NOT NULL,
    "criteres" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "total" numeric,
    "prime_pct" numeric,
    "autocritique_forts" "text",
    "autocritique_ameliorer" "text",
    "commentaires" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "evaluations_employes_type_check" CHECK (("type" = ANY (ARRAY['standard'::"text", 'renfort'::"text"])))
);




ALTER TABLE "public"."evaluations_employes" OWNER TO "postgres";





CREATE TABLE IF NOT EXISTS "public"."journal_decisions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "candidate_id" "text" NOT NULL,
    "rule_id" "text",
    "etat" "text",
    "recommandation" "text",
    "impact_eur" numeric DEFAULT 0,
    "article" "text",
    "categorie" "text",
    "date" "text" NOT NULL,
    "heure" "text",
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ca_reference" numeric,
    "periode_reference_debut" "date",
    "periode_reference_fin" "date"
);




ALTER TABLE "public"."journal_decisions" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."marge_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "article" "text" NOT NULL,
    "categorie" "text",
    "raison" "text",
    "ajoute_par" "uuid",
    "ajoute_le" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."marge_exceptions" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."mission_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "mission_id" "text" NOT NULL,
    "assigned_to_employee_id" "uuid",
    "assigned_to_role" "text",
    "assigned_by_employee_id" "uuid",
    "due_at" timestamp with time zone,
    "photo_required_override" boolean,
    "note" "text",
    "status" "text" DEFAULT 'assignee'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    CONSTRAINT "mission_assignments_status_check" CHECK (("status" = ANY (ARRAY['assignee'::"text", 'en_cours'::"text", 'faite'::"text", 'validee'::"text", 'refusee'::"text"])))
);




ALTER TABLE "public"."mission_assignments" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."mission_catalog" (
    "mission_id" "text" NOT NULL,
    "titre" "text" NOT NULL,
    "pourquoi" "text",
    "famille" "text",
    "role_required" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "time_window" "text",
    "priority" "text" DEFAULT 'normale'::"text" NOT NULL,
    "estimated_duration_min" integer DEFAULT 5 NOT NULL,
    "proof_required" boolean DEFAULT false NOT NULL,
    "validation_type" "text" DEFAULT 'checklist'::"text" NOT NULL,
    "points" integer DEFAULT 5 NOT NULL,
    "checklist" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impact_attendu_eur" numeric,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "necessite_produit" boolean DEFAULT false NOT NULL,
    "ponctuelle" boolean DEFAULT false NOT NULL,
    "photo_par_action" boolean DEFAULT false NOT NULL,
    CONSTRAINT "mission_catalog_priority_check" CHECK (("priority" = ANY (ARRAY['critique'::"text", 'haute'::"text", 'normale'::"text", 'basse'::"text"]))),
    CONSTRAINT "mission_catalog_validation_type_check" CHECK (("validation_type" = ANY (ARRAY['checklist'::"text", 'photo'::"text", 'signature'::"text", 'manager'::"text"])))
);




ALTER TABLE "public"."mission_catalog" OWNER TO "postgres";




COMMENT ON COLUMN "public"."mission_catalog"."ponctuelle" IS 'true = mission ponctuelle créée automatiquement (ex. NEXUS Marge+), assignée via mission_assignments à un employé précis — ne doit jamais apparaître dans le catalogue récurrent affiché à tout un rôle.';





CREATE TABLE IF NOT EXISTS "public"."mission_completions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "mission_id" "text" NOT NULL,
    "titre" "text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "heure" time without time zone DEFAULT CURRENT_TIME NOT NULL,
    "photo_fournie" boolean DEFAULT false NOT NULL,
    "points" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photo_url" "text",
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "employes_presents" "jsonb",
    "article_cible" "text",
    "categorie_cible" "text",
    "points_ajustement" integer DEFAULT 0 NOT NULL,
    "ajustement_raison" "text",
    "ajuste_par" "uuid",
    "ajuste_le" timestamp with time zone
);




ALTER TABLE "public"."mission_completions" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."mission_progress" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "mission_id" "text" NOT NULL,
    "checklist_index" integer NOT NULL,
    "checked" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "photo_url" "text"
);




ALTER TABLE "public"."mission_progress" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."nexus_language_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "domain" "text" NOT NULL,
    "message_type" "text" NOT NULL,
    "tone" "text" DEFAULT 'calme_precis'::"text",
    "minimum_confidence" "text",
    "title_template" "text",
    "body_template" "text" NOT NULL,
    "action_label_template" "text",
    "variables_schema" "jsonb",
    "enabled" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "nexus_language_templates_domain_check" CHECK (("domain" = ANY (ARRAY['commerce'::"text", 'qualite'::"text", 'securite'::"text", 'caisse'::"text", 'stock'::"text", 'equipe'::"text", 'meta'::"text"]))),
    CONSTRAINT "nexus_language_templates_message_type_check" CHECK (("message_type" = ANY (ARRAY['alerte'::"text", 'recommandation'::"text", 'prudence'::"text", 'urgence'::"text", 'encouragement'::"text", 'management'::"text", 'commerce'::"text", 'securite'::"text", 'organisation'::"text", 'suivi'::"text"]))),
    CONSTRAINT "nexus_language_templates_minimum_confidence_check" CHECK (("minimum_confidence" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text"])))
);




ALTER TABLE "public"."nexus_language_templates" OWNER TO "postgres";





CREATE TABLE IF NOT EXISTS "public"."planning_generations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "text" NOT NULL,
    "mois" "date" NOT NULL,
    "genere_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "genere_par" "uuid",
    "debut_reel" "date" NOT NULL,
    "fin_reel" "date" NOT NULL,
    "nb_lignes" integer DEFAULT 0 NOT NULL,
    "nb_trous" integer DEFAULT 0 NOT NULL
);




ALTER TABLE "public"."planning_generations" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."planning_regles_effectif" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "quart" "text" NOT NULL,
    "jours_semaine" "text"[] DEFAULT '{lundi,mardi,mercredi,jeudi,vendredi,samedi,dimanche}'::"text"[] NOT NULL,
    "effectif_min" integer DEFAULT 1 NOT NULL,
    "roles_requis" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "commentaire" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "planning_regles_effectif_quart_check" CHECK (("quart" = ANY (ARRAY['quart1'::"text", 'quart2'::"text", 'renfort'::"text"])))
);




ALTER TABLE "public"."planning_regles_effectif" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."planning_shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "quart" "text" NOT NULL,
    "statut" "text" NOT NULL,
    "duree_heures" numeric,
    "role_planifie" "text",
    "site_transfert" "text",
    "genere_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "genere_par" "uuid",
    "publie" boolean DEFAULT false NOT NULL,
    "modifie_le" timestamp with time zone,
    "modifie_par" "uuid",
    "heure_debut" time without time zone,
    "heure_fin" time without time zone,
    "tache" "text",
    CONSTRAINT "planning_shifts_quart_check" CHECK (("quart" = ANY (ARRAY['quart1'::"text", 'quart2'::"text", 'renfort'::"text"]))),
    CONSTRAINT "planning_shifts_statut_check" CHECK (("statut" = ANY (ARRAY['travail_normal'::"text", 'manager'::"text", 'renfort'::"text", 'repos'::"text", 'conge'::"text", 'transfert_site'::"text"]))),
    CONSTRAINT "planning_shifts_tache_check" CHECK ((("tache" IS NULL) OR ("tache" = ANY (ARRAY['piste'::"text", 'caisse'::"text"]))))
);




ALTER TABLE "public"."planning_shifts" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."pointages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "type" "text" NOT NULL,
    "heure" time without time zone NOT NULL,
    "quart" "text" NOT NULL,
    "retard_min" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "photo_url" "text",
    "heure_debut_quart" timestamp with time zone,
    "anomalie_signalee" "text",
    "anomalie_signalee_le" timestamp with time zone,
    CONSTRAINT "pointages_type_check" CHECK (("type" = ANY (ARRAY['arrivee'::"text", 'pause_debut'::"text", 'pause_fin'::"text", 'depart'::"text"])))
);




ALTER TABLE "public"."pointages" OWNER TO "postgres";




COMMENT ON COLUMN "public"."pointages"."photo_url" IS 'Photo prise au moment du pointage (arrivée/départ) — valide l''action. Stockée dans le bucket privé preuves-missions, sous le dossier de l''employé.';





COMMENT ON COLUMN "public"."pointages"."heure_debut_quart" IS 'Heure de début du quart actif au moment du pointage (copiée depuis shifts.heure_debut) — permet d''expliquer un retard sans avoir à recalculer plus tard.';





COMMENT ON COLUMN "public"."pointages"."anomalie_signalee" IS 'Texte libre saisi par l''employé pour signaler un désaccord ou une explication sur ce pointage (ex: retard constaté à tort).';





CREATE TABLE IF NOT EXISTS "public"."product_locations" (
    "site" "text" NOT NULL,
    "categorie" "text" NOT NULL,
    "article" "text" NOT NULL,
    "emplacement" "text" NOT NULL,
    "assigne_par" "uuid",
    "assigne_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source" "text" DEFAULT 'manuel'::"text" NOT NULL,
    CONSTRAINT "product_locations_source_check" CHECK (("source" = ANY (ARRAY['manuel'::"text", 'auto_categorie'::"text"])))
);




ALTER TABLE "public"."product_locations" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."product_photos" (
    "site" "text" NOT NULL,
    "categorie" "text" NOT NULL,
    "article" "text" NOT NULL,
    "photo_url" "text" NOT NULL,
    "source" "text" DEFAULT 'openfoodfacts'::"text" NOT NULL,
    "code_barre" "text",
    "nom_off" "text",
    "verifie_par" "uuid",
    "verifie_le" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."product_photos" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "periode_debut" "date" NOT NULL,
    "periode_fin" "date" NOT NULL,
    "categorie" "text" NOT NULL,
    "article" "text" NOT NULL,
    "code_barres" "text",
    "quantite" numeric,
    "prix_achat" numeric,
    "prix_vente" numeric,
    "tva" numeric,
    "ca" numeric DEFAULT 0 NOT NULL,
    "marge" numeric DEFAULT 0 NOT NULL,
    "imported_by" "uuid",
    "imported_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."products" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."produits_appel" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "article" "text" NOT NULL,
    "ajoute_par" "uuid",
    "ajoute_le" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."produits_appel" OWNER TO "postgres";





CREATE TABLE IF NOT EXISTS "public"."recommandations_validees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" NOT NULL,
    "candidate_id" "text" NOT NULL,
    "employee_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."recommandations_validees" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."role_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "shift_id" "uuid" NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "ancien_role" "text" NOT NULL,
    "nouveau_role" "text" NOT NULL,
    "heure_changement" timestamp with time zone DEFAULT "now"() NOT NULL,
    "missions_transferees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "missions_conservees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "missions_activees" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL
);




ALTER TABLE "public"."role_changes" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."shifts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "employee_id" "uuid" NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "role_prevu" "text",
    "role" "text" NOT NULL,
    "confirmed_by" "text" DEFAULT 'employe'::"text" NOT NULL,
    "quart" "text",
    "heure_debut" timestamp with time zone DEFAULT "now"() NOT NULL,
    "heure_fin" timestamp with time zone,
    "statut" "text" DEFAULT 'en_cours'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "site_id" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    CONSTRAINT "shifts_confirmed_by_check" CHECK (("confirmed_by" = ANY (ARRAY['employe'::"text", 'manager'::"text", 'auto'::"text"]))),
    CONSTRAINT "shifts_role_check" CHECK (("role" = ANY (ARRAY['pompiste'::"text", 'caissiere'::"text", 'renfort'::"text", 'manager'::"text", 'polyvalent'::"text"]))),
    CONSTRAINT "shifts_statut_check" CHECK (("statut" = ANY (ARRAY['en_cours'::"text", 'termine'::"text"])))
);




ALTER TABLE "public"."shifts" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."sites" (
    "site_id" "text" NOT NULL,
    "nom_entreprise" "text" NOT NULL,
    "logo_url" "text",
    "couleur_accent" "text" DEFAULT '#4FC3D9'::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acces_createur_autorise" boolean DEFAULT false NOT NULL
);




ALTER TABLE "public"."sites" OWNER TO "postgres";








CREATE TABLE IF NOT EXISTS "public"."station_config" (
    "site" "text" NOT NULL,
    "horaires" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "prix_carburants" "jsonb",
    "manager_pointage_requis" boolean DEFAULT false NOT NULL
);




ALTER TABLE "public"."station_config" OWNER TO "postgres";




COMMENT ON COLUMN "public"."station_config"."manager_pointage_requis" IS 'Si true, le manager/gérant de ce site doit pointer comme un employé (Pointage actif dans le menu). Si false (défaut), Pointage reste grisé pour lui — les employés pointent dans tous les cas.';





CREATE TABLE IF NOT EXISTS "public"."stock_releves" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "releve_le" timestamp with time zone NOT NULL,
    "categorie" "text",
    "article" "text" NOT NULL,
    "code_barres" "text",
    "quantite_theorique" numeric NOT NULL,
    "quantite_reelle" numeric,
    "importe_par" "uuid",
    "importe_le" timestamp with time zone DEFAULT "now"() NOT NULL
);




ALTER TABLE "public"."stock_releves" OWNER TO "postgres";




CREATE TABLE IF NOT EXISTS "public"."stock_sante_historique" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "site" "text" DEFAULT 'vito-sainte-marie'::"text" NOT NULL,
    "calcule_le" timestamp with time zone DEFAULT "now"() NOT NULL,
    "indice_confiance" numeric NOT NULL,
    "nb_references_stables" integer DEFAULT 0 NOT NULL,
    "nb_references_a_surveiller" integer DEFAULT 0 NOT NULL,
    "nb_references_a_verifier" integer DEFAULT 0 NOT NULL,
    "nb_references_non_concluantes" integer DEFAULT 0 NOT NULL,
    "risque_estime_eur" numeric DEFAULT 0 NOT NULL
);




ALTER TABLE "public"."stock_sante_historique" OWNER TO "postgres";





CREATE OR REPLACE VIEW "public"."v_caisse_ecart_non_justifie" WITH ("security_invoker"='true') AS
 SELECT "id" AS "audit_id",
    "site",
    "date",
    "quart",
    "ecart_total",
    "statut",
        CASE
            WHEN ("statut" = 'critique'::"text") THEN 'haute'::"text"
            ELSE 'a_surveiller'::"text"
        END AS "priorite_calculee",
    'A'::"text" AS "confiance_calculee"
   FROM "public"."audits_caisse"
  WHERE (("statut" IS NOT NULL) AND ("statut" <> 'conforme'::"text") AND (("commentaire" IS NULL) OR ("btrim"("commentaire") = ''::"text")) AND ("date" >= (CURRENT_DATE - '14 days'::interval)));




ALTER VIEW "public"."v_caisse_ecart_non_justifie" OWNER TO "postgres";




CREATE OR REPLACE VIEW "public"."v_caisse_ecart_recurrent" WITH ("security_invoker"='true') AS
 WITH "fenetre" AS (
         SELECT "audits_caisse"."site",
            "count"(*) FILTER (WHERE ("audits_caisse"."statut" = ANY (ARRAY['anomalie'::"text", 'critique'::"text"]))) AS "nb_anomalies",
            "count"(*) AS "nb_total",
            "max"("audits_caisse"."date") FILTER (WHERE ("audits_caisse"."statut" = ANY (ARRAY['anomalie'::"text", 'critique'::"text"]))) AS "derniere_anomalie",
            "bool_or"(("audits_caisse"."statut" = 'critique'::"text")) AS "a_critique"
           FROM "public"."audits_caisse"
          WHERE ("audits_caisse"."date" >= (CURRENT_DATE - '14 days'::interval))
          GROUP BY "audits_caisse"."site"
        )
 SELECT "site",
    "nb_anomalies",
    "nb_total",
    "derniere_anomalie",
        CASE
            WHEN "a_critique" THEN 'haute'::"text"
            WHEN ("nb_anomalies" >= 3) THEN 'haute'::"text"
            ELSE 'a_surveiller'::"text"
        END AS "priorite_calculee",
        CASE
            WHEN ("nb_total" >= 6) THEN 'A'::"text"
            WHEN ("nb_total" >= 3) THEN 'B'::"text"
            ELSE 'C'::"text"
        END AS "confiance_calculee"
   FROM "fenetre"
  WHERE ("nb_anomalies" >= 2);




ALTER VIEW "public"."v_caisse_ecart_recurrent" OWNER TO "postgres";




CREATE OR REPLACE VIEW "public"."v_qualite_controle_absent" WITH ("security_invoker"='true') AS
 WITH "dernier" AS (
         SELECT "e"."site_id" AS "site",
            "e"."id" AS "employee_id",
            "e"."nom" AS "employee_nom",
            "max"("ct"."date") AS "derniere_date"
           FROM ("public"."employees" "e"
             LEFT JOIN "public"."controles_tenue" "ct" ON (("ct"."employee_id" = "e"."id")))
          WHERE ("e"."actif" = true)
          GROUP BY "e"."site_id", "e"."id", "e"."nom"
        )
 SELECT "site",
    "employee_id",
    "employee_nom",
    "derniere_date",
        CASE
            WHEN ("derniere_date" IS NULL) THEN NULL::integer
            ELSE (CURRENT_DATE - "derniere_date")
        END AS "jours_sans_controle",
        CASE
            WHEN ("derniere_date" IS NULL) THEN 'a_surveiller'::"text"
            WHEN ((CURRENT_DATE - "derniere_date") >= 45) THEN 'haute'::"text"
            ELSE 'a_surveiller'::"text"
        END AS "priorite_calculee",
    'A'::"text" AS "confiance_calculee"
   FROM "dernier"
  WHERE (("derniere_date" IS NULL) OR ((CURRENT_DATE - "derniere_date") >= 21));




ALTER VIEW "public"."v_qualite_controle_absent" OWNER TO "postgres";




CREATE OR REPLACE VIEW "public"."v_qualite_degradation_activite" WITH ("security_invoker"='true') AS
 WITH "periode_recente" AS (
         SELECT "products"."site",
            "sum"("products"."ca") AS "ca_recent"
           FROM "public"."products"
          WHERE ("products"."periode_fin" >= (CURRENT_DATE - '30 days'::interval))
          GROUP BY "products"."site"
        ), "periode_precedente" AS (
         SELECT "products"."site",
            "sum"("products"."ca") AS "ca_precedent"
           FROM "public"."products"
          WHERE (("products"."periode_fin" >= (CURRENT_DATE - '60 days'::interval)) AND ("products"."periode_fin" < (CURRENT_DATE - '30 days'::interval)))
          GROUP BY "products"."site"
        ), "missions_qualite" AS (
         SELECT "e"."site_id" AS "site",
            "count"(*) FILTER (WHERE ("mc"."date" >= (CURRENT_DATE - '30 days'::interval))) AS "faites_recentes",
            "count"(*) FILTER (WHERE (("mc"."date" >= (CURRENT_DATE - '60 days'::interval)) AND ("mc"."date" < (CURRENT_DATE - '30 days'::interval)))) AS "faites_precedentes"
           FROM (("public"."mission_completions" "mc"
             JOIN "public"."mission_catalog" "cat" ON (("cat"."mission_id" = "mc"."mission_id")))
             JOIN "public"."employees" "e" ON (("e"."id" = "mc"."employee_id")))
          WHERE ("cat"."famille" = 'Qualité'::"text")
          GROUP BY "e"."site_id"
        )
 SELECT "pr"."site",
    "pr"."ca_recent",
    "pp"."ca_precedent",
    "round"(((("pr"."ca_recent" - "pp"."ca_precedent") / NULLIF("pp"."ca_precedent", (0)::numeric)) * (100)::numeric), 1) AS "variation_ca_pct",
    "mq"."faites_recentes",
    "mq"."faites_precedentes",
    "round"((((("mq"."faites_recentes" - "mq"."faites_precedentes"))::numeric / (NULLIF("mq"."faites_precedentes", 0))::numeric) * (100)::numeric), 1) AS "variation_missions_pct",
    'information'::"text" AS "priorite_calculee",
    'C'::"text" AS "confiance_calculee"
   FROM (("periode_recente" "pr"
     JOIN "periode_precedente" "pp" ON (("pp"."site" = "pr"."site")))
     JOIN "missions_qualite" "mq" ON (("mq"."site" = "pr"."site")))
  WHERE (("pr"."ca_recent" > "pp"."ca_precedent") AND ("mq"."faites_recentes" < "mq"."faites_precedentes"));




ALTER VIEW "public"."v_qualite_degradation_activite" OWNER TO "postgres";




CREATE OR REPLACE VIEW "public"."v_qualite_mission_sans_preuve" WITH ("security_invoker"='true') AS
 WITH "manquantes" AS (
         SELECT "e"."site_id" AS "site",
            "mc"."employee_id",
            "count"(*) AS "nb_sans_preuve",
            "count"(*) FILTER (WHERE ("cat"."proof_required" = true)) AS "nb_total_preuve_requise"
           FROM (("public"."mission_completions" "mc"
             JOIN "public"."mission_catalog" "cat" ON (("cat"."mission_id" = "mc"."mission_id")))
             JOIN "public"."employees" "e" ON (("e"."id" = "mc"."employee_id")))
          WHERE (("cat"."famille" = 'Qualité'::"text") AND ("cat"."proof_required" = true) AND ("mc"."photo_fournie" = false) AND ("mc"."date" >= (CURRENT_DATE - '30 days'::interval)))
          GROUP BY "e"."site_id", "mc"."employee_id"
        )
 SELECT "site",
    "employee_id",
    "nb_sans_preuve",
        CASE
            WHEN ("nb_sans_preuve" >= 3) THEN 'haute'::"text"
            ELSE 'a_surveiller'::"text"
        END AS "priorite_calculee",
        CASE
            WHEN ("nb_sans_preuve" >= 4) THEN 'A'::"text"
            WHEN ("nb_sans_preuve" >= 2) THEN 'B'::"text"
            ELSE 'C'::"text"
        END AS "confiance_calculee"
   FROM "manquantes"
  WHERE ("nb_sans_preuve" >= 2);




ALTER VIEW "public"."v_qualite_mission_sans_preuve" OWNER TO "postgres";




CREATE OR REPLACE VIEW "public"."v_qualite_tenue_recurrente" WITH ("security_invoker"='true') AS
 WITH "fenetre" AS (
         SELECT "ct"."employee_id",
            "count"(*) FILTER (WHERE ("ct"."conforme" = false)) AS "nb_non_conformes",
            "count"(*) AS "nb_total",
            "max"("ct"."date") FILTER (WHERE ("ct"."conforme" = false)) AS "derniere_non_conformite"
           FROM "public"."controles_tenue" "ct"
          WHERE ("ct"."date" >= (CURRENT_DATE - '30 days'::interval))
          GROUP BY "ct"."employee_id"
        )
 SELECT "e"."site_id" AS "site",
    "f"."employee_id",
    "e"."nom" AS "employee_nom",
    "f"."nb_non_conformes",
    "f"."nb_total",
    "f"."derniere_non_conformite",
        CASE
            WHEN ("f"."nb_non_conformes" >= 3) THEN 'haute'::"text"
            ELSE 'a_surveiller'::"text"
        END AS "priorite_calculee",
        CASE
            WHEN ("f"."nb_total" >= 5) THEN 'A'::"text"
            WHEN ("f"."nb_total" >= 3) THEN 'B'::"text"
            ELSE 'C'::"text"
        END AS "confiance_calculee"
   FROM ("fenetre" "f"
     JOIN "public"."employees" "e" ON (("e"."id" = "f"."employee_id")))
  WHERE ("f"."nb_non_conformes" >= 2);




ALTER VIEW "public"."v_qualite_tenue_recurrente" OWNER TO "postgres";




ALTER TABLE ONLY "public"."advisor_feedback"
    ADD CONSTRAINT "advisor_feedback_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."advisor_message_evidence"
    ADD CONSTRAINT "advisor_message_evidence_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."advisor_messages"
    ADD CONSTRAINT "advisor_messages_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."advisor_rules"
    ADD CONSTRAINT "advisor_rules_code_key" UNIQUE ("code");





ALTER TABLE ONLY "public"."advisor_rules"
    ADD CONSTRAINT "advisor_rules_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."audits_caisse"
    ADD CONSTRAINT "audits_caisse_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."audits_caisse"
    ADD CONSTRAINT "audits_caisse_site_date_quart_key" UNIQUE ("site", "date", "quart");





ALTER TABLE ONLY "public"."caisse_sante_historique"
    ADD CONSTRAINT "caisse_sante_historique_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."caisse_sante_historique"
    ADD CONSTRAINT "caisse_sante_historique_site_mois_key" UNIQUE ("site", "mois");





ALTER TABLE ONLY "public"."controles_stock"
    ADD CONSTRAINT "controles_stock_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."controles_tenue"
    ADD CONSTRAINT "controles_tenue_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."employee_contraintes"
    ADD CONSTRAINT "employee_contraintes_pkey" PRIMARY KEY ("employee_id");





ALTER TABLE ONLY "public"."employee_indisponibilites"
    ADD CONSTRAINT "employee_indisponibilites_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_username_key" UNIQUE ("username");





ALTER TABLE ONLY "public"."evaluations_employes"
    ADD CONSTRAINT "evaluations_employes_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."journal_decisions"
    ADD CONSTRAINT "journal_decisions_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."marge_exceptions"
    ADD CONSTRAINT "marge_exceptions_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."marge_exceptions"
    ADD CONSTRAINT "marge_exceptions_site_article_key" UNIQUE ("site", "article");





ALTER TABLE ONLY "public"."mission_assignments"
    ADD CONSTRAINT "mission_assignments_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."mission_catalog"
    ADD CONSTRAINT "mission_catalog_pkey" PRIMARY KEY ("mission_id");





ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."mission_progress"
    ADD CONSTRAINT "mission_progress_employee_id_mission_id_checklist_index_key" UNIQUE ("employee_id", "mission_id", "checklist_index");





ALTER TABLE ONLY "public"."mission_progress"
    ADD CONSTRAINT "mission_progress_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."nexus_language_templates"
    ADD CONSTRAINT "nexus_language_templates_code_key" UNIQUE ("code");





ALTER TABLE ONLY "public"."nexus_language_templates"
    ADD CONSTRAINT "nexus_language_templates_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."planning_generations"
    ADD CONSTRAINT "planning_generations_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."planning_regles_effectif"
    ADD CONSTRAINT "planning_regles_effectif_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."planning_shifts"
    ADD CONSTRAINT "planning_shifts_employee_id_date_quart_key" UNIQUE ("employee_id", "date", "quart");





ALTER TABLE ONLY "public"."planning_shifts"
    ADD CONSTRAINT "planning_shifts_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."pointages"
    ADD CONSTRAINT "pointages_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."product_locations"
    ADD CONSTRAINT "product_locations_pkey" PRIMARY KEY ("site", "categorie", "article");





ALTER TABLE ONLY "public"."product_photos"
    ADD CONSTRAINT "product_photos_pkey" PRIMARY KEY ("site", "categorie", "article");





ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."produits_appel"
    ADD CONSTRAINT "produits_appel_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."produits_appel"
    ADD CONSTRAINT "produits_appel_site_article_key" UNIQUE ("site", "article");





ALTER TABLE ONLY "public"."recommandations_validees"
    ADD CONSTRAINT "recommandations_validees_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."recommandations_validees"
    ADD CONSTRAINT "recommandations_validees_site_candidate_id_key" UNIQUE ("site", "candidate_id");





ALTER TABLE ONLY "public"."role_changes"
    ADD CONSTRAINT "role_changes_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."sites"
    ADD CONSTRAINT "sites_pkey" PRIMARY KEY ("site_id");





ALTER TABLE ONLY "public"."station_config"
    ADD CONSTRAINT "station_config_pkey" PRIMARY KEY ("site");





ALTER TABLE ONLY "public"."stock_releves"
    ADD CONSTRAINT "stock_releves_pkey" PRIMARY KEY ("id");





ALTER TABLE ONLY "public"."stock_sante_historique"
    ADD CONSTRAINT "stock_sante_historique_pkey" PRIMARY KEY ("id");





CREATE INDEX "idx_advisor_evidence_message" ON "public"."advisor_message_evidence" USING "btree" ("advisor_message_id");





CREATE INDEX "idx_advisor_feedback_advisor_message_id" ON "public"."advisor_feedback" USING "btree" ("advisor_message_id");





CREATE INDEX "idx_advisor_feedback_manager_id" ON "public"."advisor_feedback" USING "btree" ("manager_id");





CREATE INDEX "idx_advisor_feedback_site_id" ON "public"."advisor_feedback" USING "btree" ("site_id");





CREATE INDEX "idx_advisor_messages_fingerprint" ON "public"."advisor_messages" USING "btree" ("site_id", "fingerprint", "generated_at" DESC);





CREATE INDEX "idx_advisor_messages_rule_id" ON "public"."advisor_messages" USING "btree" ("rule_id");





CREATE INDEX "idx_advisor_messages_status" ON "public"."advisor_messages" USING "btree" ("site_id", "status");





CREATE INDEX "idx_advisor_rules_message_template_id" ON "public"."advisor_rules" USING "btree" ("message_template_id");





CREATE INDEX "idx_advisor_rules_site_id" ON "public"."advisor_rules" USING "btree" ("site_id");





CREATE INDEX "idx_audits_caisse_employee_id" ON "public"."audits_caisse" USING "btree" ("employee_id");





CREATE INDEX "idx_audits_caisse_site_date" ON "public"."audits_caisse" USING "btree" ("site", "date" DESC);





CREATE INDEX "idx_controles_stock_article" ON "public"."controles_stock" USING "btree" ("site", "article", "controle_le");





CREATE INDEX "idx_controles_stock_controle_par" ON "public"."controles_stock" USING "btree" ("controle_par");





CREATE INDEX "idx_controles_tenue_controleur_id" ON "public"."controles_tenue" USING "btree" ("controleur_id");





CREATE INDEX "idx_controles_tenue_employee" ON "public"."controles_tenue" USING "btree" ("employee_id", "date" DESC);





CREATE INDEX "idx_employee_contraintes_site_id" ON "public"."employee_contraintes" USING "btree" ("site_id");





CREATE INDEX "idx_employee_indisponibilites_cree_par" ON "public"."employee_indisponibilites" USING "btree" ("cree_par");





CREATE INDEX "idx_employee_indisponibilites_employee_id" ON "public"."employee_indisponibilites" USING "btree" ("employee_id");





CREATE INDEX "idx_employee_indisponibilites_site_id" ON "public"."employee_indisponibilites" USING "btree" ("site_id");





CREATE INDEX "idx_employees_site_id" ON "public"."employees" USING "btree" ("site_id");





CREATE INDEX "idx_evaluations_employes_employee" ON "public"."evaluations_employes" USING "btree" ("employee_id", "date" DESC);





CREATE INDEX "idx_evaluations_employes_evaluateur_id" ON "public"."evaluations_employes" USING "btree" ("evaluateur_id");





CREATE INDEX "idx_journal_decisions_employee_id" ON "public"."journal_decisions" USING "btree" ("employee_id");





CREATE INDEX "idx_journal_decisions_site_candidate" ON "public"."journal_decisions" USING "btree" ("site", "candidate_id");





CREATE INDEX "idx_journal_decisions_site_date" ON "public"."journal_decisions" USING "btree" ("site", "date" DESC);





CREATE INDEX "idx_marge_exceptions_ajoute_par" ON "public"."marge_exceptions" USING "btree" ("ajoute_par");





CREATE INDEX "idx_marge_exceptions_site" ON "public"."marge_exceptions" USING "btree" ("site");





CREATE INDEX "idx_mission_assignments_assigned_by_employee_id" ON "public"."mission_assignments" USING "btree" ("assigned_by_employee_id");





CREATE INDEX "idx_mission_assignments_assigned_to_employee_id" ON "public"."mission_assignments" USING "btree" ("assigned_to_employee_id");





CREATE INDEX "idx_mission_assignments_site_id" ON "public"."mission_assignments" USING "btree" ("site_id");





CREATE INDEX "idx_mission_catalog_site_id" ON "public"."mission_catalog" USING "btree" ("site_id");





CREATE INDEX "idx_mission_completions_ajuste_par" ON "public"."mission_completions" USING "btree" ("ajuste_par");





CREATE INDEX "idx_mission_completions_employee_id" ON "public"."mission_completions" USING "btree" ("employee_id");





CREATE INDEX "idx_mission_completions_site_id" ON "public"."mission_completions" USING "btree" ("site_id");





CREATE INDEX "idx_mission_progress_site_id" ON "public"."mission_progress" USING "btree" ("site_id");





CREATE INDEX "idx_planning_generations_genere_par" ON "public"."planning_generations" USING "btree" ("genere_par");





CREATE INDEX "idx_planning_generations_site_id" ON "public"."planning_generations" USING "btree" ("site_id");





CREATE INDEX "idx_planning_regles_effectif_site_id" ON "public"."planning_regles_effectif" USING "btree" ("site_id");





CREATE INDEX "idx_planning_shifts_genere_par" ON "public"."planning_shifts" USING "btree" ("genere_par");





CREATE INDEX "idx_planning_shifts_modifie_par" ON "public"."planning_shifts" USING "btree" ("modifie_par");





CREATE INDEX "idx_planning_shifts_site_id" ON "public"."planning_shifts" USING "btree" ("site_id");





CREATE INDEX "idx_pointages_employee_date" ON "public"."pointages" USING "btree" ("employee_id", "date");





CREATE INDEX "idx_pointages_site_date" ON "public"."pointages" USING "btree" ("site", "date");





CREATE INDEX "idx_product_locations_assigne_par" ON "public"."product_locations" USING "btree" ("assigne_par");





CREATE INDEX "idx_product_photos_verifie_par" ON "public"."product_photos" USING "btree" ("verifie_par");





CREATE INDEX "idx_products_imported_by" ON "public"."products" USING "btree" ("imported_by");





CREATE INDEX "idx_products_lookup" ON "public"."products" USING "btree" ("site", "categorie", "article", "periode_debut");





CREATE INDEX "idx_produits_appel_ajoute_par" ON "public"."produits_appel" USING "btree" ("ajoute_par");





CREATE INDEX "idx_recommandations_validees_employee_id" ON "public"."recommandations_validees" USING "btree" ("employee_id");





CREATE INDEX "idx_role_changes_employee_id" ON "public"."role_changes" USING "btree" ("employee_id");





CREATE INDEX "idx_role_changes_shift_id" ON "public"."role_changes" USING "btree" ("shift_id");





CREATE INDEX "idx_shifts_employee_id" ON "public"."shifts" USING "btree" ("employee_id");





CREATE INDEX "idx_shifts_site_id" ON "public"."shifts" USING "btree" ("site_id");





CREATE INDEX "idx_stock_releves_importe_par" ON "public"."stock_releves" USING "btree" ("importe_par");





CREATE INDEX "idx_stock_releves_lookup" ON "public"."stock_releves" USING "btree" ("site", "article", "releve_le");





ALTER TABLE ONLY "public"."advisor_feedback"
    ADD CONSTRAINT "advisor_feedback_advisor_message_id_fkey" FOREIGN KEY ("advisor_message_id") REFERENCES "public"."advisor_messages"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."advisor_feedback"
    ADD CONSTRAINT "advisor_feedback_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."advisor_feedback"
    ADD CONSTRAINT "advisor_feedback_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."advisor_message_evidence"
    ADD CONSTRAINT "advisor_message_evidence_advisor_message_id_fkey" FOREIGN KEY ("advisor_message_id") REFERENCES "public"."advisor_messages"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."advisor_messages"
    ADD CONSTRAINT "advisor_messages_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "public"."advisor_rules"("id");





ALTER TABLE ONLY "public"."advisor_messages"
    ADD CONSTRAINT "advisor_messages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."advisor_rules"
    ADD CONSTRAINT "advisor_rules_message_template_fkey" FOREIGN KEY ("message_template_id") REFERENCES "public"."nexus_language_templates"("id");





ALTER TABLE ONLY "public"."advisor_rules"
    ADD CONSTRAINT "advisor_rules_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."audits_caisse"
    ADD CONSTRAINT "audits_caisse_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."controles_stock"
    ADD CONSTRAINT "controles_stock_controle_par_fkey" FOREIGN KEY ("controle_par") REFERENCES "public"."employees"("id") ON DELETE SET NULL;





ALTER TABLE ONLY "public"."controles_tenue"
    ADD CONSTRAINT "controles_tenue_controleur_id_fkey" FOREIGN KEY ("controleur_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."controles_tenue"
    ADD CONSTRAINT "controles_tenue_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."employee_contraintes"
    ADD CONSTRAINT "employee_contraintes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."employee_contraintes"
    ADD CONSTRAINT "employee_contraintes_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."employee_indisponibilites"
    ADD CONSTRAINT "employee_indisponibilites_cree_par_fkey" FOREIGN KEY ("cree_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."employee_indisponibilites"
    ADD CONSTRAINT "employee_indisponibilites_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."employee_indisponibilites"
    ADD CONSTRAINT "employee_indisponibilites_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."employees"
    ADD CONSTRAINT "employees_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."evaluations_employes"
    ADD CONSTRAINT "evaluations_employes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."evaluations_employes"
    ADD CONSTRAINT "evaluations_employes_evaluateur_id_fkey" FOREIGN KEY ("evaluateur_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."journal_decisions"
    ADD CONSTRAINT "journal_decisions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."marge_exceptions"
    ADD CONSTRAINT "marge_exceptions_ajoute_par_fkey" FOREIGN KEY ("ajoute_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."mission_assignments"
    ADD CONSTRAINT "mission_assignments_assigned_by_employee_id_fkey" FOREIGN KEY ("assigned_by_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;





ALTER TABLE ONLY "public"."mission_assignments"
    ADD CONSTRAINT "mission_assignments_assigned_to_employee_id_fkey" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "public"."employees"("id") ON DELETE SET NULL;





ALTER TABLE ONLY "public"."mission_assignments"
    ADD CONSTRAINT "mission_assignments_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."mission_catalog"
    ADD CONSTRAINT "mission_catalog_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_ajuste_par_fkey" FOREIGN KEY ("ajuste_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."mission_completions"
    ADD CONSTRAINT "mission_completions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."mission_progress"
    ADD CONSTRAINT "mission_progress_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."mission_progress"
    ADD CONSTRAINT "mission_progress_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."planning_generations"
    ADD CONSTRAINT "planning_generations_genere_par_fkey" FOREIGN KEY ("genere_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."planning_generations"
    ADD CONSTRAINT "planning_generations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."planning_regles_effectif"
    ADD CONSTRAINT "planning_regles_effectif_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."planning_shifts"
    ADD CONSTRAINT "planning_shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."planning_shifts"
    ADD CONSTRAINT "planning_shifts_genere_par_fkey" FOREIGN KEY ("genere_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."planning_shifts"
    ADD CONSTRAINT "planning_shifts_modifie_par_fkey" FOREIGN KEY ("modifie_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."planning_shifts"
    ADD CONSTRAINT "planning_shifts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."pointages"
    ADD CONSTRAINT "pointages_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."product_locations"
    ADD CONSTRAINT "product_locations_assigne_par_fkey" FOREIGN KEY ("assigne_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."product_photos"
    ADD CONSTRAINT "product_photos_verifie_par_fkey" FOREIGN KEY ("verifie_par") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "public"."employees"("id") ON DELETE SET NULL;





ALTER TABLE ONLY "public"."produits_appel"
    ADD CONSTRAINT "produits_appel_ajoute_par_fkey" FOREIGN KEY ("ajoute_par") REFERENCES "public"."employees"("id") ON DELETE SET NULL;





ALTER TABLE ONLY "public"."recommandations_validees"
    ADD CONSTRAINT "recommandations_validees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id");





ALTER TABLE ONLY "public"."role_changes"
    ADD CONSTRAINT "role_changes_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."role_changes"
    ADD CONSTRAINT "role_changes_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE CASCADE;





ALTER TABLE ONLY "public"."shifts"
    ADD CONSTRAINT "shifts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("site_id");





ALTER TABLE ONLY "public"."stock_releves"
    ADD CONSTRAINT "stock_releves_importe_par_fkey" FOREIGN KEY ("importe_par") REFERENCES "public"."employees"("id") ON DELETE SET NULL;





ALTER TABLE "public"."advisor_feedback" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."advisor_message_evidence" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."advisor_messages" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."advisor_rules" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."audits_caisse" ENABLE ROW LEVEL SECURITY;




CREATE POLICY "authenticated_inserts_controles_stock" ON "public"."controles_stock" FOR INSERT TO "authenticated" WITH CHECK (("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "authenticated_inserts_stock_sante" ON "public"."stock_sante_historique" FOR INSERT TO "authenticated" WITH CHECK (("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





ALTER TABLE "public"."caisse_sante_historique" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."controles_stock" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."controles_tenue" ENABLE ROW LEVEL SECURITY;





CREATE POLICY "ecriture_manager_meme_site" ON "public"."audits_caisse" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."caisse_sante_historique" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."controles_tenue" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."employee_contraintes" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."employee_indisponibilites" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."evaluations_employes" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."journal_decisions" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."marge_exceptions" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."planning_generations" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."planning_regles_effectif" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."planning_shifts" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."product_locations" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."product_photos" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "ecriture_manager_meme_site" ON "public"."recommandations_validees" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





ALTER TABLE "public"."employee_contraintes" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."employee_indisponibilites" ENABLE ROW LEVEL SECURITY;




CREATE POLICY "employee_own_completions_insert" ON "public"."mission_completions" FOR INSERT WITH CHECK (("employee_id" = ( SELECT "auth"."uid"() AS "uid")));





CREATE POLICY "employee_own_progress_update" ON "public"."mission_progress" FOR UPDATE USING (("employee_id" = ( SELECT "auth"."uid"() AS "uid")));





CREATE POLICY "employee_own_progress_upsert" ON "public"."mission_progress" FOR INSERT WITH CHECK (("employee_id" = ( SELECT "auth"."uid"() AS "uid")));





CREATE POLICY "employee_own_role_changes_insert" ON "public"."role_changes" FOR INSERT WITH CHECK (("employee_id" = ( SELECT "auth"."uid"() AS "uid")));





CREATE POLICY "employee_own_shifts_insert" ON "public"."shifts" FOR INSERT TO "authenticated" WITH CHECK ((("employee_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("role" <> ALL (ARRAY['manager'::"text", 'gerant'::"text"])) OR (( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])))));





ALTER TABLE "public"."employees" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."evaluations_employes" ENABLE ROW LEVEL SECURITY;




CREATE POLICY "inserer_advisor_evidence" ON "public"."advisor_message_evidence" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."advisor_messages" "m"
     JOIN "public"."employees" "e" ON (("e"."site_id" = "m"."site_id")))
  WHERE (("m"."id" = "advisor_message_evidence"."advisor_message_id") AND ("e"."id" = ( SELECT "auth"."uid"() AS "uid"))))));





CREATE POLICY "inserer_advisor_feedback" ON "public"."advisor_feedback" FOR INSERT TO "authenticated" WITH CHECK ((("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("manager_id" = ( SELECT "auth"."uid"() AS "uid"))));





CREATE POLICY "inserer_advisor_messages" ON "public"."advisor_messages" FOR INSERT TO "authenticated" WITH CHECK (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));





CREATE POLICY "insert_own_pointage" ON "public"."pointages" FOR INSERT TO "authenticated" WITH CHECK (("employee_id" = ( SELECT "auth"."uid"() AS "uid")));




ALTER TABLE "public"."journal_decisions" ENABLE ROW LEVEL SECURITY;




CREATE POLICY "lecture_manager_meme_site" ON "public"."planning_generations" FOR SELECT TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "lecture_meme_site" ON "public"."employee_contraintes" FOR SELECT TO "authenticated" USING (("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "lecture_meme_site" ON "public"."employee_indisponibilites" FOR SELECT TO "authenticated" USING (("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "lecture_meme_site" ON "public"."marge_exceptions" FOR SELECT TO "authenticated" USING (("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "lecture_meme_site" ON "public"."planning_regles_effectif" FOR SELECT TO "authenticated" USING (("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "lecture_meme_site" ON "public"."product_locations" FOR SELECT TO "authenticated" USING (("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "lecture_meme_site" ON "public"."product_photos" FOR SELECT TO "authenticated" USING (("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")));





CREATE POLICY "manager_deletes_products" ON "public"."products" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "manager_deletes_stock_releves" ON "public"."stock_releves" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "manager_updates_stock_releves" ON "public"."stock_releves" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "manager_writes_products" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "manager_writes_stock_releves" ON "public"."stock_releves" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





ALTER TABLE "public"."marge_exceptions" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."mission_assignments" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."mission_catalog" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."mission_completions" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."mission_progress" ENABLE ROW LEVEL SECURITY;




CREATE POLICY "modification_manager_meme_site" ON "public"."audits_caisse" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."caisse_sante_historique" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."employee_contraintes" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."employee_indisponibilites" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."planning_regles_effectif" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."planning_shifts" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."product_locations" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modification_manager_meme_site" ON "public"."product_photos" FOR UPDATE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "modifier_advisor_messages" ON "public"."advisor_messages" FOR UPDATE TO "authenticated" USING (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));





ALTER TABLE "public"."nexus_language_templates" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."planning_generations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."planning_regles_effectif" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."planning_shifts" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."pointages" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."product_locations" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."product_photos" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."produits_appel" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."recommandations_validees" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."role_changes" ENABLE ROW LEVEL SECURITY;




CREATE POLICY "select_advisor_evidence" ON "public"."advisor_message_evidence" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."advisor_messages" "m"
     JOIN "public"."employees" "e" ON (("e"."site_id" = "m"."site_id")))
  WHERE (("m"."id" = "advisor_message_evidence"."advisor_message_id") AND ("e"."id" = ( SELECT "auth"."uid"() AS "uid"))))));





CREATE POLICY "select_advisor_feedback" ON "public"."advisor_feedback" FOR SELECT TO "authenticated" USING (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));





CREATE POLICY "select_advisor_messages" ON "public"."advisor_messages" FOR SELECT TO "authenticated" USING (("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))));





CREATE POLICY "select_advisor_rules" ON "public"."advisor_rules" FOR SELECT TO "authenticated" USING ((("site_id" IS NULL) OR ("site_id" IN ( SELECT "e"."site_id"
   FROM "public"."employees" "e"
  WHERE ("e"."id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."role" = ANY (ARRAY['manager'::"text", 'gerant'::"text"])))))));





CREATE POLICY "select_nexus_language_templates" ON "public"."nexus_language_templates" FOR SELECT TO "authenticated" USING (true);





CREATE POLICY "select_sites" ON "public"."sites" FOR SELECT USING (true);





CREATE POLICY "select_station_config" ON "public"."station_config" FOR SELECT TO "authenticated" USING ((("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")) OR (( SELECT "public"."je_suis_createur"() AS "je_suis_createur") AND (EXISTS ( SELECT 1
   FROM "public"."sites" "s"
  WHERE (("s"."site_id" = "station_config"."site") AND ("s"."acces_createur_autorise" = true)))))));





ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."sites" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."station_config" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."stock_releves" ENABLE ROW LEVEL SECURITY;




ALTER TABLE "public"."stock_sante_historique" ENABLE ROW LEVEL SECURITY;





CREATE POLICY "suppression_manager_meme_site" ON "public"."employee_indisponibilites" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "suppression_manager_meme_site" ON "public"."marge_exceptions" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "suppression_manager_meme_site" ON "public"."planning_regles_effectif" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "suppression_manager_meme_site" ON "public"."planning_shifts" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site_id" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "suppression_manager_meme_site" ON "public"."product_locations" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "suppression_manager_meme_site" ON "public"."product_photos" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "suppression_manager_meme_site" ON "public"."recommandations_validees" FOR DELETE TO "authenticated" USING (((( SELECT "public"."current_employee_role"() AS "current_employee_role") = ANY (ARRAY['manager'::"text", 'gerant'::"text"])) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "update_station_config_manager" ON "public"."station_config" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."role" = ANY (ARRAY['manager'::"text", 'gerant'::"text"]))))) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id")))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."role" = ANY (ARRAY['manager'::"text", 'gerant'::"text"]))))) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





CREATE POLICY "upsert_station_config_manager" ON "public"."station_config" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."employees" "e"
  WHERE (("e"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("e"."role" = ANY (ARRAY['manager'::"text", 'gerant'::"text"]))))) AND ("site" = ( SELECT "public"."current_employee_site_id"() AS "current_employee_site_id"))));





GRANT ALL ON FUNCTION "public"."assigner_controles_tenue_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") TO "anon";


GRANT ALL ON FUNCTION "public"."assigner_controles_tenue_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") TO "authenticated";


GRANT ALL ON FUNCTION "public"."assigner_controles_tenue_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") TO "service_role";





GRANT ALL ON FUNCTION "public"."assigner_justifications_caisse_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") TO "anon";


GRANT ALL ON FUNCTION "public"."assigner_justifications_caisse_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") TO "authenticated";


GRANT ALL ON FUNCTION "public"."assigner_justifications_caisse_depuis_message"("p_message_id" "uuid", "p_assigne_par" "uuid") TO "service_role";





GRANT ALL ON FUNCTION "public"."calculer_caisse_sante"("p_site" "text", "p_mois" "date") TO "anon";


GRANT ALL ON FUNCTION "public"."calculer_caisse_sante"("p_site" "text", "p_mois" "date") TO "authenticated";


GRANT ALL ON FUNCTION "public"."calculer_caisse_sante"("p_site" "text", "p_mois" "date") TO "service_role";





GRANT ALL ON FUNCTION "public"."calculer_horaires_quart"("p_site" "text", "p_quart" "text", "p_date" "date") TO "anon";


GRANT ALL ON FUNCTION "public"."calculer_horaires_quart"("p_site" "text", "p_quart" "text", "p_date" "date") TO "authenticated";


GRANT ALL ON FUNCTION "public"."calculer_horaires_quart"("p_site" "text", "p_quart" "text", "p_date" "date") TO "service_role";





GRANT ALL ON FUNCTION "public"."current_employee_role"() TO "anon";


GRANT ALL ON FUNCTION "public"."current_employee_role"() TO "authenticated";


GRANT ALL ON FUNCTION "public"."current_employee_role"() TO "service_role";





GRANT ALL ON FUNCTION "public"."current_employee_site_id"() TO "anon";


GRANT ALL ON FUNCTION "public"."current_employee_site_id"() TO "authenticated";


GRANT ALL ON FUNCTION "public"."current_employee_site_id"() TO "service_role";





GRANT ALL ON FUNCTION "public"."generer_message_caisse_ecart_non_justifie"("p_site" "text") TO "anon";


GRANT ALL ON FUNCTION "public"."generer_message_caisse_ecart_non_justifie"("p_site" "text") TO "authenticated";


GRANT ALL ON FUNCTION "public"."generer_message_caisse_ecart_non_justifie"("p_site" "text") TO "service_role";





GRANT ALL ON FUNCTION "public"."generer_message_caisse_ecart_recurrent"("p_site" "text") TO "anon";


GRANT ALL ON FUNCTION "public"."generer_message_caisse_ecart_recurrent"("p_site" "text") TO "authenticated";


GRANT ALL ON FUNCTION "public"."generer_message_caisse_ecart_recurrent"("p_site" "text") TO "service_role";





GRANT ALL ON FUNCTION "public"."generer_message_controle_tenue_absent"("p_site" "text") TO "anon";


GRANT ALL ON FUNCTION "public"."generer_message_controle_tenue_absent"("p_site" "text") TO "authenticated";


GRANT ALL ON FUNCTION "public"."generer_message_controle_tenue_absent"("p_site" "text") TO "service_role";





GRANT ALL ON FUNCTION "public"."heures_ouverture_publique"("p_site" "text", "p_date" "date") TO "anon";


GRANT ALL ON FUNCTION "public"."heures_ouverture_publique"("p_site" "text", "p_date" "date") TO "authenticated";


GRANT ALL ON FUNCTION "public"."heures_ouverture_publique"("p_site" "text", "p_date" "date") TO "service_role";





GRANT ALL ON FUNCTION "public"."je_suis_createur"() TO "anon";


GRANT ALL ON FUNCTION "public"."je_suis_createur"() TO "authenticated";


GRANT ALL ON FUNCTION "public"."je_suis_createur"() TO "service_role";





REVOKE ALL ON FUNCTION "public"."stats_fondateur"() FROM PUBLIC;


GRANT ALL ON FUNCTION "public"."stats_fondateur"() TO "anon";


GRANT ALL ON FUNCTION "public"."stats_fondateur"() TO "authenticated";


GRANT ALL ON FUNCTION "public"."stats_fondateur"() TO "service_role";





GRANT ALL ON FUNCTION "public"."verifier_depassements_heures"("p_site" "text", "p_mois" "date") TO "anon";


GRANT ALL ON FUNCTION "public"."verifier_depassements_heures"("p_site" "text", "p_mois" "date") TO "authenticated";


GRANT ALL ON FUNCTION "public"."verifier_depassements_heures"("p_site" "text", "p_mois" "date") TO "service_role";





GRANT ALL ON TABLE "public"."advisor_feedback" TO "anon";


GRANT ALL ON TABLE "public"."advisor_feedback" TO "authenticated";


GRANT ALL ON TABLE "public"."advisor_feedback" TO "service_role";





GRANT ALL ON TABLE "public"."advisor_message_evidence" TO "anon";


GRANT ALL ON TABLE "public"."advisor_message_evidence" TO "authenticated";


GRANT ALL ON TABLE "public"."advisor_message_evidence" TO "service_role";





GRANT ALL ON TABLE "public"."advisor_messages" TO "anon";


GRANT ALL ON TABLE "public"."advisor_messages" TO "authenticated";


GRANT ALL ON TABLE "public"."advisor_messages" TO "service_role";





GRANT ALL ON TABLE "public"."advisor_rules" TO "anon";


GRANT ALL ON TABLE "public"."advisor_rules" TO "authenticated";


GRANT ALL ON TABLE "public"."advisor_rules" TO "service_role";





GRANT ALL ON TABLE "public"."audits_caisse" TO "anon";


GRANT ALL ON TABLE "public"."audits_caisse" TO "authenticated";


GRANT ALL ON TABLE "public"."audits_caisse" TO "service_role";





GRANT ALL ON TABLE "public"."caisse_sante_historique" TO "anon";


GRANT ALL ON TABLE "public"."caisse_sante_historique" TO "authenticated";


GRANT ALL ON TABLE "public"."caisse_sante_historique" TO "service_role";





GRANT ALL ON TABLE "public"."controles_stock" TO "anon";


GRANT ALL ON TABLE "public"."controles_stock" TO "authenticated";


GRANT ALL ON TABLE "public"."controles_stock" TO "service_role";





GRANT ALL ON TABLE "public"."controles_tenue" TO "anon";


GRANT ALL ON TABLE "public"."controles_tenue" TO "authenticated";


GRANT ALL ON TABLE "public"."controles_tenue" TO "service_role";





GRANT ALL ON TABLE "public"."employee_contraintes" TO "anon";


GRANT ALL ON TABLE "public"."employee_contraintes" TO "authenticated";


GRANT ALL ON TABLE "public"."employee_contraintes" TO "service_role";





GRANT ALL ON TABLE "public"."employee_indisponibilites" TO "anon";


GRANT ALL ON TABLE "public"."employee_indisponibilites" TO "authenticated";


GRANT ALL ON TABLE "public"."employee_indisponibilites" TO "service_role";





GRANT ALL ON TABLE "public"."employees" TO "anon";


GRANT ALL ON TABLE "public"."employees" TO "authenticated";


GRANT ALL ON TABLE "public"."employees" TO "service_role";





GRANT ALL ON TABLE "public"."employees_public" TO "anon";


GRANT ALL ON TABLE "public"."employees_public" TO "authenticated";


GRANT ALL ON TABLE "public"."employees_public" TO "service_role";





GRANT ALL ON TABLE "public"."evaluations_employes" TO "anon";


GRANT ALL ON TABLE "public"."evaluations_employes" TO "authenticated";


GRANT ALL ON TABLE "public"."evaluations_employes" TO "service_role";





GRANT ALL ON TABLE "public"."journal_decisions" TO "anon";


GRANT ALL ON TABLE "public"."journal_decisions" TO "authenticated";


GRANT ALL ON TABLE "public"."journal_decisions" TO "service_role";





GRANT ALL ON TABLE "public"."marge_exceptions" TO "anon";


GRANT ALL ON TABLE "public"."marge_exceptions" TO "authenticated";


GRANT ALL ON TABLE "public"."marge_exceptions" TO "service_role";





GRANT ALL ON TABLE "public"."mission_assignments" TO "anon";


GRANT ALL ON TABLE "public"."mission_assignments" TO "authenticated";


GRANT ALL ON TABLE "public"."mission_assignments" TO "service_role";





GRANT ALL ON TABLE "public"."mission_catalog" TO "anon";


GRANT ALL ON TABLE "public"."mission_catalog" TO "authenticated";


GRANT ALL ON TABLE "public"."mission_catalog" TO "service_role";





GRANT ALL ON TABLE "public"."mission_completions" TO "anon";


GRANT ALL ON TABLE "public"."mission_completions" TO "authenticated";


GRANT ALL ON TABLE "public"."mission_completions" TO "service_role";





GRANT ALL ON TABLE "public"."mission_progress" TO "anon";


GRANT ALL ON TABLE "public"."mission_progress" TO "authenticated";


GRANT ALL ON TABLE "public"."mission_progress" TO "service_role";





GRANT ALL ON TABLE "public"."nexus_language_templates" TO "anon";


GRANT ALL ON TABLE "public"."nexus_language_templates" TO "authenticated";


GRANT ALL ON TABLE "public"."nexus_language_templates" TO "service_role";





GRANT ALL ON TABLE "public"."planning_generations" TO "anon";


GRANT ALL ON TABLE "public"."planning_generations" TO "authenticated";


GRANT ALL ON TABLE "public"."planning_generations" TO "service_role";





GRANT ALL ON TABLE "public"."planning_regles_effectif" TO "anon";


GRANT ALL ON TABLE "public"."planning_regles_effectif" TO "authenticated";


GRANT ALL ON TABLE "public"."planning_regles_effectif" TO "service_role";





GRANT ALL ON TABLE "public"."planning_shifts" TO "anon";


GRANT ALL ON TABLE "public"."planning_shifts" TO "authenticated";


GRANT ALL ON TABLE "public"."planning_shifts" TO "service_role";





GRANT ALL ON TABLE "public"."pointages" TO "anon";


GRANT ALL ON TABLE "public"."pointages" TO "authenticated";


GRANT ALL ON TABLE "public"."pointages" TO "service_role";





GRANT ALL ON TABLE "public"."product_locations" TO "anon";


GRANT ALL ON TABLE "public"."product_locations" TO "authenticated";


GRANT ALL ON TABLE "public"."product_locations" TO "service_role";





GRANT ALL ON TABLE "public"."product_photos" TO "anon";


GRANT ALL ON TABLE "public"."product_photos" TO "authenticated";


GRANT ALL ON TABLE "public"."product_photos" TO "service_role";





GRANT ALL ON TABLE "public"."products" TO "anon";


GRANT ALL ON TABLE "public"."products" TO "authenticated";


GRANT ALL ON TABLE "public"."products" TO "service_role";





GRANT ALL ON TABLE "public"."produits_appel" TO "anon";


GRANT ALL ON TABLE "public"."produits_appel" TO "authenticated";


GRANT ALL ON TABLE "public"."produits_appel" TO "service_role";





GRANT ALL ON TABLE "public"."recommandations_validees" TO "anon";


GRANT ALL ON TABLE "public"."recommandations_validees" TO "authenticated";


GRANT ALL ON TABLE "public"."recommandations_validees" TO "service_role";





GRANT ALL ON TABLE "public"."role_changes" TO "anon";


GRANT ALL ON TABLE "public"."role_changes" TO "authenticated";


GRANT ALL ON TABLE "public"."role_changes" TO "service_role";





GRANT ALL ON TABLE "public"."shifts" TO "anon";


GRANT ALL ON TABLE "public"."shifts" TO "authenticated";


GRANT ALL ON TABLE "public"."shifts" TO "service_role";





GRANT ALL ON TABLE "public"."sites" TO "anon";


GRANT ALL ON TABLE "public"."sites" TO "authenticated";


GRANT ALL ON TABLE "public"."sites" TO "service_role";





GRANT ALL ON TABLE "public"."station_config" TO "anon";


GRANT ALL ON TABLE "public"."station_config" TO "authenticated";


GRANT ALL ON TABLE "public"."station_config" TO "service_role";





GRANT ALL ON TABLE "public"."stock_releves" TO "anon";


GRANT ALL ON TABLE "public"."stock_releves" TO "authenticated";


GRANT ALL ON TABLE "public"."stock_releves" TO "service_role";





GRANT ALL ON TABLE "public"."stock_sante_historique" TO "anon";


GRANT ALL ON TABLE "public"."stock_sante_historique" TO "authenticated";


GRANT ALL ON TABLE "public"."stock_sante_historique" TO "service_role";





GRANT ALL ON TABLE "public"."v_caisse_ecart_non_justifie" TO "anon";


GRANT ALL ON TABLE "public"."v_caisse_ecart_non_justifie" TO "authenticated";


GRANT ALL ON TABLE "public"."v_caisse_ecart_non_justifie" TO "service_role";





GRANT ALL ON TABLE "public"."v_caisse_ecart_recurrent" TO "anon";


GRANT ALL ON TABLE "public"."v_caisse_ecart_recurrent" TO "authenticated";


GRANT ALL ON TABLE "public"."v_caisse_ecart_recurrent" TO "service_role";





GRANT ALL ON TABLE "public"."v_qualite_controle_absent" TO "anon";


GRANT ALL ON TABLE "public"."v_qualite_controle_absent" TO "authenticated";


GRANT ALL ON TABLE "public"."v_qualite_controle_absent" TO "service_role";





GRANT ALL ON TABLE "public"."v_qualite_degradation_activite" TO "anon";


GRANT ALL ON TABLE "public"."v_qualite_degradation_activite" TO "authenticated";


GRANT ALL ON TABLE "public"."v_qualite_degradation_activite" TO "service_role";





GRANT ALL ON TABLE "public"."v_qualite_mission_sans_preuve" TO "anon";


GRANT ALL ON TABLE "public"."v_qualite_mission_sans_preuve" TO "authenticated";


GRANT ALL ON TABLE "public"."v_qualite_mission_sans_preuve" TO "service_role";





GRANT ALL ON TABLE "public"."v_qualite_tenue_recurrente" TO "anon";


GRANT ALL ON TABLE "public"."v_qualite_tenue_recurrente" TO "authenticated";


GRANT ALL ON TABLE "public"."v_qualite_tenue_recurrente" TO "service_role";

-- Donnée minimale nécessaire : la ligne "sites" pour vito-sainte-marie
-- existait déjà avant toute migration trackée (c'est la seule ligne
-- réelle en production, récupérée directement depuis la base — jamais
-- inventée). Sans elle, les migrations suivantes qui référencent ce
-- site par clé étrangère (intégrations, simulateur de caisse) échouent
-- lors d'un rejeu complet depuis une base vide.
INSERT INTO "public"."sites" ("site_id", "nom_entreprise", "acces_createur_autorise") VALUES
    ('vito-sainte-marie', 'Vito Sainte-Marie Usine', true)
ON CONFLICT ("site_id") DO NOTHING;
