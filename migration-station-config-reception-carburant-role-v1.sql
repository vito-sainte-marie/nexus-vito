-- ============================================================
-- NEXUS — station_config.reception_carburant_role (14/08/2026)
-- ============================================================
-- Demande de Frédéric : qui, parmi employé et/ou manager, effectue la
-- réception carburant (jaugeage/BL) sur ce site ? Réglage par site,
-- jamais codé en dur — même esprit que manager_pointage_requis.
-- Défaut 'employe' : préserve le comportement déjà livré (mini-carte
-- accueil employé visible par défaut, accès manager via Explorer NEXUS
-- uniquement comme catalogue) tant que le manager n'a rien choisi.
--
-- Appliquée directement sur le projet Supabase (uzhjpqpctpvxytxpxoqz)
-- le 14/08/2026 — ce fichier documente la migration pour l'historique
-- du dépôt, au même titre que migration-station-config-manager-
-- pointage-v1.sql.
-- ============================================================

ALTER TABLE station_config
  ADD COLUMN IF NOT EXISTS reception_carburant_role text NOT NULL DEFAULT 'employe';

ALTER TABLE station_config
  ADD CONSTRAINT station_config_reception_carburant_role_check
  CHECK (reception_carburant_role IN ('employe', 'manager', 'les_deux'));

COMMENT ON COLUMN station_config.reception_carburant_role IS
  'Qui effectue la réception carburant sur ce site : employe (défaut, mini-carte accueil employé), manager (carte dédiée accueil manager), ou les_deux (les deux visibles). Ne modifie jamais la portée Explorer NEXUS (catalogue manager, toujours complet).';
