-- ============================================================
-- Migrations appliquées le 21/08/2026 (déjà en production Supabase,
-- projet uzhjpqpctpvxytxpxoqz) pour la refonte Import de données.
-- Fournies ici pour la traçabilité locale du dépôt.
-- ============================================================

-- 1) import_pipeline_fondations : 7 tables (import_batches,
--    import_rows_raw, import_mappings, import_row_results,
--    import_quality_reports, import_product_aliases,
--    import_audit_log) + RLS site/role manager-gerant.
--    Voir Data Dictionary v2.206 pour le DDL complet (non reproduit
--    ici pour éviter un fichier dupliqué en cas de dérive) — le DDL
--    exact appliqué est consultable via `list_migrations` / historique
--    Supabase du projet.

-- 2) import_pipeline_publication_atomique : fonctions Postgres
--    import_publier_ventes(uuid) / import_publier_stock(uuid) /
--    import_publier_panier(uuid) — publication atomique (transaction
--    unique), SECURITY INVOKER (RLS réelle de l'appelant conservée).

-- 3) import_publier_stock_exclure_identiques : correctif — exclut
--    aussi 'connue_identique' de l'insertion dans stock_releves
--    (append-only sans contrainte d'unicité) pour garantir
--    l'idempotence sur un fichier réimporté à l'identique (I02).

-- 4) import_publier_fix_search_path : fixe search_path=public sur les
--    3 fonctions de publication (bonne pratique de sécurité).

-- Le SQL exact de chaque migration est dans l'historique Supabase du
-- projet (apply_migration) — ce fichier sert de sommaire, pas de
-- source de vérité (la source de vérité est la base elle-même).
