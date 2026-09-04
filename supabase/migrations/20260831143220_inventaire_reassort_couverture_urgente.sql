-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260831143220 · inventaire_reassort_couverture_urgente
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table public.inventaire_reassort_interne_regles
  add column if not exists couverture_urgente_jours numeric;

update public.inventaire_reassort_interne_regles
set couverture_urgente_jours = coalesce(couverture_urgente_jours, 0.5)
where mode_calcul = 'couverture_jours';

alter table public.inventaire_reassort_interne_regles
  add constraint inventaire_reassort_couverture_urgente_positive
  check (couverture_urgente_jours is null or couverture_urgente_jours >= 0) not valid;
alter table public.inventaire_reassort_interne_regles validate constraint inventaire_reassort_couverture_urgente_positive;
