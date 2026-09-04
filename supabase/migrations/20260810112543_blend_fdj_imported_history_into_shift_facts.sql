-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810112543 · blend_fdj_imported_history_into_shift_facts
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Fusionne fdj_imported_history dans view_fdj_shift_facts, la vue de base
-- dont dépendent view_fdj_daily/weekly/monthly/yearly_summary,
-- view_fdj_discrepancy_daily et view_fdj_employee_daily. En modifiant
-- uniquement ce point d'entrée unique (Article 11 — une seule vérité),
-- toutes les vues et écrans qui la consomment (FDJ Pilotage : Vue
-- d'ensemble, Ventes, Jours & quarts, Contrôle & écarts, Historique, et le
-- rapport PDF) héritent automatiquement de l'historique importé, sans
-- aucun changement JS.
--
-- Règles :
--  - Un jour/quart déjà présent dans fdj_shifts (saisie NEXUS native)
--    n'est JAMAIS dupliqué par l'import (WHERE NOT EXISTS) — la donnée
--    native, plus riche (jeux, employé), a toujours priorité.
--  - Les lignes importées sont marquées statut_shift='valide' et
--    statut_caisse='conforme'/'valide_avec_ecart' selon l'écart : demande
--    explicite de Frédéric du 10/08/2026 ("mets le statut vérifié car
--    c'est le cas"), déjà tracée dans data->>'statut'='verifie'. Jamais
--    'provisoire' — les filtres existants (statut_caisse <> 'provisoire')
--    les incluent donc naturellement dans tous les agrégats.
--  - employee_id et motif_ecart restent NULL (données non disponibles
--    dans le tableur source) : view_fdj_employee_daily filtre déjà
--    "WHERE employee_id IS NOT NULL", donc l'historique importé n'y
--    apparaît jamais (pas de mauvaise attribution). Le motif NULL est
--    déjà géré côté écran ("Motif non précisé").
--  - tickets_vendus / nb_jeux_comptes / game breakdown restent NULL :
--    non disponibles dans l'import (agrégat caisse uniquement, pas de
--    détail par jeu) — les onglets Jeux et Équipe (per-employee) restent
--    donc natifs uniquement, ce qui est honnête (pas de donnée fabriquée).

CREATE OR REPLACE VIEW view_fdj_shift_facts AS
SELECT
  s.id AS shift_id,
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
  sc.nb_jeux_comptes
FROM fdj_shifts s
LEFT JOIN fdj_cash_controls cc ON cc.shift_id = s.id
LEFT JOIN (
  SELECT shift_id, sum(ventes_qte) AS tickets_vendus, count(*) FILTER (WHERE ventes_qte IS NOT NULL) AS nb_jeux_comptes
  FROM fdj_shift_counts
  GROUP BY shift_id
) sc ON sc.shift_id = s.id

UNION ALL

SELECT
  NULL::uuid AS shift_id,
  h.site,
  h.date,
  h.quart,
  NULL::uuid AS employee_id,
  'valide'::text AS statut_shift,
  CASE WHEN COALESCE((h.data->>'ecart')::numeric, 0) = 0 THEN 'conforme' ELSE 'valide_avec_ecart' END AS statut_caisse,
  (h.data->>'ventes_grattage')::numeric AS ventes_grattage_valeur,
  (h.data->>'caisse_loto')::numeric AS caisse_tirages,
  (h.data->>'total_attendu')::numeric AS caisse_attendue,
  (h.data->>'caisse_reelle')::numeric AS caisse_reelle,
  COALESCE((h.data->>'ecart')::numeric, 0) AS ecart,
  NULL::text AS motif_ecart,
  NULL::numeric AS tickets_vendus,
  NULL::bigint AS nb_jeux_comptes
FROM fdj_imported_history h
WHERE NOT EXISTS (
  SELECT 1 FROM fdj_shifts s2 WHERE s2.site = h.site AND s2.date = h.date AND s2.quart = h.quart
);
