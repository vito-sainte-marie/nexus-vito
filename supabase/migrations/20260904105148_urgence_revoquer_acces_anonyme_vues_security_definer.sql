-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260904105148 · urgence_revoquer_acces_anonyme_vues_security_definer
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- URGENCE (04/09/2026) — fermeture de l'accès anonyme aux vues SECURITY DEFINER.
-- Liste explicite de 17 vues. Aucun traitement global ni dynamique.

revoke all privileges on public.nexus_stock_etat_v2 from anon;
revoke all privileges on public.nexus_stock_etat_v3 from anon;
revoke all privileges on public.v_caisse_ecart_a_traiter from anon;
revoke all privileges on public.view_fdj_daily_summary from anon;
revoke all privileges on public.view_fdj_discrepancy_daily from anon;
revoke all privileges on public.view_fdj_employee_daily from anon;
revoke all privileges on public.view_fdj_employee_price_tier_daily from anon;
revoke all privileges on public.view_fdj_game_daily from anon;
revoke all privileges on public.view_fdj_game_daily_mouvements from anon;
revoke all privileges on public.view_fdj_game_daily_ventes from anon;
revoke all privileges on public.view_fdj_monthly_summary from anon;
revoke all privileges on public.view_fdj_price_tier_daily from anon;
revoke all privileges on public.view_fdj_shift_facts from anon;
revoke all privileges on public.view_fdj_weekly_summary from anon;
revoke all privileges on public.view_fdj_yearly_summary from anon;
revoke all privileges on public.view_inventaire_dernier_controle_produit from anon;

-- Ceinture et bretelles : PUBLIC ne détenait aucun droit sur ces vues au
-- moment du correctif (vérifié), mais on le retire explicitement pour que
-- `anon`, membre de PUBLIC, ne puisse jamais en hériter indirectement.
revoke all privileges on public.nexus_stock_etat_v2 from public;
revoke all privileges on public.nexus_stock_etat_v3 from public;
revoke all privileges on public.v_caisse_ecart_a_traiter from public;
revoke all privileges on public.view_fdj_daily_summary from public;
revoke all privileges on public.view_fdj_discrepancy_daily from public;
revoke all privileges on public.view_fdj_employee_daily from public;
revoke all privileges on public.view_fdj_employee_price_tier_daily from public;
revoke all privileges on public.view_fdj_game_daily from public;
revoke all privileges on public.view_fdj_game_daily_mouvements from public;
revoke all privileges on public.view_fdj_game_daily_ventes from public;
revoke all privileges on public.view_fdj_monthly_summary from public;
revoke all privileges on public.view_fdj_price_tier_daily from public;
revoke all privileges on public.view_fdj_shift_facts from public;
revoke all privileges on public.view_fdj_weekly_summary from public;
revoke all privileges on public.view_fdj_yearly_summary from public;
revoke all privileges on public.view_inventaire_dernier_controle_produit from public;

-- employees_public : elle est auto-modifiable (is_updatable = YES) et
-- SECURITY DEFINER. Les droits d'écriture accordés à anon ouvraient donc,
-- en théorie, la modification et la suppression de lignes de `employees`,
-- avec cascade sur shifts et mission_progress. On ne conserve QUE le SELECT,
-- dont l'écran de connexion a besoin — provisoirement, cette vue devant être
-- remplacée par une authentification non énumérable.
revoke insert, update, delete, truncate, references, trigger
  on public.employees_public from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.employees_public from authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.employees_public from public;
