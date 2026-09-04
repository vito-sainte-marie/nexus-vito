-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260731121835 · fix_current_normalized_sales_security_invoker
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Corrige un risque réel détecté par l'audit de sécurité Supabase :
-- une vue sans security_invoker s'exécute avec les droits de son
-- créateur, ce qui peut contourner le RLS deny-all de normalized_sales.
alter view public.current_normalized_sales set (security_invoker = true);
revoke all on public.current_normalized_sales from anon, authenticated;
revoke all on public.normalized_products, public.normalized_sales, public.normalized_stock, public.normalized_cash_sessions from anon, authenticated;
revoke all on public.raw_sales, public.raw_products, public.raw_stock_movements, public.raw_cash_sessions from anon, authenticated;
revoke all on public.api_keys, public.api_logs, public.integration_sources, public.integration_status from anon, authenticated;
revoke all on public.normalization_state, public.integration_errors, public.synchronization_history from anon, authenticated;
revoke all on public.advisor_inputs, public.advisor_logs from anon, authenticated;
