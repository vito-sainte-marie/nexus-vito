-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830204509 · inventaire_categories_rotation_intelligente
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_categories
  add column if not exists mode_comptage text,
  add column if not exists nombre_references_rotation integer;

alter table public.inventaire_categories
  drop constraint if exists inventaire_categories_mode_comptage_check;
alter table public.inventaire_categories
  add constraint inventaire_categories_mode_comptage_check
  check (mode_comptage is null or mode_comptage in ('fixe','rotation_intelligente'));

alter table public.inventaire_categories
  drop constraint if exists inventaire_categories_nombre_references_rotation_check;
alter table public.inventaire_categories
  add constraint inventaire_categories_nombre_references_rotation_check
  check (nombre_references_rotation is null or nombre_references_rotation > 0);
