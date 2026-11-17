-- Recette des registres T2 sur base JETABLE locale. Chaque ligne de résultat commence par OK ou ECHEC.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\set gA '''a0000000-0000-0000-0000-000000000001'''
\set mA '''a0000000-0000-0000-0000-000000000002'''
\set cA '''a0000000-0000-0000-0000-000000000003'''
\set gB '''b0000000-0000-0000-0000-000000000001'''
\set mB '''b0000000-0000-0000-0000-000000000002'''
\set cr '''c0000000-0000-0000-0000-000000000001'''

-- Données de recette (superutilisateur)
insert into sites (site_id, nom_entreprise, acces_createur_autorise, timezone) values ('site-a', 'Site A', true, 'America/Martinique'), ('site-b', 'Site B', false, 'America/Martinique'), ('site-c', 'Site créateur', false, 'Europe/Paris');
insert into employees (id, username, nom, role, site_id, est_createur) values
  (:gA, 'ga', 'Gérant A', 'gerant', 'site-a', false), (:mA, 'ma', 'Manager A', 'manager', 'site-a', false), (:cA, 'ca', 'Caissier A', 'caissier', 'site-a', false),
  (:gB, 'gb', 'Gérant B', 'gerant', 'site-b', false), (:mB, 'mb', 'Manager B', 'manager', 'site-b', false), (:cr, 'cr', 'Créateur', 'gerant', 'site-c', true);
insert into produits_appel (site, article, ajoute_le) values ('site-a', 'Glacons Vito 5 kg', '2026-07-14 12:08:29+00'), ('site-a', 'Biere Bavaria 8/6 Blonde 50cl -24P', '2026-07-29 02:38:34+00'),
  ('site-b', 'Produit B', now());

create function t_ok(n text, q text) returns text language plpgsql as $$
begin execute q; return 'OK     ' || n; exception when others then return 'ECHEC  ' || n || ' : ' || sqlerrm; end $$;
create function t_refuse(n text, q text) returns text language plpgsql as $$
begin execute q; return 'ECHEC  ' || n || ' : accepté alors qu''il devait être refusé';
exception when others then return 'OK     ' || n || ' (refusé : ' || left(sqlerrm, 90) || ')'; end $$;
create function t_egal(n text, q text, attendu text) returns text language plpgsql as $$
declare v text;
begin execute q into v; if v is not distinct from attendu then return 'OK     ' || n; end if;
  return 'ECHEC  ' || n || ' : obtenu ' || coalesce(v, 'null') || ', attendu ' || attendu;
exception when others then return 'ECHEC  ' || n || ' : ' || sqlerrm; end $$;
grant execute on function t_ok(text, text), t_refuse(text, text), t_egal(text, text, text) to authenticated, anon, service_role;

\echo '--- Isolation et rôles (familles)'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('01 gérant A crée une famille', $$insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'confiserie', 'Confiserie')$$);
select t_ok('01b gérant A crée la famille sodas_2l', $$insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'sodas_2l', 'Sodas 2 L')$$);
select t_refuse('05 gérant A ne crée rien pour le site B', $$insert into tarif_familles (site, famille_code, libelle) values ('site-b', 'x', 'X')$$);
select t_refuse('06 auteur imposé : saisi_par d''un autre refusé', $$insert into tarif_familles (site, famille_code, libelle, saisi_par) values ('site-a', 'bieres', 'Bières', 'a0000000-0000-0000-0000-000000000002')$$);
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('02 manager A ne crée pas de famille', $$insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'jus', 'Jus')$$);
select t_egal('02b manager A lit les familles de son site', $$select count(*) from tarif_familles$$, '2');
reset role; select set_config('request.jwt.claim.sub', :cA, false); set role authenticated;
select t_egal('03 caissier A ne voit aucune ligne', $$select count(*) from tarif_familles$$, '0');
select t_refuse('03b caissier A ne crée rien', $$insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'jus', 'Jus')$$);
reset role; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_egal('04 gérant B ne voit pas les familles du site A', $$select count(*) from tarif_familles$$, '0');
select t_ok('04b gérant B crée sa propre famille confiserie', $$insert into tarif_familles (site, famille_code, libelle) values ('site-b', 'confiserie', 'Confiserie B')$$);
reset role; set role anon;
select t_refuse('07 anon : aucun accès', $$select count(*) from tarif_familles$$);
reset role;

