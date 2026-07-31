alter table "public"."campagnes_nexus_imports" drop constraint "campagnes_nexus_imports_campagne_id_fkey";

drop view if exists "public"."v_caisse_ecart_a_traiter";

drop view if exists "public"."v_caisse_ecart_non_justifie";

drop view if exists "public"."v_caisse_ecart_recurrent";

alter table "public"."campagnes_nexus" alter column "nature" set not null;

alter table "public"."campagnes_nexus" alter column "objectif" set not null;

alter table "public"."campagnes_nexus" alter column "produits_concernes" set default '{}'::text[];

alter table "public"."campagnes_nexus" alter column "produits_concernes" set not null;

CREATE INDEX idx_campagnes_nexus_site_dates ON public.campagnes_nexus USING btree (site, date_debut, date_fin);

alter table "public"."campagnes_nexus" add constraint "campagnes_nexus_dates_coherentes" CHECK ((date_fin >= date_debut)) not valid;

alter table "public"."campagnes_nexus" validate constraint "campagnes_nexus_dates_coherentes";

alter table "public"."campagnes_nexus" add constraint "campagnes_nexus_nature_check" CHECK ((nature = ANY (ARRAY['prix_reduit'::text, 'deux_plus_un'::text, 'pack'::text, 'bon_achat'::text, 'cadeau'::text, 'remise_carburant'::text]))) not valid;

alter table "public"."campagnes_nexus" validate constraint "campagnes_nexus_nature_check";

alter table "public"."campagnes_nexus" add constraint "campagnes_nexus_objectif_check" CHECK ((objectif = ANY (ARRAY['augmenter_ca'::text, 'augmenter_marge'::text, 'ecouler_stock'::text, 'attirer_clients'::text, 'faire_connaitre'::text, 'fideliser'::text, 'autre'::text]))) not valid;

alter table "public"."campagnes_nexus" validate constraint "campagnes_nexus_objectif_check";

alter table "public"."campagnes_nexus" add constraint "campagnes_nexus_site_fkey" FOREIGN KEY (site) REFERENCES public.sites(site_id) not valid;

alter table "public"."campagnes_nexus" validate constraint "campagnes_nexus_site_fkey";

alter table "public"."campagnes_nexus" add constraint "campagnes_nexus_type_check" CHECK ((type = ANY (ARRAY['boutique'::text, 'carburant'::text, 'mixte'::text]))) not valid;

alter table "public"."campagnes_nexus" validate constraint "campagnes_nexus_type_check";

alter table "public"."campagnes_nexus_imports" add constraint "campagnes_nexus_imports_phase_check" CHECK ((phase = ANY (ARRAY['avant'::text, 'pendant'::text]))) not valid;

alter table "public"."campagnes_nexus_imports" validate constraint "campagnes_nexus_imports_phase_check";

alter table "public"."campagnes_nexus_imports" add constraint "campagnes_nexus_imports_site_fkey" FOREIGN KEY (site) REFERENCES public.sites(site_id) not valid;

alter table "public"."campagnes_nexus_imports" validate constraint "campagnes_nexus_imports_site_fkey";

alter table "public"."campagnes_nexus_imports" add constraint "campagnes_nexus_imports_campagne_id_fkey" FOREIGN KEY (campagne_id) REFERENCES public.campagnes_nexus(id) ON DELETE CASCADE not valid;

alter table "public"."campagnes_nexus_imports" validate constraint "campagnes_nexus_imports_campagne_id_fkey";

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


grant delete on table "public"."advisor_inputs" to "service_role";

grant insert on table "public"."advisor_inputs" to "service_role";

grant select on table "public"."advisor_inputs" to "service_role";

grant update on table "public"."advisor_inputs" to "service_role";

grant delete on table "public"."advisor_logs" to "service_role";

grant insert on table "public"."advisor_logs" to "service_role";

grant select on table "public"."advisor_logs" to "service_role";

grant update on table "public"."advisor_logs" to "service_role";

