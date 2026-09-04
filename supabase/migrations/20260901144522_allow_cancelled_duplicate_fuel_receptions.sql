-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260901144522 · allow_cancelled_duplicate_fuel_receptions
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


alter table public.carburant_reception_visites
  drop constraint if exists carburant_reception_visites_statut_check;

alter table public.carburant_reception_visites
  add constraint carburant_reception_visites_statut_check
  check (statut = any (array[
    'en_cours'::text,
    'terminee'::text,
    'terminee_avec_derogation'::text,
    'annulee_doublon'::text
  ]));
