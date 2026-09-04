-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810014016 · fdj_pilotage_phase_a_reception_bloque
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


-- NEXUS FDJ Pilotage — Phase A (09/08/2026, audit "Moteur de clairvoyance
-- manager") : fiabiliser la dernière brique stock avant de construire les
-- statistiques. Trois ajouts : emplacement "zone bloquée" pour les
-- retraits/blocages (§3, §18), colonne "source" pour tracer la provenance
-- d'une réception (transporteur), et un point d'entrée pour l'événement
-- "Réception FDJ" (déjà couvert par type_mouvement='reception', qui
-- existait sans jamais avoir été branché à un écran).

alter table fdj_locations drop constraint fdj_locations_type_check;
alter table fdj_locations add constraint fdj_locations_type_check
  check (type = any (array['bureau','caisse','reserve','autre','bloque']));

insert into fdj_locations (site, type, nom, actif)
values ('vito-sainte-marie', 'bloque', 'Zone bloquée / retrait', true);

alter table fdj_stock_movements add column if not exists source text;
comment on column fdj_stock_movements.source is 'Provenance libre d''un mouvement de réception (ex. transporteur, n° de bon de livraison) — §43 audit clairvoyance FDJ.';