\echo '--- Versions, ajout seul, annulation'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_refuse('08 deuxième version sans remplacer l''active', $$insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'confiserie', 'Confiserie bis')$$);
select t_ok('09 nouvelle version qui remplace l''active', $$insert into tarif_familles (site, famille_code, libelle, remplace_id) select 'site-a', 'confiserie', 'Confiserie hors exceptions', id from v_tarif_familles_actifs where famille_code = 'confiserie'$$);
select t_egal('09b une seule version active, la nouvelle', $$select string_agg(libelle, '|') from v_tarif_familles_actifs where famille_code = 'confiserie'$$, 'Confiserie hors exceptions');
select t_refuse('10 remplacer une version déjà remplacée', $$insert into tarif_familles (site, famille_code, libelle, remplace_id) select 'site-a', 'confiserie', 'Z', id from tarif_familles where libelle = 'Confiserie'$$);
select t_refuse('12 UPDATE d''une colonne métier', $$update tarif_familles set libelle = 'Pirate' where famille_code = 'confiserie'$$);
select t_refuse('13 DELETE', $$delete from tarif_familles where famille_code = 'confiserie'$$);
select t_ok('14 annulation de la version active par le gérant', $$update tarif_familles set annule_le = now(), annule_par = 'a0000000-0000-0000-0000-000000000001', motif_annulation = 'recette' where libelle = 'Confiserie hors exceptions'$$);
select t_egal('14b la version précédente redevient active (règle actives de Produits)', $$select string_agg(libelle, '|') from v_tarif_familles_actifs where famille_code = 'confiserie'$$, 'Confiserie');
select t_refuse('14c annulation sans motif', $$update tarif_familles set annule_le = now(), annule_par = 'a0000000-0000-0000-0000-000000000001' where libelle = 'Sodas 2 L'$$);
select t_egal('15 une annulation ne se défait pas', $$with u as (update tarif_familles set annule_le = null, annule_par = null, motif_annulation = null where libelle = 'Confiserie hors exceptions' returning 1) select count(*) from u$$, '0');
reset role; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
reset role;
-- 11 bis : la cible d'un autre site est invisible et refusée (id lu par le superutilisateur, puis tentative par B).
select id as id_famille_a from tarif_familles where site = 'site-a' and libelle = 'Confiserie' \gset
select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_refuse('11b remplacer une version du site A depuis le site B', format($$insert into tarif_familles (site, famille_code, libelle, remplace_id) values ('site-b', 'confiserie', 'Vol', %L)$$, :'id_famille_a'));
reset role;