grant delete on table "public"."api_keys" to "service_role";

grant insert on table "public"."api_keys" to "service_role";

grant select on table "public"."api_keys" to "service_role";

grant update on table "public"."api_keys" to "service_role";

grant delete on table "public"."api_logs" to "service_role";

grant insert on table "public"."api_logs" to "service_role";

grant select on table "public"."api_logs" to "service_role";

grant update on table "public"."api_logs" to "service_role";

grant delete on table "public"."apprentissage_snapshots" to "anon";

grant insert on table "public"."apprentissage_snapshots" to "anon";

grant select on table "public"."apprentissage_snapshots" to "anon";

grant update on table "public"."apprentissage_snapshots" to "anon";

grant delete on table "public"."apprentissage_snapshots" to "authenticated";

grant insert on table "public"."apprentissage_snapshots" to "authenticated";

grant select on table "public"."apprentissage_snapshots" to "authenticated";

grant update on table "public"."apprentissage_snapshots" to "authenticated";

grant delete on table "public"."apprentissage_snapshots" to "service_role";

grant insert on table "public"."apprentissage_snapshots" to "service_role";

grant select on table "public"."apprentissage_snapshots" to "service_role";

grant update on table "public"."apprentissage_snapshots" to "service_role";

grant delete on table "public"."campagnes_nexus" to "anon";

grant insert on table "public"."campagnes_nexus" to "anon";

grant select on table "public"."campagnes_nexus" to "anon";

grant update on table "public"."campagnes_nexus" to "anon";

grant delete on table "public"."campagnes_nexus" to "authenticated";

grant insert on table "public"."campagnes_nexus" to "authenticated";

grant select on table "public"."campagnes_nexus" to "authenticated";

grant update on table "public"."campagnes_nexus" to "authenticated";

grant delete on table "public"."campagnes_nexus" to "service_role";

grant insert on table "public"."campagnes_nexus" to "service_role";

grant select on table "public"."campagnes_nexus" to "service_role";

grant update on table "public"."campagnes_nexus" to "service_role";

grant delete on table "public"."campagnes_nexus_imports" to "anon";

grant insert on table "public"."campagnes_nexus_imports" to "anon";

grant select on table "public"."campagnes_nexus_imports" to "anon";

grant update on table "public"."campagnes_nexus_imports" to "anon";

grant delete on table "public"."campagnes_nexus_imports" to "authenticated";

grant insert on table "public"."campagnes_nexus_imports" to "authenticated";

grant select on table "public"."campagnes_nexus_imports" to "authenticated";

grant update on table "public"."campagnes_nexus_imports" to "authenticated";

grant delete on table "public"."campagnes_nexus_imports" to "service_role";

grant insert on table "public"."campagnes_nexus_imports" to "service_role";

grant select on table "public"."campagnes_nexus_imports" to "service_role";

grant update on table "public"."campagnes_nexus_imports" to "service_role";

grant delete on table "public"."integration_errors" to "service_role";

grant insert on table "public"."integration_errors" to "service_role";

grant select on table "public"."integration_errors" to "service_role";

grant update on table "public"."integration_errors" to "service_role";

grant delete on table "public"."integration_sources" to "service_role";

grant insert on table "public"."integration_sources" to "service_role";

grant select on table "public"."integration_sources" to "service_role";

grant update on table "public"."integration_sources" to "service_role";

grant delete on table "public"."integration_status" to "service_role";

grant insert on table "public"."integration_status" to "service_role";

grant select on table "public"."integration_status" to "service_role";

grant update on table "public"."integration_status" to "service_role";

grant delete on table "public"."normalization_state" to "service_role";

grant insert on table "public"."normalization_state" to "service_role";

grant select on table "public"."normalization_state" to "service_role";

grant update on table "public"."normalization_state" to "service_role";

grant delete on table "public"."normalized_cash_sessions" to "service_role";

grant insert on table "public"."normalized_cash_sessions" to "service_role";

grant select on table "public"."normalized_cash_sessions" to "service_role";

