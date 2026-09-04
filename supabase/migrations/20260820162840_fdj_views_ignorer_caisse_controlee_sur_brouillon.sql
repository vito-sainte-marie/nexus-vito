-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260820162840 · fdj_views_ignorer_caisse_controlee_sur_brouillon
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- F2 (20/08/2026, "NEXUS FDJ — Audit de consolidation") — fondation avant de
-- construire la vue "Caisse réelle" : toutes les vues d'agrégation FDJ
-- filtraient déjà cc.statut <> 'provisoire' pour exclure une caisse non
-- contrôlée par un manager, mais AUCUNE ne vérifiait en plus que le QUART
-- lui-même était statut='valide'. Depuis F1 ("Laisser en brouillon"), un
-- manager peut ouvrir un brouillon via "Brouillons FDJ à terminer" et poser
-- un statut de caisse qualitatif (conforme/à contrôler/...) SANS repasser le
-- quart en 'valide' — les deux champs (fdj_shifts.statut, champStatutShift)
-- et (fdj_cash_controls.statut, champStatutCaisse) sont deux menus déroulants
-- indépendants sur le même écran d'édition manager (NEXUS-FDJ-Manager-v1.html
-- ~L.3652 et ~L.3697). Aujourd'hui (vérifié) aucune ligne réelle n'est dans
-- cet état, mais rien ne l'empêche — violation directe de la Definition of
-- Done du cahier : "Une caisse non validée est identifiable comme brouillon
-- et n'altère jamais les rapports." Corrigé une seule fois, à la source
-- (view_fdj_shift_facts), plutôt que dans chaque vue dérivée séparément
-- (Article 11) — garantie posée côté serveur (cahier §12), pas seulement
-- dans l'écran.

create or replace view view_fdj_shift_facts as
  SELECT s.id AS shift_id,
    s.site,
    s.date,
    s.quart,
    s.employee_id,
    s.statut AS statut_shift,
    cc.statut AS statut_caisse,
    cc.ventes_grattage_valeur,
    cc.caisse_tirages,
    cc.caisse_attendue,
    cc.caisse_reelle,
    cc.ecart,
    cc.motif_ecart,
    sc.tickets_vendus,
    sc.nb_jeux_comptes,
    (s.statut = 'valide' AND cc.statut IS NOT NULL AND cc.statut <> 'provisoire') AS caisse_comptabilisable
   FROM fdj_shifts s
     LEFT JOIN fdj_cash_controls cc ON cc.shift_id = s.id
     LEFT JOIN ( SELECT fdj_shift_counts.shift_id,
            sum(fdj_shift_counts.ventes_qte) AS tickets_vendus,
            count(*) FILTER (WHERE fdj_shift_counts.ventes_qte IS NOT NULL) AS nb_jeux_comptes
           FROM fdj_shift_counts
          GROUP BY fdj_shift_counts.shift_id) sc ON sc.shift_id = s.id
UNION ALL
 SELECT NULL::uuid AS shift_id,
    h.site,
    h.date,
    h.quart,
    NULL::uuid AS employee_id,
    'valide'::text AS statut_shift,
        CASE
            WHEN COALESCE((h.data ->> 'ecart'::text)::numeric, 0::numeric) = 0::numeric THEN 'conforme'::text
            ELSE 'valide_avec_ecart'::text
        END AS statut_caisse,
    (h.data ->> 'ventes_grattage'::text)::numeric AS ventes_grattage_valeur,
    (h.data ->> 'caisse_loto'::text)::numeric AS caisse_tirages,
    (h.data ->> 'total_attendu'::text)::numeric AS caisse_attendue,
    (h.data ->> 'caisse_reelle'::text)::numeric AS caisse_reelle,
    COALESCE((h.data ->> 'ecart'::text)::numeric, 0::numeric) AS ecart,
    NULL::text AS motif_ecart,
    NULL::numeric AS tickets_vendus,
    NULL::bigint AS nb_jeux_comptes,
    true AS caisse_comptabilisable
   FROM fdj_imported_history h
  WHERE NOT (EXISTS ( SELECT 1
           FROM fdj_shifts s2
          WHERE s2.site = h.site AND s2.date = h.date AND s2.quart = h.quart));

