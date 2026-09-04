-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260827213524 · fdj_stock_references_type_check_add_reconciliation
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


alter table fdj_stock_references drop constraint fdj_stock_references_type_check;
alter table fdj_stock_references add constraint fdj_stock_references_type_check
  check (type = any (array['initialisation'::text, 'recomptage'::text, 'reconciliation'::text]));