\echo '--- Rattachements et seuils'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('16 rattachement d''un rayon à une famille active', $$insert into tarif_rattachements (site, portee, rayon, famille_code) values ('site-a', 'rayon', 'Confiserie', 'confiserie')$$);
select t_refuse('16b rattachement vers une famille inconnue', $$insert into tarif_rattachements (site, portee, rayon, famille_code) values ('site-a', 'rayon', 'Bières', 'bieres')$$);
select t_refuse('16c rattachement par rayon avec une référence', $$insert into tarif_rattachements (site, portee, rayon, article, famille_code) values ('site-a', 'rayon', 'Sodas', 'Sprite 2l', 'sodas_2l')$$);
select t_ok('16d rattachement d''une référence par code-barres', $$insert into tarif_rattachements (site, portee, code_barres, famille_code) values ('site-a', 'reference', '2292084000054', 'sodas_2l')$$);
select t_ok('17 seuil validé de la confiserie (objectif 50 %)', $$insert into tarif_seuils (site, niveau, cible_niveau, cible, statut_cible) values ('site-a', 'famille', 'confiserie', 0.50, 'valide')$$);
select t_ok('17b seuil sodas 2 L validé 41 / 42 %', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum, cible, statut_cible) values ('site-a', 'famille', 'sodas_2l', 0.41, 'valide', 0.42, 'valide')$$);
select t_refuse('17c seuil sans statut', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum) values ('site-a', 'rayon', 'Jus', 0.41)$$);
select t_refuse('18 minimum supérieur à la cible', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum, cible, statut_cible) values ('site-a', 'rayon', 'Jus', 0.50, 'indicatif', 0.40, 'indicatif')$$);
select t_refuse('18b statut de seuil inconnu', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum) values ('site-a', 'rayon', 'Jus', 0.41, 'presque')$$);
select t_refuse('18c seuil de famille inconnue', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum) values ('site-a', 'famille', 'inconnue', 0.41, 'indicatif')$$);
select t_ok('18d seuil indicatif de rayon', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum, cible, statut_cible) values ('site-a', 'rayon', 'Jus de fruits et légumes', 0.41, 'indicatif', 0.49, 'a_l_etude')$$);
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('19 manager ne crée pas de seuil', $$insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum) values ('site-a', 'rayon', 'Chips', 0.41, 'indicatif')$$);
reset role;

\echo '--- Exceptions'
select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_ok('20 manager propose une exception candidate', $$insert into tarif_exceptions (site, article, type, statut, motif) values ('site-a', 'Bonbon Menthise 250G - 29P', 'produit_appel', 'candidate', 'menthe à l''unité, à confirmer')$$);
select t_refuse('21 manager ne valide pas une exception', $$insert into tarif_exceptions (site, code_barres, type, statut, motif) values ('site-a', '3289090001938', 'pack', 'validee', 'pack Chanflor')$$);
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('22 gérant valide le pack Chanflor', $$insert into tarif_exceptions (site, code_barres, type, statut, motif) values ('site-a', '3289090001938', 'pack', 'validee', 'pack Chanflor 1,5 L × 6')$$);
select t_ok('22b gérant valide le Floup avec condition de prix', $$insert into tarif_exceptions (site, article, type, statut, motif, cond_prix_ttc) values ('site-a', 'Glace floup -20P', 'produit_appel', 'validee', 'prix d''appel', 0.95)$$);
select t_ok('22c gérant enregistre un refus (pack Guinness)', $$insert into tarif_exceptions (site, code_barres, type, statut, motif) values ('site-a', '69861498510', 'pack', 'refusee', 'pas d''exception validée')$$);
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('23 manager ne rétrograde pas une exception validée en candidate', $$insert into tarif_exceptions (site, code_barres, type, statut, motif, remplace_id) select 'site-a', '3289090001938', 'pack', 'candidate', 'x', id from v_tarif_exceptions_actifs where code_barres = '3289090001938'$$);
select t_egal('24 manager n''annule pas une exception validée', $$with u as (update tarif_exceptions set annule_le = now(), annule_par = 'a0000000-0000-0000-0000-000000000002', motif_annulation = 'x' where code_barres = '3289090001938' returning 1) select count(*) from u$$, '0');
select t_ok('25 manager complète sa candidature (nouvelle version)', $$insert into tarif_exceptions (site, article, type, statut, motif, remplace_id) select 'site-a', 'Bonbon Menthise 250G - 29P', 'produit_appel', 'candidate', 'menthe à l''unité, conditionnement à vérifier', id from v_tarif_exceptions_actifs where article = 'Bonbon Menthise 250G - 29P'$$);
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_egal('46 exceptions effectives : registre et produits_appel non repris', $$select string_agg(article || ':' || source, '|' order by article) from v_tarif_exceptions_effectives where article is not null$$,
  'Biere Bavaria 8/6 Blonde 50cl -24P:produits_appel|Bonbon Menthise 250G - 29P:tarif_exceptions|Glace floup -20P:tarif_exceptions|Glacons Vito 5 kg:produits_appel');
