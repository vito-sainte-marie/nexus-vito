-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260827211501 · fdj_stock_movements_methode_reconstituee_manager
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- 27/08/2026, demande de Frédéric : synchronisation contrôlée Appro <-> Activation
-- côté correction manager (NEXUS-FDJ-Manager-v1.html, enregistrerEdition()).
-- Additif uniquement (Article 11) : réutilise fdj_stock_movements.methode_identification
-- (déjà utilisé pour distinguer 'quantite'/'scan'/'saisie_manuelle'/'implicite_appro')
-- plutôt que d'inventer une colonne parallèle. Cette nouvelle valeur distingue une
-- activation RECONSTITUÉE depuis une correction manager après coup (jamais
-- automatique, toujours sous confirmation explicite) d'une activation directement
-- observée en direct par l'employé ('quantite'/'scan') ou déduite à la clôture du
-- même quart ('implicite_appro').
alter table fdj_stock_movements drop constraint fdj_stock_movements_methode_identification_check;
alter table fdj_stock_movements add constraint fdj_stock_movements_methode_identification_check
  check (methode_identification = any (array['quantite'::text, 'scan'::text, 'saisie_manuelle'::text, 'implicite_appro'::text, 'reconstituee_correction_manager'::text]));
