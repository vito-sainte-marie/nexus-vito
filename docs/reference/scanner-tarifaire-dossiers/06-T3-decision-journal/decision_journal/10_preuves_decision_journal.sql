-- Preuves de la fonction décision-journal sur base JETABLE locale (jamais Test, jamais Production).
-- Chaque ligne de résultat commence par OK ou ECHEC. Données fictives.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\set gA '''a0000000-0000-0000-0000-000000000001'''
\set mA '''a0000000-0000-0000-0000-000000000002'''
\set cA '''a0000000-0000-0000-0000-000000000003'''
\set dA '''a0000000-0000-0000-0000-000000000004'''
\set gB '''b0000000-0000-0000-0000-000000000001'''
\set cr '''c0000000-0000-0000-0000-000000000001'''
\set g2 '''a0000000-0000-0000-0000-000000000005'''

insert into sites (site_id, nom_entreprise, acces_createur_autorise, timezone) values ('site-a', 'Site A', true, 'America/Martinique'),
  ('site-b', 'Site B', false, 'America/Martinique'), ('site-c', 'Site créateur', false, 'Europe/Paris');
insert into employees (id, username, nom, role, site_id, est_createur, actif) values
  (:gA, 'ga', 'Gérant A', 'gerant', 'site-a', false, true), (:mA, 'ma', 'Manager A', 'manager', 'site-a', false, true),
  (:cA, 'ca', 'Caissier A', 'caissier', 'site-a', false, true), (:dA, 'da', 'Gérant A désactivé', 'gerant', 'site-a', false, false),
  (:gB, 'gb', 'Gérant B', 'gerant', 'site-b', false, true), (:cr, 'cr', 'Créateur', 'gerant', 'site-c', true, true),
  (:g2, 'g2', 'Second gérant A', 'gerant', 'site-a', false, true);

create function t_ok(n text, q text) returns text language plpgsql as $$
begin execute q; return 'OK     ' || n; exception when others then return 'ECHEC  ' || n || ' : ' || sqlerrm; end $$;
create function t_refuse(n text, q text, motif text) returns text language plpgsql as $$
begin execute q; return 'ECHEC  ' || n || ' : accepté alors qu''il devait être refusé';
exception when others then
  if sqlerrm like '%' || motif || '%' then return 'OK     ' || n || ' (refusé : ' || left(sqlerrm, 80) || ')'; end if;
  return 'ECHEC  ' || n || ' : refusé pour une autre raison : ' || sqlerrm; end $$;
create function t_egal(n text, q text, attendu text) returns text language plpgsql as $$
declare v text;
begin execute q into v; if v is not distinct from attendu then return 'OK     ' || n; end if;
  return 'ECHEC  ' || n || ' : obtenu ' || coalesce(v, 'null') || ', attendu ' || attendu;
exception when others then return 'ECHEC  ' || n || ' : ' || sqlerrm; end $$;
grant execute on function t_ok(text, text), t_refuse(text, text, text), t_egal(text, text, text) to authenticated, anon, service_role;
-- Compteur hors RLS (rôle de test), pour vérifier qu'un refus n'a RIEN laissé, sur tous les sites.
create function t_total() returns text language sql security definer set search_path = public as
  $$ select (select count(*) from tarif_prix_decides) || '/' || (select count(*) from tarif_decisions) $$;
grant execute on function t_total() to authenticated, anon, service_role;

-- Familles et seuil du site A (gérant A, par la RLS).
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
insert into tarif_familles (site, famille_code, libelle) values ('site-a', 'confiserie', 'Confiserie');
insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum) values ('site-a', 'famille', 'confiserie', 0.50, 'valide');
reset role;
select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
insert into tarif_familles (site, famille_code, libelle) values ('site-b', 'confiserie', 'Confiserie B');
insert into tarif_seuils (site, niveau, cible_niveau, minimum, statut_minimum) values ('site-b', 'famille', 'confiserie', 0.45, 'valide');
reset role;

