-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830102529 · inventaire_v2_devitoisation_site_defaults
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Inventaire V2 — dé-Vito-tisation (29/08/2026, demande explicite de Frédéric,
-- point 10 de son audit). Les deux tables neuves de la doctrine "Missions"
-- avaient hérité, comme la quasi-totalité du schéma NEXUS, d'un
-- DEFAULT 'vito-sainte-marie' sur la colonne site. Ce n'est pas cassant
-- aujourd'hui (le code transmet toujours site explicitement — vérifié dans
-- nexus-inventaire-missions-donnees.js::genererOuChargerMissions et
-- nexus-inventaire-mission-rules-donnees.js::creerMissionRule /
-- installerConfigurationDefautNexus, article 5), mais une insertion future
-- qui oublierait site s'attribuerait silencieusement à Sainte-Marie au lieu
-- d'échouer — exactement le risque multi-site que Frédéric a signalé.
--
-- site reste NOT NULL : on ne retire QUE la valeur par défaut, pas la
-- contrainte. Une absence de site provoquera désormais une erreur explicite
-- (violation NOT NULL) plutôt qu'une attribution silencieuse.
alter table public.inventaire_mission_rules alter column site drop default;
alter table public.inventaire_missions alter column site drop default;