select t_ok('47 reprise des glaçons dans le registre', $$insert into tarif_exceptions (site, article, type, statut, motif, cond_prix_ttc) values ('site-a', 'Glacons Vito 5 kg', 'concurrence_directe', 'validee', 'sac de 5 kg à 4,00 € TTC', 4.00)$$);
select t_egal('47b la ligne produits_appel couverte disparaît, sans doublon', $$select count(*) from v_tarif_exceptions_effectives where article = 'Glacons Vito 5 kg'$$, '1');
select t_egal('47c la décision du gérant fait foi', $$select source || ':' || statut from v_tarif_exceptions_effectives where article = 'Glacons Vito 5 kg'$$, 'tarif_exceptions:validee');
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_ok('80 manager propose une candidature sur un produit d''appel déjà enregistré (Bavaria, casse et espaces différents)', $$insert into tarif_exceptions (site, article, type, statut, motif) values ('site-a', '  biere bavaria 8/6 blonde   50cl -24P', 'produit_appel', 'candidate', 'à revoir')$$);
select t_egal('81 la candidature ne neutralise pas le produit d''appel validé', $$select source || ':' || statut from v_tarif_exceptions_effectives where article = 'Biere Bavaria 8/6 Blonde 50cl -24P'$$, 'produits_appel:validee');
select t_egal('81b une seule ligne, la candidature est signalée sans effet', $$select count(*) || ':' || (min(candidature_ou_refus_sans_effet) like 'candidate du %')::text from v_tarif_exceptions_effectives where lower(article) like '%bavaria%'$$, '1:true');
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('82 gérant refuse la candidature (nouvelle version refusee)', $$insert into tarif_exceptions (site, article, type, statut, motif, remplace_id) select 'site-a', '  biere bavaria 8/6 blonde   50cl -24P', 'produit_appel', 'refusee', 'pas de changement', id from v_tarif_exceptions_actifs where statut = 'candidate' and article like '%bavaria%'$$);
select t_egal('83 le refus ne neutralise pas non plus le produit d''appel validé', $$select source || ':' || statut || ':' || (candidature_ou_refus_sans_effet like 'refusee du %')::text from v_tarif_exceptions_effectives where lower(article) like '%bavaria%'$$, 'produits_appel:validee:true');
select t_ok('84 gérant lève l''exception (levee)', $$insert into tarif_exceptions (site, article, type, statut, motif, remplace_id) select 'site-a', '  biere bavaria 8/6 blonde   50cl -24P', 'produit_appel', 'levee', 'fin du prix d''appel', id from v_tarif_exceptions_actifs where article like '%bavaria%'$$);
select t_egal('85 la levée du gérant prime sur produits_appel', $$select count(*) || ':' || min(source) || ':' || min(statut) from v_tarif_exceptions_effectives where lower(article) like '%bavaria%'$$, '1:tarif_exceptions:levee');
select t_egal('86 candidature sans produit d''appel : visible, sans effet', $$select source || ':' || statut from v_tarif_exceptions_effectives where article = 'Bonbon Menthise 250G - 29P'$$, 'tarif_exceptions:candidate');
reset role; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_egal('48 la vue respecte le site : gérant B ne voit que le site B', $$select string_agg(distinct site, ',') from v_tarif_exceptions_effectives$$, 'site-b');
reset role;

