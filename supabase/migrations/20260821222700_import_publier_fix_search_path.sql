-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821222700 · import_publier_fix_search_path
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter function public.import_publier_ventes(uuid) set search_path = public;
alter function public.import_publier_stock(uuid) set search_path = public;
alter function public.import_publier_panier(uuid) set search_path = public;