grant update on table "public"."normalized_cash_sessions" to "service_role";

grant delete on table "public"."normalized_products" to "service_role";

grant insert on table "public"."normalized_products" to "service_role";

grant select on table "public"."normalized_products" to "service_role";

grant update on table "public"."normalized_products" to "service_role";

grant delete on table "public"."normalized_sales" to "service_role";

grant insert on table "public"."normalized_sales" to "service_role";

grant select on table "public"."normalized_sales" to "service_role";

grant update on table "public"."normalized_sales" to "service_role";

grant delete on table "public"."normalized_stock" to "service_role";

grant insert on table "public"."normalized_stock" to "service_role";

grant select on table "public"."normalized_stock" to "service_role";

grant update on table "public"."normalized_stock" to "service_role";

grant delete on table "public"."panier_moyen_quotidien" to "anon";

grant insert on table "public"."panier_moyen_quotidien" to "anon";

grant select on table "public"."panier_moyen_quotidien" to "anon";

grant update on table "public"."panier_moyen_quotidien" to "anon";

grant delete on table "public"."panier_moyen_quotidien" to "authenticated";

grant insert on table "public"."panier_moyen_quotidien" to "authenticated";

grant select on table "public"."panier_moyen_quotidien" to "authenticated";

grant update on table "public"."panier_moyen_quotidien" to "authenticated";

grant delete on table "public"."panier_moyen_quotidien" to "service_role";

grant insert on table "public"."panier_moyen_quotidien" to "service_role";

grant select on table "public"."panier_moyen_quotidien" to "service_role";

grant update on table "public"."panier_moyen_quotidien" to "service_role";

grant delete on table "public"."rappels" to "anon";

grant insert on table "public"."rappels" to "anon";

grant select on table "public"."rappels" to "anon";

grant update on table "public"."rappels" to "anon";

grant delete on table "public"."rappels" to "authenticated";

grant insert on table "public"."rappels" to "authenticated";

grant select on table "public"."rappels" to "authenticated";

grant update on table "public"."rappels" to "authenticated";

grant delete on table "public"."rappels" to "service_role";

grant insert on table "public"."rappels" to "service_role";

grant select on table "public"."rappels" to "service_role";

grant update on table "public"."rappels" to "service_role";

grant delete on table "public"."raw_cash_sessions" to "service_role";

grant insert on table "public"."raw_cash_sessions" to "service_role";

grant select on table "public"."raw_cash_sessions" to "service_role";

grant update on table "public"."raw_cash_sessions" to "service_role";

grant delete on table "public"."raw_products" to "service_role";

grant insert on table "public"."raw_products" to "service_role";

grant select on table "public"."raw_products" to "service_role";

grant update on table "public"."raw_products" to "service_role";

grant delete on table "public"."raw_sales" to "service_role";

grant insert on table "public"."raw_sales" to "service_role";

grant select on table "public"."raw_sales" to "service_role";

grant update on table "public"."raw_sales" to "service_role";

grant delete on table "public"."raw_stock_movements" to "service_role";

grant insert on table "public"."raw_stock_movements" to "service_role";

grant select on table "public"."raw_stock_movements" to "service_role";

grant update on table "public"."raw_stock_movements" to "service_role";

grant delete on table "public"."synchronization_history" to "service_role";

grant insert on table "public"."synchronization_history" to "service_role";

grant select on table "public"."synchronization_history" to "service_role";

grant update on table "public"."synchronization_history" to "service_role";


  create policy "lecture_preuve_propre_dossier"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'preuves-missions'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "lecture_publique_logos_sites"
  on "storage"."objects"
  as permissive
  for select
  to public
using ((bucket_id = 'logos-sites'::text));



  create policy "select_preuves_missions"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'preuves-missions'::text));



  create policy "upload_logos_sites"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'logos-sites'::text));



  create policy "upload_preuve_propre_dossier"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'preuves-missions'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));



  create policy "upload_preuves_missions"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check ((bucket_id = 'preuves-missions'::text));



