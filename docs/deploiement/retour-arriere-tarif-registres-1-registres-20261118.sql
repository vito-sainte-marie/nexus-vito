-- Retour arrière de 20261117020430_tarif_registres.sql : ne retire que ses propres objets. Ordre de retrait : 6, 5, 4, 3, 2, 1 (jamais l'inverse).
-- PERD toutes les données des 10 registres : perd toutes les règles saisies. Les requêtes d'export en lecture seule ci-dessous sont à jouer d'abord ; conserver l'export hors dépôt.
-- Prérequis : 6, 5, 4, 3 et 2 retirées avant.
-- Export en lecture seule, a faire AVANT le retrait : ce retour arriere perd toutes les regles saisies (une requete par registre, resultat conserve hors depot).
select * from tarif_familles;
select * from tarif_rattachements;
select * from tarif_seuils;
select * from tarif_reglages;
select * from tarif_exceptions;
select * from tarif_prix_decides;
select * from tarif_prix_application;
select * from tarif_regimes_prix;
select * from tarif_controles_reglementaires;
select * from tarif_decisions;
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
