-- Retour arrière de 20261117020430_tarif_registres.sql : ne retire que ses propres objets. Ordre de retrait : 6, 5, 4, 3, 2, 1 (jamais l'inverse).
-- PERD toutes les données des 10 registres : exporter chaque table avant (select * from <table>) et conserver l'export hors dépôt.
-- Prérequis : 6, 5, 4, 3 et 2 retirées avant.
begin;
drop table if exists tarif_decisions;
drop table if exists tarif_controles_reglementaires;
drop table if exists tarif_regimes_prix;
drop table if exists tarif_prix_application;
drop table if exists tarif_prix_decides;
drop table if exists tarif_exceptions;
drop table if exists tarif_reglages;
drop table if exists tarif_seuils;
drop table if exists tarif_rattachements;
drop table if exists tarif_familles;
drop function if exists tarif_cle_reference(text, text);
commit;