\echo '--- Contrôles réglementaires'
select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_ok('26 manager ouvre un contrôle (rayon Kits et Packs)', $$insert into tarif_controles_reglementaires (site, portee, rayon, etat, raison) values ('site-a', 'rayon', 'Kits et Packs', 'controle_ouvert', 'CSP L3513-5-1 : fiche du modèle exact')$$);
select t_ok('26b manager ouvre FINE LEAF (produit du tabac)', $$insert into tarif_controles_reglementaires (site, portee, article, etat, type_element, raison) values ('site-a', 'reference', 'Feuille de Tabac FINE LEAF 15g - 15P', 'controle_ouvert', 'produit_tabac', 'régime de prix et TVA à qualifier')$$);
select t_refuse('27 manager ne déclare pas conforme', $$insert into tarif_controles_reglementaires (site, portee, rayon, etat, raison, remplace_id) select 'site-a', 'rayon', 'Kits et Packs', 'conforme', 'x', id from v_tarif_controles_reglementaires_actifs where rayon = 'Kits et Packs'$$);
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('28 gérant qualifie le contrôle', $$insert into tarif_controles_reglementaires (site, portee, rayon, etat, type_element, raison, pieces, remplace_id) select 'site-a', 'rayon', 'Kits et Packs', 'a_completer', 'cartouche', 'fiche reçue, volume à confirmer', '["documents/vapotage/fiche.pdf"]'::jsonb, id from v_tarif_controles_reglementaires_actifs where rayon = 'Kits et Packs'$$);
select t_refuse('28b pièces : un tableau est exigé', $$insert into tarif_controles_reglementaires (site, portee, rayon, etat, raison, pieces) values ('site-a', 'rayon', 'PUFFS', 'controle_ouvert', 'x', '{"a":1}'::jsonb)$$);
reset role;

\echo '--- Prix décidés, application, régimes, réglages, décisions'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('29 gérant décide Sprite 2 L à 4,80 €', $$insert into tarif_prix_decides (site, article, code_barres, nature, prix_ttc) values ('site-a', 'Sprite 2l - 6P', '2292084000054', 'changement', 4.80)$$);
select t_ok('29b Coca-Cola 2 L maintenu, sans valeur', $$insert into tarif_prix_decides (site, article, nature) values ('site-a', 'Coca cola 2l -6P', 'maintenu')$$);
select t_refuse('30 maintenu avec un prix', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Coca cola zero 2l -6P', 'maintenu', 4.00)$$);
select t_refuse('30b changement sans prix', $$insert into tarif_prix_decides (site, article, nature) values ('site-a', 'Orangina 2l -6P', 'changement')$$);
select t_ok('35 gérant déclare FINE LEAF « à qualifier »', $$insert into tarif_regimes_prix (site, article, regime, raison) values ('site-a', 'Feuille de Tabac FINE LEAF 15g - 15P', 'a_qualifier', 'produit du tabac, régime non établi')$$);
select t_ok('37 réglage A6 : 5 € minimum', $$insert into tarif_reglages (site, parametre, valeur) values ('site-a', 'a6_montant_minimal', 5)$$);
select t_refuse('38 palier TTC nul', $$insert into tarif_reglages (site, parametre, valeur) values ('site-a', 'palier_ttc', 0)$$);
select t_refuse('39 paramètre inconnu', $$insert into tarif_reglages (site, parametre, valeur) values ('site-a', 'marge_magique', 1)$$);
select t_refuse('40 refus sans motif', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, moteur_version, photo) values ('site-a', 'X', '2026-10-05', '2026-11-09', 'refusee', 't1-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}')$$);
select t_refuse('41 photo incomplète', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo) values ('site-a', 'X', '2026-10-05', '2026-11-09', 'validee', 2.35, 't1-v2', '{"cout":1}')$$);
select t_ok('42 décision validée avec sa photo', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, seuil_id) select 'site-a', 'Barre Kinder Bueno 43g - 30P', '2026-10-05', '2026-11-09', 'validee', 2.35, 't1-v2', '{"cout":1.14,"pv_ht":2.06,"quantite":39,"taux":0.447,"fiabilite":"fiable","seuil":0.50}', id from v_tarif_seuils_actifs where cible_niveau = 'confiserie'$$);
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('31 manager ne décide pas de prix', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Orangina 2l -6P', 'changement', 5.90)$$);
select t_refuse('36 manager ne déclare pas de régime', $$insert into tarif_regimes_prix (site, article, regime, raison) values ('site-a', 'X', 'libre', 'x')$$);
select t_ok('32 manager déclare la saisie dans Decenium', $$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) select 'site-a', id, 'saisie_declaree', '2026-11-18' from v_tarif_prix_decides_actifs where article = 'Sprite 2l - 6P'$$);
select t_refuse('33 preuve sans type', $$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) select 'site-a', id, 'preuve_application', '2026-11-19' from v_tarif_prix_decides_actifs where article = 'Sprite 2l - 6P'$$);
select t_refuse('33b manager ne décide pas en se faisant passer pour une décision', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo) values ('site-a', 'X', '2026-10-05', '2026-11-09', 'validee', 2, 't1-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}')$$);
reset role;
select id as id_prix_a from tarif_prix_decides where site = 'site-a' and article = 'Sprite 2l - 6P' \gset
select set_config('request.jwt.claim.sub', :mB, false); set role authenticated;
select t_refuse('34 manager B ne déclare rien sur un prix du site A', format($$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) values ('site-b', %L, 'saisie_declaree', '2026-11-18')$$, :'id_prix_a'));
select t_refuse('34b ni en se déclarant sur le site A', format($$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) values ('site-a', %L, 'saisie_declaree', '2026-11-18')$$, :'id_prix_a'));
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('87 application sur un prix « maintenu » refusée', $$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) select 'site-a', id, 'saisie_declaree', '2026-11-18' from v_tarif_prix_decides_actifs where article = 'Coca cola 2l -6P'$$);
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('88 gérant remplace le prix Sprite (4,90 €)', format($$insert into tarif_prix_decides (site, article, code_barres, nature, prix_ttc, remplace_id) values ('site-a', 'Sprite 2l - 6P', '2292084000054', 'changement', 4.90, %L)$$, :'id_prix_a'));
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('89 application sur un prix décidé remplacé refusée', format($$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet) values ('site-a', %L, 'saisie_declaree', '2026-11-20')$$, :'id_prix_a'));
reset role;

