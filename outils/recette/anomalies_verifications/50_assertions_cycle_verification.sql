-- NEXUS Scanner tarifaire : dix assertions du cycle de vérification, en transaction, puis ROLLBACK. Cible : Test.
-- Prérequis : la migration 20261118120000 est déjà appliquée sur Test (ce script ne l'applique pas ; il s'arrête avant toute écriture si elle manque).
-- Comptes et lots fictifs, créés DANS la transaction (ids 00000000-0000-4000-8000-0000000e01xx), annulés par le rollback. Aucun libellé réel : articles « essai-... ».
-- Aucune écriture hors transaction. Sortie : UN seul select final (JSON, un verdict par assertion A01 à A10), puis rollback.
-- À jouer ensuite : 51_comptes_apres_rollback.sql (A10, après le rollback).
begin;
do $garde_recette$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant système % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
  if to_regclass('public.tarif_anomalies_verifications') is null or to_regclass('public.tarif_anomalies_reevaluations') is null
     or to_regprocedure('public.tarif_marquer_verifie(jsonb)') is null or to_regprocedure('public.tarif_enregistrer_reevaluations(jsonb)') is null then
    raise exception 'prerequis : la migration 20261118120000 n est pas appliquee sur ce projet';
  end if;
end $garde_recette$;

create temp table ctl (n serial, nom text, detail jsonb) on commit drop;
insert into ctl(nom, detail) select 'comptes_avant', to_jsonb(q) from (select
  (select count(*) from tarif_anomalies_verifications) as verifications,
  (select count(*) from tarif_anomalies_reevaluations) as reevaluations,
  (select count(*) from import_batches) as import_batches) q;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public; grant all on sequence journal_n_seq to public;
create temp table ids (k text, v text) on commit drop;
grant all on ids to public;

insert into auth.users(id, aud, role, email) select ('00000000-0000-4000-8000-0000000e01' || k)::uuid, 'authenticated', 'authenticated', 'recette-cycle-' || k || '@invalid.test'
from (values ('01'),('02'),('03'),('04'),('05'),('06'),('07'),('08')) t(k);
insert into employees(id, username, nom, role, actif, est_createur, site_id, compte_test)
select ('00000000-0000-4000-8000-0000000e01' || k)::uuid, 'recette-cycle-' || k, 'Recette cycle ' || k, r, a, c, s, true
from (values ('01','gerant',true,false,'site-fantome-test'), ('02','manager',true,false,'site-fantome-test'), ('03','manager',true,false,'site-fantome-test'),
  ('04','pompiste',true,false,'site-fantome-test'), ('05','caissier',true,true,'site-fantome-test'), ('06','manager',false,false,'site-fantome-test'),
  ('07','manager',true,false,'nexus-station-test'), ('08','caissier',true,false,'site-fantome-test')) t(k,r,a,c,s);
insert into ids(k, v) values ('gA','00000000-0000-4000-8000-0000000e0101'),('mA','00000000-0000-4000-8000-0000000e0102'),('mA2','00000000-0000-4000-8000-0000000e0103'),
  ('pA','00000000-0000-4000-8000-0000000e0104'),('cA','00000000-0000-4000-8000-0000000e0105'),('iA','00000000-0000-4000-8000-0000000e0106'),
  ('mB','00000000-0000-4000-8000-0000000e0107'),('kA','00000000-0000-4000-8000-0000000e0108');

create function pg_temp.u(p_k text) returns uuid language sql as $$ select v::uuid from pg_temp.ids where k = p_k $$;
grant execute on function pg_temp.u(text) to public;
-- note : l'attendu peut proposer deux formes séparées par « ~ » (la première qui figure dans l'obtenu suffit).
create function pg_temp.note(p_cas text, p_attendu text, p_obtenu text) returns void language sql as $$
  insert into pg_temp.journal(cas, attendu, obtenu, ok) values (p_cas, p_attendu,  p_obtenu,
    exists (select 1 from unnest(string_to_array(p_attendu, '~')) a where position(a in coalesce(p_obtenu,'')) > 0));
