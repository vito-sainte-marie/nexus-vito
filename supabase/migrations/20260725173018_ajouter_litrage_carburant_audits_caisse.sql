-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260725173018 · ajouter_litrage_carburant_audits_caisse
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

alter table audits_caisse
  add column litrage_gazole numeric,
  add column litrage_sp95 numeric,
  add column litrage_gnr numeric,
  add column prix_gazole numeric,
  add column prix_sp95 numeric,
  add column prix_gnr numeric;
