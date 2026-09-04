-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260815215139 · fdj_cash_controls_constat_origine_et_demande_correction
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 16/08/2026, demande de Frédéric : règles de permission sur l'écart de
-- caisse FDJ. La caissière voit toujours son écart (avant, ce module le
-- masquait jusqu'à validation manager — v2.30 ancien comportement, inversé
-- ici). Elle peut le corriger elle-même tant que son quart n'est pas encore
-- validé. Après validation, elle ne modifie plus rien directement : elle
-- peut seulement "demander une correction" (nouvelle alerte tracée,
-- ci-dessous), le manager régularise ensuite sans jamais effacer le constat
-- d'origine qu'elle a soumis — d'où les 2 nouvelles colonnes figées.

alter table fdj_cash_controls
  add column caisse_reelle_origine numeric,
  add column ecart_origine numeric;

-- Backfill : pour toute ligne déjà en base, la valeur actuelle EST son
-- propre constat d'origine (aucune régularisation manager n'existait avant
-- ce lot pour la distinguer).
update fdj_cash_controls
set caisse_reelle_origine = caisse_reelle, ecart_origine = ecart
where caisse_reelle_origine is null;

alter table fdj_alertes drop constraint fdj_alertes_type_check;
alter table fdj_alertes add constraint fdj_alertes_type_check
  check (type = any (array[
    'stock_initial_modifie'::text,
    'activation_sans_carnet_confie'::text,
    'chaine_interrompue'::text,
    'continuite_stock_a_verifier'::text,
    'correction_caisse_demandee'::text
  ]));