-- Gabarit d'une ligne de décision valide (photo du moteur T2, période de 36 jours).
create function t_ligne(article text, decision text, prix numeric, motif text default null, extra jsonb default '{}') returns jsonb
language sql as $$
  select jsonb_strip_nulls(jsonb_build_object('article', article, 'decision', decision, 'prix_ttc_retenu', prix, 'motif', motif,
    'periode_debut', '2026-10-05', 'periode_fin', '2026-11-09', 'moteur_version', 'politique-tarifaire-t2-v2',
    'photo', jsonb_build_object('cout', 1.14, 'pv_ht', 2.06, 'quantite', 39, 'taux', 0.447, 'fiabilite', 'fiable'))) || extra $$;
grant execute on function t_ligne(text, text, numeric, text, jsonb) to authenticated, anon, service_role;

\echo '--- 1. Fonctionnement nominal (gérant A)'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('D01 décision validée : un prix décidé et une ligne de journal', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Barre Bueno', 'validee', 2.35)))$$);
select t_egal('D01b lien : même site, même référence, même prix, même auteur', $$select count(*) from tarif_decisions d join tarif_prix_decides p on p.id = d.prix_decide_id
  where d.article = 'Barre Bueno' and p.site = 'site-a' and d.site = 'site-a' and p.prix_ttc = d.prix_ttc_retenu and p.saisi_par = d.saisi_par and p.nature = 'changement'$$, '1');
select t_ok('D02 autre prix sur la même référence : remplace la version active', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Barre Bueno', 'autre_prix', 2.40, 'arrondi au palier')))$$);
select t_egal('D02b une seule version active, 2,40 €, qui remplace 2,35 €', $$select p.prix_ttc || '<' || r.prix_ttc from v_tarif_prix_decides_actifs p join tarif_prix_decides r on r.id = p.remplace_id where p.article = 'Barre Bueno'$$, '2.40<2.35');
select t_ok('D03 refus : journal seul, aucun prix décidé', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Sachet Durmint', 'refusee', null, 'prix concurrent')))$$);
select t_egal('D03b refus sans lien et sans prix', $$select count(*) from tarif_decisions where article = 'Sachet Durmint' and prix_decide_id is null and prix_ttc_retenu is null$$, '1');
select t_egal('D03c aucun prix décidé pour le refus', $$select count(*) from tarif_prix_decides where article = 'Sachet Durmint'$$, '0');
select t_ok('D04 lot de trois décisions', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 1', 'validee', 1.10), t_ligne('Ref 2', 'validee', 1.20), t_ligne('Ref 3', 'refusee', null, 'non')))$$);
select t_egal('D04b le lot a écrit 2 prix et 3 lignes de journal', $$select (select count(*) from tarif_prix_decides where article like 'Ref %') || '/' || (select count(*) from tarif_decisions where article like 'Ref %')$$, '2/3');
select t_ok('D05 seuil du site lié à la décision', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 4', 'validee', 1.30, null,
  jsonb_build_object('seuil_id', (select id from v_tarif_seuils_actifs where cible_niveau = 'confiserie')))))$$);
reset role;
select t_egal('D06 état après le nominal (prix/journal, tous sites)', 'select t_total()', '5/7');

\echo '--- 2. Atomicité : tout ou rien'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_refuse('D10 lot dont la deuxième ligne a une photo incomplète', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 5', 'validee', 1.50),
  t_ligne('Ref 6', 'validee', 1.60) || '{"photo":{"cout":1}}'::jsonb))$$, 'tarif_decisions_photo_check');
