-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260821122028 · inventaire_seuils_unique_site_categorie_cle
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 20/08/2026, Sprint 5 : permet un upsert propre (site, categorie_id, cle)
-- depuis l'écran manager — même convention que inventaire_regles_produit
-- (contrainte unique site,produit_id) déjà utilisée pour ses upserts.
-- categorie_id est NULLABLE sur cette table (extension future non utilisée
-- par ce sprint, voir Data Dictionary) — l'unicité ne porte donc que sur
-- les lignes où categorie_id est renseigné, cas exclusif traité par ce lot.
alter table inventaire_seuils
  add constraint inventaire_seuils_site_categorie_cle_key unique (site, categorie_id, cle);
