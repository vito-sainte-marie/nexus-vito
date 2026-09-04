-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260827223651 · carburant_commande_reserve_dynamique
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


update station_config
set carburant_commande_config = (carburant_commande_config - 'stock_securite_jours')
  || jsonb_build_object('stock_securite_jours_normal', 2, 'stock_securite_jours_fin_mois', 1)
where site = 'vito-sainte-marie';
