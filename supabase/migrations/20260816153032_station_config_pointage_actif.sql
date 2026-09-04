-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260816153032 · station_config_pointage_actif
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Pointage des employés — interrupteur global par site (16/08/2026, demande
-- de Frédéric : "mets une option dans les paramètres station pour activer ou
-- non le pointage des employés").
-- Distinct de station_config.manager_pointage_requis (qui, lui, ne dispense
-- QUE le manager d'un pointage par ailleurs actif pour les employés) : ici,
-- pointage_actif est un interrupteur maître — quand il est à FALSE, PERSONNE
-- (employé ou manager) ne pointe plus, et la fonctionnalité Pointage
-- disparaît de tous les points d'entrée (accueil, recherche NEXUS), sans
-- jamais bloquer l'accès aux autres écrans en attendant un pointage d'arrivée
-- qui ne peut plus arriver.
-- DÉFAUT TRUE : préserve à l'identique le comportement de tous les sites
-- existants (Pointage reste actif tant qu'un manager ne le désactive pas
-- explicitement depuis Paramètres Station).
alter table station_config
  add column if not exists pointage_actif boolean not null default true;

comment on column station_config.pointage_actif is
  'Interrupteur global (16/08/2026) : si FALSE, le pointage employé est entièrement désactivé pour ce site (aucun blocage d''accès, aucune entrée visible). Distinct de manager_pointage_requis (qui ne concerne que le manager quand Pointage reste actif).';