create or replace view view_fdj_daily_summary as
  SELECT site,
    date,
    count(*) AS nb_quarts,
    count(*) FILTER (WHERE statut_shift = 'valide'::text) AS nb_quarts_valides,
    count(*) FILTER (WHERE caisse_comptabilisable) AS nb_quarts_controles,
    count(*) FILTER (WHERE caisse_comptabilisable AND statut_caisse = 'conforme'::text) AS nb_quarts_conformes,
    sum(ventes_grattage_valeur) FILTER (WHERE caisse_comptabilisable) AS ca_grattage,
    sum(tickets_vendus) FILTER (WHERE caisse_comptabilisable) AS tickets_vendus,
    sum(caisse_tirages) FILTER (WHERE caisse_comptabilisable) AS caisse_tirages,
    sum(ecart) FILTER (WHERE caisse_comptabilisable) AS ecart_total,
    count(*) FILTER (WHERE caisse_comptabilisable AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
    sum(caisse_reelle) FILTER (WHERE caisse_comptabilisable) AS caisse_reelle_totale
   FROM view_fdj_shift_facts
  GROUP BY site, date;

create or replace view view_fdj_weekly_summary as
  SELECT site,
    date_trunc('week'::text, date::timestamp with time zone)::date AS semaine_debut,
    to_char(date::timestamp with time zone, 'IYYY-"S"IW'::text) AS semaine_iso,
    count(*) AS nb_quarts,
    count(*) FILTER (WHERE statut_shift = 'valide'::text) AS nb_quarts_valides,
    count(*) FILTER (WHERE caisse_comptabilisable) AS nb_quarts_controles,
    count(*) FILTER (WHERE caisse_comptabilisable AND statut_caisse = 'conforme'::text) AS nb_quarts_conformes,
    sum(ventes_grattage_valeur) FILTER (WHERE caisse_comptabilisable) AS ca_grattage,
    sum(tickets_vendus) FILTER (WHERE caisse_comptabilisable) AS tickets_vendus,
    sum(caisse_tirages) FILTER (WHERE caisse_comptabilisable) AS caisse_tirages,
    sum(ecart) FILTER (WHERE caisse_comptabilisable) AS ecart_total,
    count(*) FILTER (WHERE caisse_comptabilisable AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
    sum(caisse_reelle) FILTER (WHERE caisse_comptabilisable) AS caisse_reelle_totale
   FROM view_fdj_shift_facts
  GROUP BY site, (date_trunc('week'::text, date::timestamp with time zone)), (to_char(date::timestamp with time zone, 'IYYY-"S"IW'::text));

create or replace view view_fdj_monthly_summary as
  SELECT site,
    date_trunc('month'::text, date::timestamp with time zone)::date AS mois_debut,
    to_char(date::timestamp with time zone, 'YYYY-MM'::text) AS mois_label,
    count(*) AS nb_quarts,
    count(*) FILTER (WHERE statut_shift = 'valide'::text) AS nb_quarts_valides,
    count(*) FILTER (WHERE caisse_comptabilisable) AS nb_quarts_controles,
    count(*) FILTER (WHERE caisse_comptabilisable AND statut_caisse = 'conforme'::text) AS nb_quarts_conformes,
    sum(ventes_grattage_valeur) FILTER (WHERE caisse_comptabilisable) AS ca_grattage,
    sum(tickets_vendus) FILTER (WHERE caisse_comptabilisable) AS tickets_vendus,
    sum(caisse_tirages) FILTER (WHERE caisse_comptabilisable) AS caisse_tirages,
    sum(ecart) FILTER (WHERE caisse_comptabilisable) AS ecart_total,
    count(*) FILTER (WHERE caisse_comptabilisable AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
    sum(caisse_reelle) FILTER (WHERE caisse_comptabilisable) AS caisse_reelle_totale
   FROM view_fdj_shift_facts
  GROUP BY site, (date_trunc('month'::text, date::timestamp with time zone)), (to_char(date::timestamp with time zone, 'YYYY-MM'::text));

create or replace view view_fdj_yearly_summary as
  SELECT site,
    date_trunc('year'::text, date::timestamp with time zone)::date AS annee_debut,
    to_char(date::timestamp with time zone, 'YYYY'::text) AS annee_label,
    count(*) AS nb_quarts,
    count(*) FILTER (WHERE statut_shift = 'valide'::text) AS nb_quarts_valides,
    count(*) FILTER (WHERE caisse_comptabilisable) AS nb_quarts_controles,
    count(*) FILTER (WHERE caisse_comptabilisable AND statut_caisse = 'conforme'::text) AS nb_quarts_conformes,
    sum(ventes_grattage_valeur) FILTER (WHERE caisse_comptabilisable) AS ca_grattage,
    sum(tickets_vendus) FILTER (WHERE caisse_comptabilisable) AS tickets_vendus,
    sum(caisse_tirages) FILTER (WHERE caisse_comptabilisable) AS caisse_tirages,
    sum(ecart) FILTER (WHERE caisse_comptabilisable) AS ecart_total,
    count(*) FILTER (WHERE caisse_comptabilisable AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
    sum(caisse_reelle) FILTER (WHERE caisse_comptabilisable) AS caisse_reelle_totale
   FROM view_fdj_shift_facts
  GROUP BY site, (date_trunc('year'::text, date::timestamp with time zone)), (to_char(date::timestamp with time zone, 'YYYY'::text));

create or replace view view_fdj_employee_daily as
  SELECT site,
    date,
    employee_id,
    count(*) AS nb_quarts,
    count(*) FILTER (WHERE statut_shift = 'valide'::text) AS nb_quarts_valides,
    count(*) FILTER (WHERE caisse_comptabilisable) AS nb_quarts_controles,
    count(*) FILTER (WHERE caisse_comptabilisable AND statut_caisse = 'conforme'::text) AS nb_quarts_conformes,
    sum(ventes_grattage_valeur) FILTER (WHERE caisse_comptabilisable) AS ca_grattage,
    sum(tickets_vendus) FILTER (WHERE caisse_comptabilisable) AS tickets_vendus,
    sum(ecart) FILTER (WHERE caisse_comptabilisable) AS ecart_total,
    count(*) FILTER (WHERE caisse_comptabilisable AND ecart <> 0::numeric) AS nb_ecarts_non_nuls
   FROM view_fdj_shift_facts
  WHERE employee_id IS NOT NULL
  GROUP BY site, date, employee_id;

create or replace view view_fdj_discrepancy_daily as
  SELECT site,
    date,
    motif_ecart,
    count(*) AS nb_occurrences,
    sum(ecart) AS ecart_total,
    avg(ecart) AS ecart_moyen
   FROM view_fdj_shift_facts
  WHERE caisse_comptabilisable AND ecart <> 0::numeric
  GROUP BY site, date, motif_ecart;

create or replace view view_fdj_game_daily_ventes as
  SELECT s.site,
    s.date,
    sc.game_id,
    sum(sc.ventes_qte) AS tickets_vendus,
    sum(sc.ventes_valeur) AS ca,
    count(*) AS nb_quarts_comptes
   FROM fdj_shift_counts sc
     JOIN fdj_shifts s ON s.id = sc.shift_id AND s.statut = 'valide'
     JOIN fdj_cash_controls cc ON cc.shift_id = s.id AND cc.statut <> 'provisoire'::text
  WHERE sc.ventes_qte IS NOT NULL
  GROUP BY s.site, s.date, sc.game_id;

create or replace view view_fdj_employee_price_tier_daily as
  SELECT s.site,
    s.date,
    s.employee_id,
    g.prix AS palier,
    sum(sc.ventes_qte) AS tickets_vendus,
    sum(sc.ventes_valeur) AS ca
   FROM fdj_shift_counts sc
     JOIN fdj_shifts s ON s.id = sc.shift_id AND s.statut = 'valide'
     JOIN fdj_cash_controls cc ON cc.shift_id = s.id AND cc.statut <> 'provisoire'::text
     JOIN fdj_games g ON g.id = sc.game_id
  WHERE sc.ventes_qte IS NOT NULL AND s.employee_id IS NOT NULL
  GROUP BY s.site, s.date, s.employee_id, g.prix;