\echo '--- Accès créateur'
select set_config('request.jwt.claim.sub', :cr, false); set role authenticated;
select t_egal('43 créateur lit le site A (accès autorisé)', $$select (count(*) > 0)::text from tarif_familles where site = 'site-a'$$, 'true');
select t_egal('44 créateur ne lit pas le site B (accès non autorisé)', $$select count(*) from tarif_familles where site = 'site-b'$$, '0');
select t_refuse('45 créateur n''écrit pas sur le site A', $$insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'jus', 'Jus')$$);
reset role;

\echo '--- Ajout seul sur toutes les tables'
select t_egal('50 aucun droit DELETE ni UPDATE de colonne métier pour authenticated',
  $$select count(*) from information_schema.table_privileges where grantee = 'authenticated' and table_name like 'tarif\_%' and privilege_type in ('DELETE','UPDATE','TRUNCATE')$$, '0');
select t_egal('51 UPDATE ouvert sur les trois seules colonnes d''annulation',
  $$select string_agg(distinct column_name, ',' order by column_name) from information_schema.column_privileges where grantee = 'authenticated' and table_name like 'tarif\_%' and privilege_type = 'UPDATE'$$, 'annule_le,annule_par,motif_annulation');
select t_egal('52 RLS active et forcée sur les dix tables', $$select count(*) from pg_class where relname like 'tarif\_%' and relkind = 'r' and relrowsecurity and relforcerowsecurity$$, '10');
select t_egal('53 aucun droit pour anon', $$select count(*) from information_schema.table_privileges where grantee = 'anon' and table_name like '%tarif\_%'$$, '0');

