-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731122117 · lock_down_simulator_function_execute
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Le simulateur ne doit être déclenchable que par pg_cron (rôle postgres) —
-- jamais directement par un client anon/authenticated.
revoke all on function public.nexus_simulate_cash_sale(text) from public, anon, authenticated;
