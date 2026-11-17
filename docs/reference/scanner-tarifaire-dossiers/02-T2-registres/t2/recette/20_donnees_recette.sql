-- Chargement des données initiales de recette Sainte-Marie, par un gérant simulé du site, sous RLS.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
reset role;
insert into sites (site_id, nom_entreprise, acces_createur_autorise, timezone) values ('vito-sainte-marie', 'ViTO Sainte-Marie (recette)', false, 'America/Martinique');
insert into employees (id, username, nom, role, site_id, compte_test) values ('d0000000-0000-0000-0000-000000000001', 'recette-t2-gerant-sm', 'RecetteT2SM', 'gerant', 'vito-sainte-marie', true);
\i recette_test_donnees_sainte_marie_t2.sql
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', false);
set role authenticated;
select t_egal('60 données de recette chargées sous RLS par le gérant',
  $$select (select count(*) from v_tarif_familles_actifs) || '/' || (select count(*) from v_tarif_rattachements_actifs) || '/' || (select count(*) from v_tarif_seuils_actifs) || '/' ||
    (select count(*) from v_tarif_reglages_actifs) || '/' || (select count(*) from v_tarif_exceptions_actifs) || '/' || (select count(*) from v_tarif_prix_decides_actifs) || '/' ||
    (select count(*) from v_tarif_regimes_prix_actifs) || '/' || (select count(*) from v_tarif_controles_reglementaires_actifs)$$, '24/51/13/4/13/21/1/3');
select t_refuse('61 rechargement : aucune deuxième version active', $$insert into tarif_familles (site, famille_code, libelle) values ('vito-sainte-marie', 'confiserie', 'Confiserie')$$);
reset role;