\echo '--- Intégrité, incohérences et service_role'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('90 gérant annule la famille sodas_2l', $$update tarif_familles set annule_le = now(), annule_par = 'a0000000-0000-0000-0000-000000000001', motif_annulation = 'recette incohérences' where famille_code = 'sodas_2l' and annule_le is null$$);
select t_egal('91 incohérences signalées : rattachement, seuil, application sur prix remplacé', $$select string_agg(incoherence, '|' order by incoherence) from v_tarif_incoherences$$,
  'application visant un prix décidé inactif|rattachement vers une famille inactive|seuil d''une famille inactive');
reset role; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_egal('91b gérant B ne voit pas les incohérences du site A', $$select count(*) from v_tarif_incoherences$$, '0');
reset role; select set_config('request.jwt.claim.sub', '', false); set role service_role;
select t_refuse('92 service_role : UPDATE d''une colonne métier refusé', $$update tarif_familles set libelle = 'x'$$);
select t_refuse('93 service_role : DELETE refusé', $$delete from tarif_exceptions$$);
select t_refuse('94 service_role : TRUNCATE refusé', $$truncate tarif_decisions$$);
select t_refuse('95 service_role : rétrogradation d''une exception validée refusée', $$insert into tarif_exceptions (site, code_barres, type, statut, motif, saisi_par, remplace_id) select 'site-a', '3289090001938', 'pack', 'candidate', 'x', 'a0000000-0000-0000-0000-000000000001', id from v_tarif_exceptions_actifs where code_barres = '3289090001938'$$);
select t_refuse('96 service_role : version croisée entre sites refusée (clé étrangère composite)', format($$insert into tarif_familles (site, famille_code, libelle, saisi_par, remplace_id) values ('site-b', 'confiserie', 'Vol', 'b0000000-0000-0000-0000-000000000001', %L)$$, :'id_famille_a'));
select t_refuse('97 service_role : application vers un prix d''un autre site refusée', format($$insert into tarif_prix_application (site, prix_decide_id, evenement, date_effet, saisi_par) values ('site-b', %L, 'saisie_declaree', '2026-11-18', 'b0000000-0000-0000-0000-000000000001')$$, :'id_prix_a'));
reset role; set role anon;
select t_refuse('98 anon : tarif_cle_reference non exécutable', $$select tarif_cle_reference('1', null)$$);
reset role;
select t_egal('99 aucune fonction tarif en SECURITY DEFINER', $$select count(*) from pg_proc where proname like 'tarif\_%' and prosecdef$$, '0');
select t_egal('99b anon : aucun EXECUTE sur une fonction tarif', $$select count(*) from pg_proc where proname like 'tarif\_%' and has_function_privilege('anon', oid, 'execute')$$, '0');
select t_egal('99c service_role : ni DELETE ni TRUNCATE ni UPDATE de table', $$select count(*) from information_schema.table_privileges where grantee = 'service_role' and table_name like 'tarif\_%' and privilege_type in ('DELETE','UPDATE','TRUNCATE')$$, '0');
select t_egal('99d propriétaire des tables : postgres, non superutilisateur, BYPASSRLS', $$select distinct r.rolname || ':' || r.rolsuper || ':' || r.rolbypassrls from pg_class c join pg_roles r on r.oid = c.relowner where c.relname like 'tarif\_%' and c.relkind = 'r'$$, 'postgres:false:true');
select t_egal('99e auth.uid lit aussi request.jwt.claims (format Supabase actuel)', $$select set_config('request.jwt.claim.sub', '', true) is not null and set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001"}', true) is not null and current_employee_role() = 'gerant'$$, 'true');
select t_egal('99f vues : authenticated n''a que SELECT', $$select count(*) from information_schema.table_privileges where grantee in ('authenticated','anon','service_role') and table_name like 'v\_tarif\_%' and privilege_type <> 'SELECT'$$, '0');
