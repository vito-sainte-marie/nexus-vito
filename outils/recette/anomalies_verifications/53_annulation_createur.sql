-- NEXUS Scanner tarifaire : assertions de la migration 20261121100000 (le compte createur peut ANNULER une verification, mais ne verifie toujours pas), en transaction, puis ROLLBACK. Cible : Test.
-- Prerequis : les migrations 20261118120000, 20261120100000 ET 20261121100000 sont deja appliquees sur Test (ce script ne les applique pas ; il s'arrete avant toute ecriture si l'une manque).
-- Comptes et lots fictifs, crees DANS la transaction (ids 00000000-0000-4000-8000-0000000e02xx), annules par le rollback. Aucun libelle reel : articles « essai-c... ».
-- Les drapeaux sites.acces_createur_autorise sont fixes DANS la transaction (vrai sur site-fantome-test, faux sur nexus-station-test) puis defaits par le rollback.
-- Aucune ecriture hors transaction. Sortie : le rapport est porte par un `raise exception 'RAPPORT_53 ...'` final (JSON, un verdict par assertion C01 a C10), qui defait tout.
begin;
do $garde_recette$
declare v_sysid bigint := (select system_identifier from pg_control_system());
begin
  if v_sysid is distinct from 7678069749886157684 then
    raise exception 'garde_projet_test : identifiant systeme % : ce n est pas le projet Supabase Test udljdqxerrbbbajxubfn', v_sysid;
  end if;
  if (select count(*) from public.sites where site_id in ('site-fantome-test', 'nexus-station-test')) <> 2 then
    raise exception 'garde_projet_test : sites de recette absents';
  end if;
  if to_regclass('public.tarif_anomalies_verifications') is null or to_regclass('public.tarif_anomalies_reevaluations') is null
     or to_regprocedure('public.tarif_marquer_verifie(jsonb)') is null or to_regprocedure('public.tarif_enregistrer_reevaluations(jsonb)') is null then
    raise exception 'prerequis : la migration 20261118120000 n est pas appliquee sur ce projet';
  end if;
  if to_regprocedure('public.tarif_annulation_heure_serveur()') is null then
    raise exception 'prerequis : la migration 20261120100000 n est pas appliquee sur ce projet';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and policyname = 'annulation_roles_meme_site'
        and tablename in ('tarif_anomalies_verifications', 'tarif_anomalies_reevaluations') and qual like '%je_suis_createur%') <> 2 then
    raise exception 'prerequis : la migration 20261121100000 n est pas appliquee sur ce projet (politique d annulation sans branche createur)';
  end if;
end $garde_recette$;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public; grant all on sequence journal_n_seq to public;
create temp table ids (k text, v text) on commit drop;
grant all on ids to public;

insert into auth.users(id, aud, role, email) select ('00000000-0000-4000-8000-0000000e02' || k)::uuid, 'authenticated', 'authenticated', 'recette-cycle-' || k || '@invalid.test'
from (values ('01'),('02'),('03'),('04'),('05'),('06'),('07'),('08')) t(k);
insert into employees(id, username, nom, role, actif, est_createur, site_id, compte_test)
select ('00000000-0000-4000-8000-0000000e02' || k)::uuid, 'recette-cycle-' || k, 'Recette cycle ' || k, r, a, c, s, true
from (values ('01','gerant',true,false,'site-fantome-test'), ('02','manager',true,false,'site-fantome-test'), ('03','manager',true,false,'site-fantome-test'),
  ('04','pompiste',true,false,'site-fantome-test'), ('05','caissier',true,true,'site-fantome-test'), ('06','manager',false,false,'site-fantome-test'),
  ('07','manager',true,false,'nexus-station-test'), ('08','caissier',true,false,'site-fantome-test')) t(k,r,a,c,s);
insert into ids(k, v) values ('gA','00000000-0000-4000-8000-0000000e0201'),('mA','00000000-0000-4000-8000-0000000e0202'),('mA2','00000000-0000-4000-8000-0000000e0203'),
  ('pA','00000000-0000-4000-8000-0000000e0204'),('cA','00000000-0000-4000-8000-0000000e0205'),('iA','00000000-0000-4000-8000-0000000e0206'),
  ('mB','00000000-0000-4000-8000-0000000e0207'),('kA','00000000-0000-4000-8000-0000000e0208');

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

insert into import_batches(id, site, intention, fichier_hash) values
  ('00000000-0000-4000-8000-00000000f101', 'site-fantome-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f102', 'site-fantome-test', 'stock_theorique', 'H2'),
  ('00000000-0000-4000-8000-00000000f103', 'nexus-station-test', 'stock_theorique', 'H1'),
  ('00000000-0000-4000-8000-00000000f105', 'site-fantome-test', 'stock_theorique', 'H3');


update sites set acces_createur_autorise = true where site_id = 'site-fantome-test';
update sites set acces_createur_autorise = false where site_id = 'nexus-station-test';

select pg_temp.note('C00 comptes de recette trouves (8 attendus)', '8', (select count(*)::text from employees where id::text like '00000000-0000-4000-8000-0000000e02%' and compte_test));
select pg_temp.note('C00 deux politiques d annulation avec branche createur', '2', (select count(*)::text from pg_policies where policyname = 'annulation_roles_meme_site' and qual like '%je_suis_createur%'));

-- C01 : un manager marque, le createur annule sa saisie. L'heure est fixee par le serveur, annule_par est le createur.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C01 mA marque essai-c1', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c1','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C01 le createur annule la saisie du manager', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai createur' where article='essai-c1'$q$, pg_temp.u('cA'))));
select pg_temp.note('C01 annule_le = now() de la transaction', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_verifications where article='essai-c1'$q$));
select pg_temp.note('C01 annule_par est le createur', 'true', pg_temp.val(format($q$select (annule_par = %L::uuid)::text from tarif_anomalies_verifications where article='essai-c1'$q$, pg_temp.u('cA'))));
reset role;

