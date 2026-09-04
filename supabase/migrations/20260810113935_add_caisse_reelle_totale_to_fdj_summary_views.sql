-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810113935 · add_caisse_reelle_totale_to_fdj_summary_views
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Ajoute le total de caisse réelle (somme, filtrée sur les quarts déjà
-- contrôlés) aux 4 vues de synthèse FDJ (jour/semaine/mois/année) — demande
-- explicite de Frédéric (10/08/2026) : c'est CETTE valeur, pas le CA
-- théorique, qu'il compare au dépôt réel pour déduire les commissions FDJ.
-- Colonne ajoutée en dernière position (obligatoire pour CREATE OR REPLACE
-- VIEW sans casser les vues qui en dépendent) — n'affecte aucune colonne
-- existante. Fonctionne aussi bien sur les jours natifs que sur
-- l'historique importé, puisque view_fdj_shift_facts expose déjà
-- caisse_reelle pour les deux (voir migration blend_fdj_imported_history_into_shift_facts).

CREATE OR REPLACE VIEW view_fdj_daily_summary AS
SELECT
  site, date,
  count(*) AS nb_quarts,
  count(*) FILTER (WHERE statut_shift = 'valide') AS nb_quarts_valides,
  count(*) FILTER (WHERE statut_caisse IS NOT NULL AND statut_caisse <> 'provisoire') AS nb_quarts_controles,
  count(*) FILTER (WHERE statut_caisse = 'conforme') AS nb_quarts_conformes,
  sum(ventes_grattage_valeur) FILTER (WHERE statut_caisse <> 'provisoire') AS ca_grattage,
  sum(tickets_vendus) FILTER (WHERE statut_caisse <> 'provisoire') AS tickets_vendus,
  sum(caisse_tirages) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_tirages,
  sum(ecart) FILTER (WHERE statut_caisse <> 'provisoire') AS ecart_total,
  count(*) FILTER (WHERE statut_caisse <> 'provisoire' AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
  sum(caisse_reelle) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_reelle_totale
FROM view_fdj_shift_facts
GROUP BY site, date;

CREATE OR REPLACE VIEW view_fdj_weekly_summary AS
SELECT
  site,
  (date_trunc('week', date::timestamp with time zone))::date AS semaine_debut,
  to_char(date::timestamp with time zone, 'IYYY-"S"IW') AS semaine_iso,
  count(*) AS nb_quarts,
  count(*) FILTER (WHERE statut_shift = 'valide') AS nb_quarts_valides,
  count(*) FILTER (WHERE statut_caisse IS NOT NULL AND statut_caisse <> 'provisoire') AS nb_quarts_controles,
  count(*) FILTER (WHERE statut_caisse = 'conforme') AS nb_quarts_conformes,
  sum(ventes_grattage_valeur) FILTER (WHERE statut_caisse <> 'provisoire') AS ca_grattage,
  sum(tickets_vendus) FILTER (WHERE statut_caisse <> 'provisoire') AS tickets_vendus,
  sum(caisse_tirages) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_tirages,
  sum(ecart) FILTER (WHERE statut_caisse <> 'provisoire') AS ecart_total,
  count(*) FILTER (WHERE statut_caisse <> 'provisoire' AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
  sum(caisse_reelle) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_reelle_totale
FROM view_fdj_shift_facts
GROUP BY site, (date_trunc('week', date::timestamp with time zone)), (to_char(date::timestamp with time zone, 'IYYY-"S"IW'));

CREATE OR REPLACE VIEW view_fdj_monthly_summary AS
SELECT
  site,
  (date_trunc('month', date::timestamp with time zone))::date AS mois_debut,
  to_char(date::timestamp with time zone, 'YYYY-MM') AS mois_label,
  count(*) AS nb_quarts,
  count(*) FILTER (WHERE statut_shift = 'valide') AS nb_quarts_valides,
  count(*) FILTER (WHERE statut_caisse IS NOT NULL AND statut_caisse <> 'provisoire') AS nb_quarts_controles,
  count(*) FILTER (WHERE statut_caisse = 'conforme') AS nb_quarts_conformes,
  sum(ventes_grattage_valeur) FILTER (WHERE statut_caisse <> 'provisoire') AS ca_grattage,
  sum(tickets_vendus) FILTER (WHERE statut_caisse <> 'provisoire') AS tickets_vendus,
  sum(caisse_tirages) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_tirages,
  sum(ecart) FILTER (WHERE statut_caisse <> 'provisoire') AS ecart_total,
  count(*) FILTER (WHERE statut_caisse <> 'provisoire' AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
  sum(caisse_reelle) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_reelle_totale
FROM view_fdj_shift_facts
GROUP BY site, (date_trunc('month', date::timestamp with time zone)), (to_char(date::timestamp with time zone, 'YYYY-MM'));

CREATE OR REPLACE VIEW view_fdj_yearly_summary AS
SELECT
  site,
  (date_trunc('year', date::timestamp with time zone))::date AS annee_debut,
  to_char(date::timestamp with time zone, 'YYYY') AS annee_label,
  count(*) AS nb_quarts,
  count(*) FILTER (WHERE statut_shift = 'valide') AS nb_quarts_valides,
  count(*) FILTER (WHERE statut_caisse IS NOT NULL AND statut_caisse <> 'provisoire') AS nb_quarts_controles,
  count(*) FILTER (WHERE statut_caisse = 'conforme') AS nb_quarts_conformes,
  sum(ventes_grattage_valeur) FILTER (WHERE statut_caisse <> 'provisoire') AS ca_grattage,
  sum(tickets_vendus) FILTER (WHERE statut_caisse <> 'provisoire') AS tickets_vendus,
  sum(caisse_tirages) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_tirages,
  sum(ecart) FILTER (WHERE statut_caisse <> 'provisoire') AS ecart_total,
  count(*) FILTER (WHERE statut_caisse <> 'provisoire' AND ecart <> 0::numeric) AS nb_ecarts_non_nuls,
  sum(caisse_reelle) FILTER (WHERE statut_caisse <> 'provisoire') AS caisse_reelle_totale
FROM view_fdj_shift_facts
GROUP BY site, (date_trunc('year', date::timestamp with time zone)), (to_char(date::timestamp with time zone, 'YYYY'));
