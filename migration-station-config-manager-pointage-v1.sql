-- ============================================================
-- NEXUS — station_config.manager_pointage_requis (24/07/2026)
-- ============================================================
-- Demande de Frédéric : le pointage (arrivée/pause/départ) n'est pas
-- systématiquement pertinent pour un manager selon la station — doit
-- rester un réglage par site, jamais codé en dur dans le menu.
-- Défaut à FALSE : par défaut, le manager n'est PAS tenu de pointer.
-- N'affecte que le rôle manager/gérant — les employés continuent de
-- pointer dans tous les cas, indépendamment de ce réglage.
-- ============================================================

ALTER TABLE station_config
  ADD COLUMN IF NOT EXISTS manager_pointage_requis boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN station_config.manager_pointage_requis IS
  'Si true, le manager/gérant de ce site doit pointer comme un employé (Pointage actif dans le menu). Si false (défaut), Pointage reste grisé pour lui — les employés pointent dans tous les cas.';