select t_refuse('D11 décision seule dont le journal échoue après le prix (photo incomplète)', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 7', 'validee', 1.70) || '{"photo":{"cout":1}}'::jsonb))$$, 'tarif_decisions_photo_check');
select t_refuse('D12 référence en double dans le lot', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 8', 'validee', 1.80), t_ligne('ref 8', 'validee', 1.90)))$$, 'tarif_decision_doublon_lot');
select t_refuse('D13 autre prix sans motif', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 9', 'validee', 1.00), t_ligne('Ref 10', 'autre_prix', 2.00)))$$, 'tarif_decisions_motif');
select t_refuse('D14 lot vide', $$select * from tarif_enregistrer_decisions('[]'::jsonb)$$, 'tarif_decision_lot_invalide');
select t_refuse('D15 lot de 201 décisions', $$select * from tarif_enregistrer_decisions((select jsonb_agg(t_ligne('L' || g, 'validee', 1)) from generate_series(1, 201) g))$$, 'tarif_decision_lot_invalide');
reset role;
select t_egal('D16 aucun refus n''a laissé de ligne (prix/journal, tous sites)', 'select t_total()', '5/7');

\echo '--- 3. Droits (RLS, rôles, comptes)'
select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('D20 manager A ne décide pas', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 20', 'validee', 1)))$$, 'tarif_decision_reservee_gerant');
reset role; select set_config('request.jwt.claim.sub', :cA, false); set role authenticated;
select t_refuse('D21 caissier A ne décide pas', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 21', 'validee', 1)))$$, 'tarif_decision_reservee_gerant');
reset role; select set_config('request.jwt.claim.sub', :dA, false); set role authenticated;
select t_refuse('D22 gérant désactivé : refus explicite, pas une lecture vide', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 22', 'validee', 1)))$$, 'tarif_decision_compte_inactif');
select t_egal('D22b le même compte lit bien sa fiche (actif = false)', $$select actif::text from employees where id = auth.uid()$$, 'false');
reset role; select set_config('request.jwt.claim.sub', :cr, false); set role authenticated;
select t_refuse('D23 créateur : lecture seule, même gérant de son site', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 23', 'validee', 1)))$$, 'tarif_decision_createur_lecture_seule');
reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;
select t_refuse('D24 anon : aucun droit d''exécution', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 24', 'validee', 1)))$$, 'permission denied');
reset role; set role service_role;
select t_refuse('D25 service_role : aucun droit d''exécution', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 25', 'validee', 1)))$$, 'permission denied');
reset role; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-0000000000ff', false); set role authenticated;
select t_refuse('D26 session sans fiche employé', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 26', 'validee', 1)))$$, 'tarif_decision_compte_illisible');
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_refuse('D27 insertion directe d''un journal lié à un prix différent', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, prix_decide_id)
  select 'site-a', 'Ref 1', '2026-10-05', '2026-11-09', 'validee', 9.99, 'politique-tarifaire-t2-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}', id from tarif_prix_decides where article = 'Ref 1'$$, 'tarif_decision_lien_invalide');
select t_refuse('D28 deuxième journal sur le même prix décidé', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, prix_decide_id)
  select 'site-a', 'Ref 1', '2026-10-05', '2026-11-09', 'validee', 1.10, 'politique-tarifaire-t2-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}', id from tarif_prix_decides where article = 'Ref 1'$$, 'tarif_decisions_prix_decide_uq');
select t_refuse('D29 insertion directe d''une décision validée sans prix lié', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo)
  values ('site-a', 'Ref 29', '2026-10-05', '2026-11-09', 'validee', 1.10, 'politique-tarifaire-t2-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}')$$, 'tarif_decision_lien_absent');
reset role;
select t_egal('D29b aucun refus de droits n''a laissé de ligne', 'select t_total()', '5/7');

\echo '--- 4. Isolation multisite'
select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_ok('D30 gérant B décide sur la même référence que A', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Barre Bueno', 'validee', 2.50)))$$);
select t_egal('D30b la décision de B est sur le site B, sans remplacer la version de A', $$select site || ':' || coalesce(remplace_id::text, 'aucun') from tarif_prix_decides where saisi_par = 'b0000000-0000-0000-0000-000000000001'$$, 'site-b:aucun');
select t_egal('D31 gérant B ne voit aucune décision du site A', $$select count(*) from tarif_decisions where site = 'site-a'$$, '0');
select t_refuse('D32 gérant B transmet un site', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 32', 'validee', 1) || '{"site":"site-a"}'::jsonb))$$, 'tarif_decision_champ_inconnu');
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
create temp table t_seuil_a as select id from v_tarif_seuils_actifs where cible_niveau = 'confiserie';
reset role; grant select on t_seuil_a to authenticated; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_refuse('D33 gérant B cite un seuil du site A', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 33', 'validee', 1, null,
  jsonb_build_object('seuil_id', (select id from t_seuil_a)))))$$, 'tarif_decisions_seuil_meme_site_fk');
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_egal('D34 gérant A voit toujours 2,40 € comme version active, pas 2,50 €', $$select prix_ttc::text from v_tarif_prix_decides_actifs where article = 'Barre Bueno'$$, '2.40');
reset role;
select t_egal('D35 état après multisite (une décision de B en plus)', 'select t_total()', '6/8');

\echo '--- 5. Version de moteur déclarée (contrôle de forme, pas une preuve d''origine)'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_refuse('D40 version déclarée du moteur T1', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 40', 'validee', 1) || '{"moteur_version":"t1-v2"}'::jsonb))$$, 'tarif_decision_version_moteur_refusee');
select t_refuse('D41 version de moteur absente', $$select * from tarif_enregistrer_decisions(jsonb_build_array(t_ligne('Ref 41', 'validee', 1) - 'moteur_version'))$$, 'tarif_decision_version_moteur_refusee');
reset role;

\echo '--- 6. Écritures directes et modifications autorisées : tarif_prix_decides'
reset role;
create function t_journal(p_site text, p_art text, p_dec text, p_prix numeric, p_pd uuid, p_motif text default null) returns void language sql as $$
  insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, motif, moteur_version, photo, prix_decide_id)
  values (p_site, p_art, '2026-10-05', '2026-11-09', p_dec, p_prix, p_motif, 'politique-tarifaire-t2-v2',
          '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}', p_pd) $$;
create function t_pd(p_art text) returns uuid language sql security definer set search_path = public as
  $$ select id from tarif_prix_decides where article = p_art order by saisi_le desc limit 1 $$;
grant execute on function t_journal(text, text, text, numeric, uuid, text), t_pd(text) to authenticated, anon, service_role;
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('P01 gérant A : prix décidé inséré directement, sans journal (droit T2 conservé)', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Direct 1', 'changement', 1.11)$$);
select t_egal('P01b il est visible comme prix sans journal (repérable par l''écran)', $$select count(*) from tarif_prix_decides p where article = 'Direct 1' and not exists (select 1 from tarif_decisions d where d.prix_decide_id = p.id)$$, '1');
select t_refuse('P03 gérant A : prix décidé pour le site B', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-b', 'Direct X', 'changement', 1)$$, 'row-level security');
select t_refuse('P04 gérant A : auteur imposé', $$insert into tarif_prix_decides (site, article, nature, prix_ttc, saisi_par) values ('site-a', 'Direct X', 'changement', 1, 'a0000000-0000-0000-0000-000000000005')$$, 'row-level security');
select t_refuse('P05 modification du prix', $$update tarif_prix_decides set prix_ttc = 9 where article = 'Direct 1'$$, 'permission denied');
select t_refuse('P06 modification du remplacement', $$update tarif_prix_decides set remplace_id = null where article = 'Barre Bueno'$$, 'permission denied');
select t_refuse('P07 suppression', $$delete from tarif_prix_decides where article = 'Direct 1'$$, 'permission denied');
select t_refuse('P10 annulation sans motif', $$update tarif_prix_decides set annule_le = now(), annule_par = auth.uid() where article = 'Ref 2'$$, 'tarif_prix_decides_annulation');
select t_egal('P11 gérant A annule un prix lié à une décision (motif)', $$with u as (update tarif_prix_decides set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'recette' where article = 'Ref 2' and annule_le is null returning 1) select count(*) from u$$, '1');
select t_egal('P11b la ligne de journal liée reste intacte et liée (historique)', $$select count(*) from tarif_decisions d join tarif_prix_decides p on p.id = d.prix_decide_id where d.article = 'Ref 2' and d.annule_le is null and p.annule_le is not null$$, '1');
select t_egal('P12 réannulation : aucune ligne', $$with u as (update tarif_prix_decides set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'bis' where article = 'Ref 2' and annule_le is not null returning 1) select count(*) from u$$, '0');
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('P02 manager A : prix décidé direct', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Direct X', 'changement', 1)$$, 'row-level security');
select t_egal('P08 manager A n''annule aucun prix décidé', $$with u as (update tarif_prix_decides set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'x' where article = 'Ref 1' returning 1) select count(*) from u$$, '0');
reset role; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_egal('P09 gérant B n''annule aucun prix du site A', $$with u as (update tarif_prix_decides set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'x' where site = 'site-a' returning 1) select count(*) from u$$, '0');
reset role;

\echo '--- 7. Écritures directes et modifications autorisées : tarif_decisions'
select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_ok('J01 refus direct sans lien', $$select t_journal('site-a', 'Direct R', 'refusee', null, null, 'non')$$);
select t_refuse('J02 refus direct avec un lien', $$select t_journal('site-a', 'Direct 1', 'refusee', null, t_pd('Direct 1'), 'non')$$, 'tarif_decision_lien_invalide');
select t_ok('J03a prix direct Direct 2 puis annulé', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Direct 2', 'changement', 2.22);
  update tarif_prix_decides set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'recette' where article = 'Direct 2'$$);
select t_refuse('J03 décision liée à un prix annulé', $$select t_journal('site-a', 'Direct 2', 'validee', 2.22, t_pd('Direct 2'))$$, 'tarif_decision_lien_invalide');
select t_ok('J04a prix direct Direct 3 en deux versions', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Direct 3', 'changement', 3.30);
  insert into tarif_prix_decides (site, article, nature, prix_ttc, remplace_id) select 'site-a', 'Direct 3', 'changement', 3.33, id from tarif_prix_decides where article = 'Direct 3'$$);
select t_refuse('J04 décision liée à la version remplacée', $$select t_journal('site-a', 'Direct 3', 'validee', 3.30, (select id from tarif_prix_decides where article = 'Direct 3' and prix_ttc = 3.30))$$, 'tarif_decision_lien_invalide');
select t_ok('J06a prix direct « en vigueur »', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Direct 6', 'en_vigueur', 6.00)$$);
select t_refuse('J06 décision liée à un prix « en vigueur »', $$select t_journal('site-a', 'Direct 6', 'validee', 6.00, t_pd('Direct 6'))$$, 'tarif_decision_lien_invalide');
select t_refuse('J07 décision liée au prix d''une autre référence', $$select t_journal('site-a', 'Autre ref', 'validee', 1.11, t_pd('Direct 1'))$$, 'tarif_decision_lien_invalide');
select t_refuse('J07b décision liée à un prix différent', $$select t_journal('site-a', 'Direct 1', 'autre_prix', 1.12, t_pd('Direct 1'), 'x')$$, 'tarif_decision_lien_invalide');
select t_refuse('J07c décision liée à un prix du site B', $$select t_journal('site-a', 'Barre Bueno', 'validee', 2.50, t_pd('Barre Bueno'))$$, 'tarif_decision_lien_invalide');
select t_refuse('J07d décision du site B écrite par A', $$select t_journal('site-b', 'Direct 1', 'refusee', null, null, 'x')$$, 'row-level security');
select t_ok('J08 décision directe cohérente liée à Direct 1 (même auteur, même prix, actif)', $$select t_journal('site-a', 'Direct 1', 'validee', 1.11, t_pd('Direct 1'))$$);
select t_refuse('J12 modification du lien', $$update tarif_decisions set prix_decide_id = null where article = 'Direct 1'$$, 'permission denied');
select t_refuse('J13 modification de la décision ou de la photo', $$update tarif_decisions set decision = 'refusee', photo = '{}' where article = 'Direct 1'$$, 'permission denied');
select t_refuse('J14 suppression', $$delete from tarif_decisions where article = 'Direct 1'$$, 'permission denied');
select t_egal('J15 gérant A annule une ligne de journal liée (motif)', $$with u as (update tarif_decisions set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'recette' where article = 'Ref 1' and annule_le is null returning 1) select count(*) from u$$, '1');
select t_egal('J15b le prix décidé lié reste actif : annulations indépendantes', $$select count(*) from v_tarif_prix_decides_actifs where article = 'Ref 1'$$, '1');
reset role; select set_config('request.jwt.claim.sub', :g2, false); set role authenticated;
select t_ok('J05a second gérant A : prix direct Direct 5', $$insert into tarif_prix_decides (site, article, nature, prix_ttc) values ('site-a', 'Direct 5', 'changement', 5.00)$$);
reset role; select set_config('request.jwt.claim.sub', :gA, false); set role authenticated;
select t_refuse('J05 gérant A lie son journal au prix d''un autre gérant', $$select t_journal('site-a', 'Direct 5', 'validee', 5.00, t_pd('Direct 5'))$$, 'tarif_decision_lien_invalide');
reset role; select set_config('request.jwt.claim.sub', :mA, false); set role authenticated;
select t_refuse('J09 manager A : journal direct', $$select t_journal('site-a', 'Direct M', 'refusee', null, null, 'x')$$, 'row-level security');
select t_egal('J16 manager A n''annule aucune ligne de journal', $$with u as (update tarif_decisions set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'x' returning 1) select count(*) from u$$, '0');
reset role; select set_config('request.jwt.claim.sub', :gB, false); set role authenticated;
select t_egal('J17 gérant B n''annule aucune ligne du site A', $$with u as (update tarif_decisions set annule_le = now(), annule_par = auth.uid(), motif_annulation = 'x' where site = 'site-a' returning 1) select count(*) from u$$, '0');
reset role; set role service_role;
select t_refuse('J10 service_role (contourne la RLS) : lien incohérent refusé quand même', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, saisi_par, prix_decide_id)
  values ('site-a', 'Direct 1', '2026-10-05', '2026-11-09', 'validee', 7.77, 'politique-tarifaire-t2-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}', 'a0000000-0000-0000-0000-000000000001', t_pd('Direct 1'))$$, 'tarif_decision_lien_invalide');
select t_refuse('J11 service_role : validée sans lien refusée', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, saisi_par)
  values ('site-a', 'Direct S', '2026-10-05', '2026-11-09', 'validee', 7.77, 'politique-tarifaire-t2-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}', 'a0000000-0000-0000-0000-000000000001')$$, 'tarif_decision_lien_absent');
select t_refuse('J11b service_role : lien vers un prix d''un autre site refusé', $$insert into tarif_decisions (site, article, periode_debut, periode_fin, decision, prix_ttc_retenu, moteur_version, photo, saisi_par, prix_decide_id)
  values ('site-a', 'Barre Bueno', '2026-10-05', '2026-11-09', 'validee', 2.50, 'politique-tarifaire-t2-v2', '{"cout":1,"pv_ht":2,"quantite":3,"taux":0.5,"fiabilite":"fiable"}', 'a0000000-0000-0000-0000-000000000001', (select p.id from tarif_prix_decides p where p.site = 'site-b' limit 1))$$, 'tarif_decision');
reset role;
