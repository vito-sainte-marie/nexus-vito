-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260811123015 · ajouter_secteurs_configurables_sites
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Secteurs configurables (11/08/2026, audit stratégique Brief/Rapport de Direction) :
-- Brief NEXUS et Rapport NEXUS s'organisent désormais autour d'une liste de
-- "secteurs" (Carburants, Commerce, Marge, FDJ, Opérations, Équipe pour une
-- station-service) plutôt que d'une Boussole à 5 axes codée en dur. Cette
-- liste doit être configurable par métier (station-service aujourd'hui,
-- boulangerie/restaurant/commerce demain) sans jamais coder un Brief
-- différent par métier — même principe que station_config.raccourcis
-- (catalogue JS + config nullable par site, v2.30).
--
-- type_commerce : identité métier du site, détermine le PRESET de secteurs
-- par défaut (voir SECTEURS_PRESET_METIER dans nexus-secteurs-catalogue.js).
-- NOT NULL avec défaut 'station-service' : aucun site existant ne doit se
-- retrouver sans secteurs à l'activation de cette colonne.
--
-- secteurs : override explicite (tableau d'ids de secteurs) si un site sort
-- du preset de son métier. NULL = utilise le preset de type_commerce tel
-- quel (comportement par défaut, comme raccourcis=NULL => RACCOURCIS_DEFAUT).
alter table public.sites
  add column type_commerce text not null default 'station-service',
  add column secteurs jsonb null;

comment on column public.sites.type_commerce is 'Identité métier du site (ex. station-service, boulangerie, restaurant, commerce) — détermine le preset de secteurs par défaut de Brief/Rapport NEXUS (nexus-secteurs-catalogue.js).';
comment on column public.sites.secteurs is 'Override optionnel de la liste de secteurs activés (tableau JSON d''ids) — NULL = utilise le preset par défaut du type_commerce.';
