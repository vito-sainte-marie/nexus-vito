-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810014740 · fdj_pilotage_phase_b_indexes
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- NEXUS FDJ Pilotage — Phase B (§41 de l'audit "Moteur de clairvoyance
-- manager") : indexer date, site, game_id, employee_id, shift_id,
-- type_mouvement avant de brancher les vues d'agrégation dessus.

create index if not exists idx_fdj_shifts_employee on fdj_shifts(employee_id);
create index if not exists idx_fdj_shift_counts_game on fdj_shift_counts(game_id);
create index if not exists idx_fdj_stock_movements_site_created on fdj_stock_movements(site, created_at);
create index if not exists idx_fdj_stock_movements_game on fdj_stock_movements(game_id);
create index if not exists idx_fdj_stock_movements_type on fdj_stock_movements(type_mouvement);
create index if not exists idx_fdj_stock_movements_employee on fdj_stock_movements(employee_id);