$$;
grant execute on function pg_temp.note(text, text, text) to public;
create function pg_temp.comme(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', case when p_uid is null then json_build_object('role', p_role)::text else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
  perform set_config('request.jwt.claim.sub', coalesce(p_uid::text, ''), true);
  perform set_config('request.jwt.claim.role', p_role, true);
  execute format('set local role %I', p_role);
end $$;
grant execute on function pg_temp.comme(text, uuid) to public;
create function pg_temp.tente(p_sql text) returns text language plpgsql as $$
declare n bigint;
begin execute p_sql; get diagnostics n = row_count; return 'ok n=' || n;
exception when others then return sqlstate || ' ' || sqlerrm; end $$;
grant execute on function pg_temp.tente(text) to public;
create function pg_temp.val(p_sql text) returns text language plpgsql as $$
declare r text;
begin execute p_sql into r; return r; exception when others then return sqlstate || ' ' || sqlerrm; end $$;
grant execute on function pg_temp.val(text) to public;
create function pg_temp.js(p_art text, p_batch text, p_hash text, p_extra text default '') returns text language sql as $$
  select format('[{"article":"%s","code_barres":"","cause":"S1","empreinte":"e-%s","fichier_hash":"%s","date_releve":"2026-11-10","gravite":3.5,"niveau":"moyen","valeurs":{"a":1},"import_batch_id":"%s","moteur_version":"politique-tarifaire-t2-v2"%s}]', p_art, p_art, p_hash, p_batch, p_extra)
$$;
grant execute on function pg_temp.js(text,text,text,text) to public;
create function pg_temp.marque(p_js text) returns text language sql as $$ select format('select o_id::text, o_deja::text from tarif_marquer_verifie(%L::jsonb)', p_js); $$;
grant execute on function pg_temp.marque(text) to public;
create function pg_temp.reeval(p_js text) returns text language sql as $$ select format('select o_id::text, o_deja::text from tarif_enregistrer_reevaluations(%L::jsonb)', p_js); $$;
grant execute on function pg_temp.reeval(text) to public;
-- rj2 : réévaluation d'une vérification désignée par sa clé dans ids (généralise rj du script 10).
create function pg_temp.rj2(p_vkey text, p_art text, p_etat text, p_hash text, p_date text, p_grav text) returns text language sql as $$
  select format('[{"verification_id":"%s","article":"%s","code_barres":"","cause":"S1","etat":"%s","fichier_hash":"%s","date_releve":"%s","empreinte":"e-%s","gravite":%s,"valeurs":{"a":1}}]', (select v from pg_temp.ids where k=p_vkey), p_art, p_etat, p_hash, p_date, p_art, p_grav);
$$;
grant execute on function pg_temp.rj2(text,text,text,text,text,text) to public;

insert into import_batches(id, site, intention, fichier_hash) values
  ('00000000-0000-4000-8000-00000000f101', 'site-fantome-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f102', 'site-fantome-test', 'stock_theorique', 'H2'),
  ('00000000-0000-4000-8000-00000000f103', 'nexus-station-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f105', 'site-fantome-test', 'stock_theorique', 'H3');

select pg_temp.note('A00 comptes de recette trouves (8 attendus)', '8', (select count(*)::text from employees where id::text like '00000000-0000-4000-8000-0000000e01%' and compte_test));

-- A01 : un manager du site A marque vérifié avec un commentaire ; auteur, date et commentaire conservés.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('A01 manager marque avec commentaire', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-1','00000000-0000-4000-8000-00000000f101','H1',',"commentaire":"controle fait sur facture"'))));
select pg_temp.note('A01 auteur = le manager', pg_temp.u('mA')::text, pg_temp.val($q$select saisi_par::text from tarif_anomalies_verifications where article='essai-1'$q$));
select pg_temp.note('A01 date de saisie renseignee', 't', pg_temp.val($q$select (saisi_le is not null)::text from tarif_anomalies_verifications where article='essai-1'$q$));
select pg_temp.note('A01 commentaire conserve', 'controle fait sur facture', pg_temp.val($q$select commentaire from tarif_anomalies_verifications where article='essai-1'$q$));
reset role;
insert into ids(k, v) select 'v1', id::text from tarif_anomalies_verifications where article='essai-1';

-- A02 : l'historique est lisible par le manager et par le gérant du site A, avec auteur et date.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('A02 manager lit l historique (1 ligne, auteur, date)', '1|t|' || pg_temp.u('mA')::text,
  pg_temp.val($q$select count(*)::text || '|' || bool_and(saisi_le is not null and saisi_par is not null)::text || '|' || min(saisi_par::text) from tarif_anomalies_verifications where article='essai-1'$q$));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('A02 gerant lit l historique (1 ligne, auteur, date)', '1|t|' || pg_temp.u('mA')::text,
  pg_temp.val($q$select count(*)::text || '|' || bool_and(saisi_le is not null and saisi_par is not null)::text || '|' || min(saisi_par::text) from tarif_anomalies_verifications where article='essai-1'$q$));
reset role;

-- A03 : reimport identique : o_deja vrai, aucune ligne en plus.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('A03 rejeu identique : o_deja vrai', 't', pg_temp.val(format('select o_deja::text from tarif_marquer_verifie(%L::jsonb)', pg_temp.js('essai-1','00000000-0000-4000-8000-00000000f101','H1',',"commentaire":"controle fait sur facture"'))));
select pg_temp.note('A03 toujours une seule ligne', '1', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-1'$q$));

-- A04 : nouvel import, l'anomalie persiste : etat persistante sur un nouveau fichier_hash, idempotent au rejeu.
select pg_temp.note('A04 persistante (nouveau hash H2)', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v1','essai-1','persistante','H2','2026-11-17','3.5'))));
select pg_temp.note('A04 persistante rejouee : o_deja vrai', 't', pg_temp.val(format('select o_deja::text from tarif_enregistrer_reevaluations(%L::jsonb)', pg_temp.rj2('v1','essai-1','persistante','H2','2026-11-17','3.5'))));
select pg_temp.note('A04 une seule ligne de reevaluation pour H2', '1', pg_temp.val($q$select count(*)::text from tarif_anomalies_reevaluations where article='essai-1' and fichier_hash='H2'$q$));

-- A05 : aggravee ; une nouvelle verification sur le nouveau fichier_hash est acceptee (l'historique en garde deux).
select pg_temp.note('A05 aggravee (hash H3)', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v1','essai-1','aggravee','H3','2026-11-18','4.5'))));
select pg_temp.note('A05 etat aggravee relu', 'aggravee', pg_temp.val($q$select etat from tarif_anomalies_reevaluations where article='essai-1' and fichier_hash='H3'$q$));
select pg_temp.note('A05 nouvelle verification sur H3 acceptee (o_deja faux)', 'f', pg_temp.val(format('select o_deja::text from tarif_marquer_verifie(%L::jsonb)', pg_temp.js('essai-1','00000000-0000-4000-8000-00000000f105','H3'))));
select pg_temp.note('A05 l historique garde deux verifications', '2', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-1'$q$));

-- A06 : resolue ecrite.
select pg_temp.note('A06 resolue (hash H4)', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v1','essai-1','resolue','H4','2026-11-19','0'))));
select pg_temp.note('A06 etat resolue relu', 'resolue', pg_temp.val($q$select etat from tarif_anomalies_reevaluations where article='essai-1' and fichier_hash='H4'$q$));
select pg_temp.note('A06 trois reevaluations pour la verification (persistante, aggravee, resolue)', '3', pg_temp.val($q$select count(*)::text from tarif_anomalies_reevaluations where article='essai-1'$q$));
reset role;

-- A07 : droits d'annulation et refus.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('A07 mA marque essai-m1 (a annuler par lui)', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-m1','00000000-0000-4000-8000-00000000f101','H1'))));
select pg_temp.note('A07 manager annule sa propre saisie', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-m1'$q$, pg_temp.u('mA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('mA2'));
select pg_temp.note('A07 mA2 marque essai-m2', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-m2','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('A07 un manager n annule pas la saisie d un autre manager (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-m2'$q$, pg_temp.u('mA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('A07 gerant annule la saisie d un manager', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-m2'$q$, pg_temp.u('gA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('pA'));
select pg_temp.note('A07 pompiste refuse', 'tarif_verif_reservee_manager_gerant', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-x1','00000000-0000-4000-8000-00000000f101','H1'))));
select pg_temp.note('A07 pompiste n annule rien (0 ligne)', 'ok n=0~permission denied', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-1'$q$, pg_temp.u('pA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('kA'));
select pg_temp.note('A07 caissier refuse', 'tarif_verif_reservee_manager_gerant', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-x2','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('iA'));
select pg_temp.note('A07 compte desactive refuse', 'tarif_verif_compte_inactif~tarif_verif_compte_illisible', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-x3','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('A07 createur sans role de manager refuse', 'tarif_verif_createur_lecture_seule~tarif_verif_reservee_manager_gerant', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-x4','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('anon', null);
select pg_temp.note('A07 anonyme refuse', 'permission denied~tarif_verif_session_absente', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-x5','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;

-- A08 : isolation entre sites.
select pg_temp.comme('authenticated', pg_temp.u('mB'));
select pg_temp.note('A08 manager du site B ne voit aucune verification de A', '0', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where site='site-fantome-test'$q$));
select pg_temp.note('A08 manager du site B ne voit aucune reevaluation de A', '0', pg_temp.val($q$select count(*)::text from tarif_anomalies_reevaluations where site='site-fantome-test'$q$));
select pg_temp.note('A08 B ne cite pas une verification de A', 'tarif_reeval_~23503', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v1','essai-1','persistante','H9','2026-11-20','3.5'))));
select pg_temp.note('A08 B ne cite pas un lot de A', 'tarif_verif_lot', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-b1','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;

-- A09 : commentaire de plus de 500 caracteres refuse.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('A09 commentaire de 501 caracteres refuse', 'tarif_verif_commentaire_trop_long', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c1','00000000-0000-4000-8000-00000000f101','H1',',"commentaire":"' || repeat('x',501) || '"'))));
select pg_temp.note('A09 commentaire de 500 caracteres accepte', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c2','00000000-0000-4000-8000-00000000f101','H1',',"commentaire":"' || repeat('x',500) || '"'))));
reset role;

-- A10 (partie dans la transaction) : comptes pendant la transaction ; la comparaison apres rollback est dans 51_comptes_apres_rollback.sql.
insert into ctl(nom, detail) select 'comptes_pendant', to_jsonb(q) from (select
  (select count(*) from tarif_anomalies_verifications) as verifications,
  (select count(*) from tarif_anomalies_reevaluations) as reevaluations,
  (select count(*) from import_batches) as import_batches) q;
select pg_temp.note('A10 des lignes existent avant rollback (preuve que le rollback aura quelque chose a defaire)', 't',
  (select ((a.detail->>'verifications')::int < (p.detail->>'verifications')::int and (a.detail->>'reevaluations')::int < (p.detail->>'reevaluations')::int and (a.detail->>'import_batches')::int < (p.detail->>'import_batches')::int)::text
   from ctl a, ctl p where a.nom='comptes_avant' and p.nom='comptes_pendant'));

select jsonb_pretty(jsonb_build_object(
  'bilan', (select count(*) filter (where ok) || '/' || count(*) || ' ok, ' || count(*) filter (where not ok) || ' KO' from journal),
  'assertions', (select jsonb_object_agg(a, v) from (select left(cas, 3) as a, case when bool_and(ok) then 'ok' else 'KO' end as v from journal group by left(cas, 3)) s),
  'cas', (select jsonb_agg(jsonb_build_object('n', n, 'cas', cas, 'attendu', attendu, 'obtenu', left(obtenu, 120), 'verdict', case when ok then 'ok' else 'KO' end) order by n) from journal),
  'controles', (select jsonb_object_agg(nom, detail) from ctl))) as preuve_cycle_verification_json;
rollback;
