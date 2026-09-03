-- NEXUS — préfixe des onglets mensuels du classeur de planning
-- 03/09/2026, demande de Frédéric.
--
-- Le classeur « PLANNING ENERGY 2026 » porte un onglet par site ET par mois :
-- SMU09 pour septembre à Vito Sainte-Marie Usine, SMU10 pour octobre, etc.
-- NEXUS ne devine JAMAIS ce préfixe (article 5 : vérité avant certitude) :
-- il est déclaré une fois dans Paramètres Station, et l'onglet lu est
-- exactement <prefixe> || <mois sur 2 chiffres>. Sans préfixe déclaré,
-- aucune synchronisation de planning n'est proposée.

alter table public.station_config
  add column if not exists planning_onglet_prefixe text;

comment on column public.station_config.planning_onglet_prefixe is
  'Préfixe des onglets mensuels du classeur de planning (ex. "SMU" -> SMU09, SMU10). L''onglet lu est <prefixe><mois sur 2 chiffres>, jamais deviné.';
