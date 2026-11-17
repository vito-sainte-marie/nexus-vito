-- Preuve ciblée : un compte désactivé (employees.actif = false) garde-t-il l'accès aux registres T2 ?
-- Base JETABLE seulement. Chaque ligne : « <n> <cas> : ACCES » ou « <n> <cas> : BLOQUE (raison) ».
-- Jouée deux fois par executer_recette_locale.sh : sans puis avec 20261118100300_tarif_registres_comptes_desactives.sql.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\set G '''e0000000-0000-0000-0000-000000000001'''
\set D '''e0000000-0000-0000-0000-000000000002'''
\set M '''e0000000-0000-0000-0000-000000000003'''
\set C '''e0000000-0000-0000-0000-000000000004'''
\set T '''e0000000-0000-0000-0000-000000000005'''
create or replace function t_acces(n text, q text) returns text language plpgsql as $$
begin execute q; return n || ' : ACCES';
exception when others then return n || ' : BLOQUE (' || left(sqlerrm, 80) || ')'; end $$;
grant execute on function t_acces(text, text) to authenticated;

insert into sites (site_id, nom_entreprise, acces_createur_autorise, timezone) values ('site-p', 'Site preuve', true, 'America/Martinique');
insert into employees (id, username, nom, role, site_id, est_createur, actif, compte_test) values
  (:G, 'p_gerant_actif', 'Gérant actif', 'gerant', 'site-p', false, true, false),
  (:D, 'p_gerant_desactive', 'Gérant désactivé', 'gerant', 'site-p', false, true, false),
  (:M, 'p_manager_desactive', 'Manager désactivé', 'manager', 'site-p', false, true, false),
  (:C, 'p_createur_desactive', 'Créateur désactivé', 'gerant', 'site-p', true, true, false),
  (:T, 'p_compte_test_desactive', 'Compte test désactivé', 'gerant', 'site-p', false, true, true);
insert into produits_appel (site, article) values ('site-p', 'Produit preuve');

-- Mise en place par le gérant actif, comptes encore actifs.
select set_config('request.jwt.claim.sub', :G, false); set role authenticated;
insert into tarif_familles (site, famille_code, libelle) values ('site-p', 'confiserie', 'Confiserie');
insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-p', 'Article preuve', 'changement', 2.00);
reset role;

select id as id_prix from tarif_prix_decides where article = 'Article preuve' \gset
-- Désactivation (geste d'administration, hors RLS).
update employees set actif = false where id in (:D, :M, :C, :T);

select set_config('request.jwt.claim.sub', :D, false); set role authenticated;
select t_acces('D1 gérant désactivé lit les familles', $$select 1 / count(*) from tarif_familles$$);
select t_acces('D2 gérant désactivé lit la vue des exceptions effectives', $$select 1 / count(*) from v_tarif_exceptions_effectives$$);
select t_acces('D2b gérant désactivé lit la vue des incohérences et des prix actifs', $$select 1 / count(*) from v_tarif_prix_decides_actifs$$);
select t_acces('D3 gérant désactivé crée une famille', $$insert into tarif_familles (site, famille_code, libelle) values ('site-p', 'jus', 'Jus')$$);
select t_acces('D4 gérant désactivé décide un prix', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-p', 'Autre article', 'changement', 3.00)$$);
select t_acces('D5 gérant désactivé annule une famille', $$with u as (update tarif_familles set annule_le = now(), annule_par = 'e0000000-0000-0000-0000-000000000002', motif_annulation = 'preuve' where famille_code = 'confiserie' returning 1) select 1 / count(*) from u$$);
reset role; select set_config('request.jwt.claim.sub', :M, false); set role authenticated;
select t_acces('M1 manager désactivé propose une exception candidate', $$insert into tarif_exceptions (site, article, type, statut, motif) values ('site-p', 'Article preuve', 'produit_appel', 'candidate', 'preuve')$$);
select t_acces('M2 manager désactivé déclare une saisie de prix', format($$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) values ('site-p', %L, 'saisie_declaree', '2026-11-18')$$, :'id_prix'));
reset role; select set_config('request.jwt.claim.sub', :C, false); set role authenticated;
select t_acces('C1 créateur désactivé lit un site autorisé', $$select 1 / count(*) from tarif_familles$$);
reset role; select set_config('request.jwt.claim.sub', :T, false); set role authenticated;
select t_acces('T1 compte de test désactivé lit les familles', $$select 1 / count(*) from tarif_familles$$);
select t_acces('T2 compte de test désactivé crée un réglage', $$insert into tarif_reglages (site, parametre, valeur) values ('site-p', 'a6_montant_minimal', 5)$$);
reset role; select set_config('request.jwt.claim.sub', :G, false); set role authenticated;
select t_acces('G1 témoin : gérant actif lit les familles', $$select 1 / count(*) from tarif_familles$$);
select t_acces('G2 témoin : gérant actif crée un réglage', $$insert into tarif_reglages (site, parametre, valeur) values ('site-p', 'palier_ttc', 0.05)$$);
reset role;
-- Réactivation : l'accès doit revenir, sans autre geste.
update employees set actif = true where id = :D;
select set_config('request.jwt.claim.sub', :D, false); set role authenticated;
select t_acces('R1 gérant réactivé lit les familles', $$select 1 / count(*) from tarif_familles$$);
reset role;
