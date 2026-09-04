-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260811015746 · carburant_releves_deux_cuves_go
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Correction suite à la lecture du fichier réel de Frédéric
-- ("Variation carburant 2026.xlsx") : le Gasoil est réparti sur DEUX cuves
-- physiques distinctes (CUVE 20000 (1) + CUVE 10000 (2)), jaugées et
-- relevées séparément, puis additionnées pour le calcul. SP95 et GNR n'ont
-- chacun qu'une seule cuve. On capture les deux relevés Gasoil séparément
-- (traçabilité par cuve, utile pour détecter une fuite sur une cuve
-- précise) plutôt qu'un seul total qui perdrait cette information réelle.
alter table carburant_releves
  rename column stock_reel_go to stock_reel_go_cuve1;
alter table carburant_releves
  add column if not exists stock_reel_go_cuve2 numeric;
