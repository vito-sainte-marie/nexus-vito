drop view if exists "public"."v_caisse_ecart_a_traiter";

drop view if exists "public"."v_caisse_ecart_non_justifie";

drop view if exists "public"."v_caisse_ecart_recurrent";

create or replace view "public"."v_caisse_ecart_a_traiter" as  SELECT ac.id AS audit_id,
    ac.site,
    ac.date,
    ac.quart,
    ac.statut,
    ac.ecart_piste,
    ac.ecart_boutique,
    ac.ecart_total,
        CASE
            WHEN (abs(ac.ecart_piste) >= abs(ac.ecart_boutique)) THEN 'piste'::text
            ELSE 'boutique'::text
        END AS cote_dominant,
    GREATEST(abs(ac.ecart_piste), abs(ac.ecart_boutique)) AS montant_dominant,
    e.id AS employee_id,
    e.nom AS employee_nom
   FROM (public.audits_caisse ac
     LEFT JOIN public.employees e ON ((e.id =
        CASE
            WHEN (abs(ac.ecart_piste) >= abs(ac.ecart_boutique)) THEN
            CASE
                WHEN (jsonb_array_length(COALESCE(ac.employes_piste, '[]'::jsonb)) = 1) THEN ((ac.employes_piste ->> 0))::uuid
                ELSE NULL::uuid
            END
            ELSE
            CASE
                WHEN (jsonb_array_length(COALESCE(ac.employes_boutique, '[]'::jsonb)) = 1) THEN ((ac.employes_boutique ->> 0))::uuid
                ELSE NULL::uuid
            END
        END)))
  WHERE ((ac.statut = ANY (ARRAY['anomalie'::text, 'critique'::text])) AND ((ac.commentaire IS NULL) OR (btrim(ac.commentaire) = ''::text)) AND (ac.date >= (CURRENT_DATE - '14 days'::interval)));


create or replace view "public"."v_caisse_ecart_non_justifie" as  SELECT id AS audit_id,
    site,
    date,
    quart,
    ecart_total,
    statut,
        CASE
            WHEN (statut = 'critique'::text) THEN 'haute'::text
            ELSE 'a_surveiller'::text
        END AS priorite_calculee,
    'A'::text AS confiance_calculee
   FROM public.audits_caisse
  WHERE ((statut IS NOT NULL) AND (statut <> 'conforme'::text) AND ((commentaire IS NULL) OR (btrim(commentaire) = ''::text)) AND (date >= (CURRENT_DATE - '14 days'::interval)));


create or replace view "public"."v_caisse_ecart_recurrent" as  WITH fenetre AS (
         SELECT audits_caisse.site,
            count(*) FILTER (WHERE (audits_caisse.statut = ANY (ARRAY['anomalie'::text, 'critique'::text]))) AS nb_anomalies,
            count(*) AS nb_total,
            max(audits_caisse.date) FILTER (WHERE (audits_caisse.statut = ANY (ARRAY['anomalie'::text, 'critique'::text]))) AS derniere_anomalie,
            bool_or((audits_caisse.statut = 'critique'::text)) AS a_critique
           FROM public.audits_caisse
          WHERE (audits_caisse.date >= (CURRENT_DATE - '14 days'::interval))
          GROUP BY audits_caisse.site
        )
 SELECT site,
    nb_anomalies,
    nb_total,
    derniere_anomalie,
        CASE
            WHEN a_critique THEN 'haute'::text
            WHEN (nb_anomalies >= 3) THEN 'haute'::text
            ELSE 'a_surveiller'::text
        END AS priorite_calculee,
        CASE
            WHEN (nb_total >= 6) THEN 'A'::text
            WHEN (nb_total >= 3) THEN 'B'::text
            ELSE 'C'::text
        END AS confiance_calculee
   FROM fenetre
  WHERE (nb_anomalies >= 2);



