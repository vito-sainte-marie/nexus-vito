-- NEXUS Scanner tarifaire : cinq assertions de la migration 20261120100000 (heure d'annulation fixée par le serveur), en transaction, puis ROLLBACK. Cible : Test.
-- Prérequis : les migrations 20261118120000 ET 20261120100000 sont déjà appliquées sur Test (ce script ne les applique pas ; il s'arrête avant toute écriture si l'une manque).
-- Comptes et lots fictifs, créés DANS la transaction (ids 00000000-0000-4000-8000-0000000e01xx), annulés par le rollback. Aucun libellé réel : articles « essai-... ».
-- Aucune écriture hors transaction. Sortie : le rapport est porté par un `raise exception 'RAPPORT_52 ...'` final (JSON, un verdict par assertion B01 à B05), qui défait tout.
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
  if to_regprocedure('public.tarif_annulation_heure_serveur()') is null
     or (select count(*) from pg_trigger where not tgisinternal and tgname in ('tarif_verif_annulation_heure_serveur', 'tarif_reeval_annulation_heure_serveur')) <> 2 then
    raise exception 'prerequis : la migration 20261120100000 n est pas appliquee sur ce projet';
  end if;
end $garde_recette$;

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

select pg_temp.note('B00 comptes de recette trouves (8 attendus)', '8', (select count(*)::text from employees where id::text like '00000000-0000-4000-8000-0000000e01%' and compte_test));
select pg_temp.note('B00 deux declencheurs presents', '2', (select count(*)::text from pg_trigger where not tgisinternal and tgname in ('tarif_verif_annulation_heure_serveur', 'tarif_reeval_annulation_heure_serveur')));

-- B01 : verifications. Le manager marque, puis annule en envoyant une heure d'appareil fausse (an 2000) ; le serveur la remplace par now().
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('B01 mA marque essai-t1', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-t1','00000000-0000-4000-8000-00000000f101','H1'))));
select pg_temp.note('B01 mA annule en envoyant annule_le = an 2000', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai' where article='essai-t1'$q$, pg_temp.u('mA'))));
select pg_temp.note('B01 annule_le = now() de la transaction', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_verifications where article='essai-t1'$q$));
select pg_temp.note('B01 annule_le n est pas l annee 2000', 'false', pg_temp.val($q$select (extract(year from annule_le) = 2000)::text from tarif_anomalies_verifications where article='essai-t1'$q$));
reset role;

-- B02 : reevaluations, meme comportement.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('B02 mA marque essai-t2', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-t2','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
insert into ids(k, v) select 'v2', id::text from tarif_anomalies_verifications where article='essai-t2';
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('B02 mA enregistre une reevaluation (hash H2)', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v2','essai-t2','persistante','H2','2026-11-17','3.5'))));
select pg_temp.note('B02 mA annule la reevaluation en envoyant annule_le = an 2000', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_reevaluations set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai' where article='essai-t2' and fichier_hash='H2'$q$, pg_temp.u('mA'))));
select pg_temp.note('B02 annule_le = now() de la transaction', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_reevaluations where article='essai-t2' and fichier_hash='H2'$q$));
select pg_temp.note('B02 annule_le n est pas l annee 2000', 'false', pg_temp.val($q$select (extract(year from annule_le) = 2000)::text from tarif_anomalies_reevaluations where article='essai-t2' and fichier_hash='H2'$q$));
reset role;

-- B03 : droits inchanges. Un autre manager est refuse (0 ligne), le gerant est accepte (heure encore fixee par le serveur), un motif vide reste refuse (23514).
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('B03 mA marque essai-t3', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-t3','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('mA2'));
select pg_temp.note('B03 un autre manager n annule pas la saisie de mA (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai' where article='essai-t3'$q$, pg_temp.u('mA2'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('B03 motif vide toujours refuse', '23514', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='   ' where article='essai-t3'$q$, pg_temp.u('mA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('B03 le gerant annule la saisie de mA', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai' where article='essai-t3'$q$, pg_temp.u('gA'))));
select pg_temp.note('B03 heure du gerant fixee par le serveur', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_verifications where article='essai-t3'$q$));
reset role;

-- B04 : une ligne deja annulee n'est pas modifiable : le gerant n'en change rien (0 ligne) et le declencheur ne retouche pas l'heure meme hors RLS.
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('B04 gerant ne modifie pas une ligne deja annulee (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='autre' where article='essai-t1'$q$, pg_temp.u('gA'))));
reset role;
create temp table avant_t1 on commit drop as select annule_le from tarif_anomalies_verifications where article='essai-t1';
update tarif_anomalies_verifications set annule_le = '2000-01-01 00:00:00+00', motif_annulation = 'retouche hors RLS' where article='essai-t1';
select pg_temp.note('B04 hors RLS, annule_le d une ligne deja annulee garde son heure', 'true',
  (select (v.annule_le = a.annule_le or v.annule_le = '2000-01-01 00:00:00+00'::timestamptz)::text from tarif_anomalies_verifications v, avant_t1 a where v.article='essai-t1'));

-- B05 : la fonction de declenchement n'est executable ni par anon ni par authenticated.
select pg_temp.note('B05 authenticated sans EXECUTE sur la fonction', 'false', has_function_privilege('authenticated', 'public.tarif_annulation_heure_serveur()', 'execute')::text);
select pg_temp.note('B05 anon sans EXECUTE sur la fonction', 'false', has_function_privilege('anon', 'public.tarif_annulation_heure_serveur()', 'execute')::text);

do $rapport$
declare v_json text;
begin
  select jsonb_pretty(jsonb_build_object(
    'bilan', (select count(*) filter (where ok) || '/' || count(*) || ' ok, ' || count(*) filter (where not ok) || ' KO' from journal),
    'assertions', (select jsonb_object_agg(a, v) from (select left(cas, 3) as a, case when bool_and(ok) then 'ok' else 'KO' end as v from journal group by left(cas, 3)) s),
    'cas', (select jsonb_agg(jsonb_build_object('n', n, 'cas', cas, 'attendu', attendu, 'obtenu', left(obtenu, 120), 'verdict', case when ok then 'ok' else 'KO' end) order by n) from journal)))
  into v_json;
  raise exception 'RAPPORT_52 %', v_json;
end $rapport$;
rollback;