-- C02 : le createur annule aussi la saisie d'un gerant.
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('C02 gA marque essai-c2', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c2','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C02 le createur annule la saisie du gerant', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai createur' where article='essai-c2'$q$, pg_temp.u('cA'))));
reset role;

-- C03 : le createur ne verifie toujours pas (l'RPC garde son refus).
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C03 le createur ne marque pas verifie', 'tarif_verif_createur_lecture_seule', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c3','00000000-0000-4000-8000-00000000f101','H1'))));
select pg_temp.note('C03 aucune verification creee par le createur', '0', pg_temp.val($q$select count(*)::text from tarif_anomalies_verifications where article='essai-c3'$q$));
reset role;

-- C04 : site sans acces createur autorise : 0 ligne (nexus-station-test a le drapeau a faux).
select pg_temp.comme('authenticated', pg_temp.u('mB'));
select pg_temp.note('C04 mB marque essai-c4 sur l autre site', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c4','00000000-0000-4000-8000-00000000f103','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C04 le createur n annule pas sur un site sans acces createur autorise (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c4'$q$, pg_temp.u('cA'))));
reset role;

-- C05 : une ligne deja annulee n'est pas reprise.
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C05 le createur ne reprend pas une ligne deja annulee (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='autre' where article='essai-c1'$q$, pg_temp.u('cA'))));
reset role;

-- C06 : une autre colonne que les trois d'annulation reste interdite (privilege de colonne).
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C06 mA marque essai-c6', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c6','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C06 le createur ne modifie pas une autre colonne', '42501', pg_temp.tente($q$update tarif_anomalies_verifications set article='essai-c6-bis' where article='essai-c6'$q$));
reset role;

-- C07 : drapeau coupe sur le site : le createur n'annule plus rien.
update sites set acces_createur_autorise = false where site_id = 'site-fantome-test';
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C07 drapeau coupe : le createur n annule pas (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c6'$q$, pg_temp.u('cA'))));
reset role;
update sites set acces_createur_autorise = true where site_id = 'site-fantome-test';

-- C08 : reevaluations, meme comportement que les verifications.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C08 mA marque essai-c8', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c8','00000000-0000-4000-8000-00000000f101','H1'))));
reset role;
insert into ids(k, v) select 'v8', id::text from tarif_anomalies_verifications where article='essai-c8';
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C08 mA enregistre une reevaluation (hash H2)', 'ok n=1', pg_temp.tente(pg_temp.reeval(pg_temp.rj2('v8','essai-c8','persistante','H2','2026-11-17','3.5'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C08 le createur annule la reevaluation', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_reevaluations set annule_le='2000-01-01 00:00:00+00', annule_par=%L, motif_annulation='essai createur' where article='essai-c8' and fichier_hash='H2'$q$, pg_temp.u('cA'))));
select pg_temp.note('C08 annule_le = now() de la transaction', 'true', pg_temp.val($q$select (annule_le = now())::text from tarif_anomalies_reevaluations where article='essai-c8' and fichier_hash='H2'$q$));
reset role;

-- C09 : annule_par doit etre le createur lui-meme (pas celui d'un autre) ; un motif vide reste refuse.
select pg_temp.comme('authenticated', pg_temp.u('mA'));
select pg_temp.note('C09 mA marque essai-c9', 'ok n=1', pg_temp.tente(pg_temp.marque(pg_temp.js('essai-c9','00000000-0000-4000-8000-00000000f102','H2'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('cA'));
select pg_temp.note('C09 le createur ne signe pas au nom d un autre', '42501', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('mA'))));
select pg_temp.note('C09 motif vide refuse pour le createur', '23514', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='   ' where article='essai-c9'$q$, pg_temp.u('cA'))));
reset role;

-- C10 : droits des autres roles inchanges. Autre manager, pompiste, caissier non createur : 0 ligne ; le gerant annule.
select pg_temp.comme('authenticated', pg_temp.u('mA2'));
select pg_temp.note('C10 un autre manager n annule pas la saisie de mA (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('mA2'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('pA'));
select pg_temp.note('C10 le pompiste n annule pas (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('pA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('kA'));
select pg_temp.note('C10 le caissier non createur n annule pas (0 ligne)', 'ok n=0', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('kA'))));
reset role;
select pg_temp.comme('authenticated', pg_temp.u('gA'));
select pg_temp.note('C10 le gerant annule la saisie de mA', 'ok n=1', pg_temp.tente(format($q$update tarif_anomalies_verifications set annule_le=now(), annule_par=%L, motif_annulation='essai' where article='essai-c9'$q$, pg_temp.u('gA'))));
reset role;

do $rapport$
declare v_json text;
begin
  select jsonb_pretty(jsonb_build_object(
    'bilan', (select count(*) filter (where ok) || '/' || count(*) || ' ok, ' || count(*) filter (where not ok) || ' KO' from journal),
    'assertions', (select jsonb_object_agg(a, v) from (select left(cas, 3) as a, case when bool_and(ok) then 'ok' else 'KO' end as v from journal group by left(cas, 3)) s),
    'cas', (select jsonb_agg(jsonb_build_object('n', n, 'cas', cas, 'attendu', attendu, 'obtenu', left(obtenu, 120), 'verdict', case when ok then 'ok' else 'KO' end) order by n) from journal)))
  into v_json;
  raise exception 'RAPPORT_53 %', v_json;
end $rapport$;
rollback;
