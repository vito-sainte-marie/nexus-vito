-- Recette SQL du Lot 1 "Dates courtes".
-- Chaque cas joue dans un sous-bloc annulé : rien ne subsiste. L'ensemble tourne dans une transaction rollbackée.
-- Données fictives : stations R1 et R2, comptes pseudonymes, produits fictifs. Seule exception : l'EAN de recette 3168930171683.
-- Sortie : une exception RAPPORT_DC1 <json> (verdict OK ou KO par cas, valeur attendue et mesurée).
-- Ne pas jouer sur Production. Sur Test : seulement sur accord.
begin;

do $garde_recette$
declare v_id text;
begin
  -- Banc jetable local (pglite) : seulement si le réglage est posé explicitement par l'opérateur du banc.
  if coalesce(current_setting('recette.banc_local', true), '') = 'pglite-jetable' then
    v_id := null;
  else
    select system_identifier::text into v_id from pg_control_system();
  end if;
  if coalesce(current_setting('recette.banc_local', true), '') <> 'pglite-jetable'
     and v_id is distinct from '7678069749886157684' then
    raise exception 'GARDE_RECETTE : base inattendue (%), arrêt', v_id;
  end if;
  if to_regprocedure('dates_courtes_enregistrer(text,text,jsonb)') is null then
    raise exception 'GARDE_RECETTE : migration dates_courtes_lot1 absente, arrêt';
  end if;
end
$garde_recette$;

create temp table journal (n serial, cas text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on journal to public;
grant usage on sequence journal_n_seq to public;

-- Stations de recette (R1, R2) : créées seulement si absentes, jamais modifiées durablement (tout est annulé).
insert into sites (site_id) select 'site-fantome-test' where not exists (select 1 from sites where site_id = 'site-fantome-test');
insert into sites (site_id) select 'nexus-station-test' where not exists (select 1 from sites where site_id = 'nexus-station-test');

-- Comptes pseudonymes. k : M1 manager, G1 gerant, C1 renfort créateur, RF1 renfort, CA1 caissier, P1 pompiste, V1 vacataire (tous R1) ; RF2, M2, CA2 (R2).
create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('M1',  '00000000-0000-4000-8000-0000000e0301', 'manager',  'site-fantome-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000e0302', 'gerant',   'site-fantome-test', false),
  ('C1',  '00000000-0000-4000-8000-0000000e0303', 'renfort',  'site-fantome-test', true),
  ('RF1', '00000000-0000-4000-8000-0000000e0304', 'renfort',  'site-fantome-test', false),
  ('CA1', '00000000-0000-4000-8000-0000000e0305', 'caissier', 'site-fantome-test', false),
  ('P1',  '00000000-0000-4000-8000-0000000e0306', 'pompiste', 'site-fantome-test', false),
  ('V1',  '00000000-0000-4000-8000-0000000e0307', 'vacataire','site-fantome-test', false),
  ('RF2', '00000000-0000-4000-8000-0000000e0308', 'renfort',  'nexus-station-test', false),
  ('M2',  '00000000-0000-4000-8000-0000000e0309', 'manager',  'nexus-station-test', false),
  ('CA2', '00000000-0000-4000-8000-0000000e030a', 'caissier', 'nexus-station-test', false);

insert into auth.users (id, aud, role, email)
select v, 'authenticated', 'authenticated', 'recette-dc1-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
select v, 'recette-dc1-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

insert into products (site, code_barres, nom) values
  ('site-fantome-test', '2000000000015', 'Produit fictif A'),
  ('site-fantome-test', '2000000000022', 'Produit fictif B'),
  ('site-fantome-test', '2000000000039', 'Produit fictif C'),
  ('nexus-station-test', '2000000000015', 'Produit fictif A');

-- Constantes : E1..E3 produits fictifs connus de R1, ER = EAN de recette (inconnu du catalogue).
create function pg_temp.e(k text) returns text language sql immutable as $$
  select case k when 'E1' then '2000000000015' when 'E2' then '2000000000022' when 'E3' then '2000000000039' when 'ER' then '3168930171683' end $$;
create function pg_temp.d(k text) returns text language sql stable as $$
  select case k when 'd1' then (current_date + 30)::text when 'd2' then (current_date + 40)::text when 'passee' then (current_date - 5)::text end $$;
create function pg_temp.sem() returns timestamptz language sql stable as $$ select dates_courtes_debut_semaine(now()) $$;

create function pg_temp.comme(k text) returns void language plpgsql as $$
declare v uuid;
begin
  reset role;
  select ids.v into v from ids where ids.k = comme.k;
  perform set_config('request.jwt.claims', json_build_object('sub', v, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;

-- Lit la vérité sans RLS puis rétablit le rôle courant.
create function pg_temp.vrai(q text) returns text language plpgsql as $$
declare r text; cur text := current_user;
begin
  reset role;
  execute q into r;
  if cur <> session_user then execute format('set local role %I', cur); end if;
  return r;
end $$;

create function pg_temp.exec(q text) returns void language plpgsql as $$
declare cur text := current_user;
begin
  reset role;
  execute q;
  if cur <> session_user then execute format('set local role %I', cur); end if;
end $$;

create function pg_temp.val(q text) returns text language plpgsql as $$
declare r text;
begin execute q into r; return r; end $$;

create function pg_temp.tente(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

-- Appelle une opération d'écriture : 'ok <json>' ou le message d'erreur.
create function pg_temp.er(op text, cle text, donnees jsonb) returns text language plpgsql as $$
begin return 'ok ' || public.dates_courtes_enregistrer(op, cle, donnees)::text;
exception when others then return sqlerrm; end $$;

create function pg_temp.ev(op text, cle text, donnees jsonb) returns jsonb language plpgsql as $$
begin return public.dates_courtes_enregistrer(op, cle, donnees); end $$;

create function pg_temp.appel(q text) returns text language plpgsql as $$
begin return 'ok ' || pg_temp.val('select public.' || q);
exception when others then return sqlerrm; end $$;

create function pg_temp.q(ean text, lib text, dt text) returns text language sql as $$
  select public.dates_courtes_quantite_active(ean, lib, dt::date)::text $$;

-- Note un verdict. attendu : alternatives séparées par ~ (sous-chaîne) ; "=x" exact ; "!x" ne doit pas contenir x.
create function pg_temp.n(acc jsonb, cas text, attendu text, obtenu text) returns jsonb language plpgsql as $$
declare a text; ok boolean := false;
begin
  foreach a in array string_to_array(attendu, '~') loop
    if left(a, 1) = '=' then ok := ok or coalesce(obtenu, '') = substr(a, 2);
    elsif left(a, 1) = '!' then ok := ok or position(substr(a, 2) in coalesce(obtenu, '')) = 0;
    else ok := ok or position(a in coalesce(obtenu, '')) > 0; end if;
  end loop;
  return acc || jsonb_build_array(jsonb_build_object('cas', cas, 'attendu', attendu, 'obtenu', obtenu, 'ok', ok));
end $$;

-- ===== Cas =====

create function pg_temp.c01(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c01a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4, 'libelle', 'frigo'));
  perform pg_temp.ev('releve', 'c01b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3, 'libelle', 'gondole'));
  r := pg_temp.n(r, '1 quantité', '=7', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '1 groupes', '=1', pg_temp.vrai(format('select count(distinct cle_groupe) from dates_courtes_releves where ean=%L', pg_temp.e('E1'))));
  r := pg_temp.n(r, '1 relevés visibles', '=2', pg_temp.val('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c02(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c02a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 5));
  perform pg_temp.ev('releve', 'c02b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d2'), 'quantite', 6));
  r := pg_temp.n(r, '2 groupes', '=2', pg_temp.vrai(format('select count(distinct cle_groupe) from dates_courtes_releves where ean=%L', pg_temp.e('E1'))));
  r := pg_temp.n(r, '2 date 1', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '2 date 2', '=6', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d2')));
  return r;
end $$;

create function pg_temp.c03(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c03a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 10));
  perform pg_temp.ev('correction', 'c03b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -2, 'motif', 'recompte'));
  r := pg_temp.n(r, '3 total', '=8', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '3 historique relevés', '=1', pg_temp.val('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '3 historique corrections', '=1', pg_temp.val('select count(*) from dates_courtes_corrections'));
  return r;
end $$;

create function pg_temp.c04(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; x1 text; x2 text;
begin
  perform pg_temp.comme('RF1');
  x1 := pg_temp.er('releve', 'c04', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  x2 := pg_temp.er('releve', 'c04', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  r := pg_temp.n(r, '4 premier envoi', 'cree', x1);
  r := pg_temp.n(r, '4 renvoi', 'deja_enregistre', x2);
  r := pg_temp.n(r, '4 une seule ligne', '=1', pg_temp.vrai('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '4 quantité', '=4', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

-- Limite assumée : les deux saisies sont séquentielles, pas parallèles. Elles prouvent l'addition sans écrasement (ajout seul).
create function pg_temp.c05(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c05a', jsonb_build_object('ean', pg_temp.e('E2'), 'date_limite', pg_temp.d('d1'), 'quantite', 5));
  perform pg_temp.comme('M1');
  perform pg_temp.ev('releve', 'c05b', jsonb_build_object('ean', pg_temp.e('E2'), 'date_limite', pg_temp.d('d1'), 'quantite', 6));
  r := pg_temp.n(r, '5 somme', '=11', pg_temp.q(pg_temp.e('E2'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '5 relevés conservés', '=2', pg_temp.vrai('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c06(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c06', jsonb_build_object('ean', pg_temp.e('ER'), 'date_limite', pg_temp.d('d1'), 'quantite', 2, 'libelle', 'Produit fictif R'));
  r := pg_temp.n(r, '6 marqué provisoire', '=true', pg_temp.vrai(format('select provisoire from dates_courtes_releves where ean=%L', pg_temp.e('ER'))));
  r := pg_temp.n(r, '6 aucune référence créée', '=0', pg_temp.vrai(format('select count(*) from products where code_barres=%L', pg_temp.e('ER'))));
  r := pg_temp.n(r, '6 est_provisoire', '=true', pg_temp.val(format('select dates_courtes_est_provisoire(%L)', pg_temp.e('ER'))));
  return r;
end $$;

create function pg_temp.c06b(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c06b1', jsonb_build_object('ean', pg_temp.e('ER'), 'date_limite', pg_temp.d('d1'), 'quantite', 2));
  perform pg_temp.exec(format('insert into products (site, code_barres, nom) values (%L, %L, %L)', 'site-fantome-test', pg_temp.e('ER'), 'Produit fictif R'));
  perform pg_temp.ev('releve', 'c06b2', jsonb_build_object('ean', pg_temp.e('ER'), 'date_limite', pg_temp.d('d1'), 'quantite', 1));
  r := pg_temp.n(r, '6b un seul groupe', '=1', pg_temp.vrai(format('select count(distinct cle_groupe) from dates_courtes_releves where ean=%L', pg_temp.e('ER'))));
  r := pg_temp.n(r, '6b quantité', '=3', pg_temp.q(pg_temp.e('ER'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '6b historique intact', '=2', pg_temp.val('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '6b plus provisoire', '=false', pg_temp.val(format('select dates_courtes_est_provisoire(%L)', pg_temp.e('ER'))));
  return r;
end $$;

create function pg_temp.c06c(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c06c1', jsonb_build_object('ean', pg_temp.e('ER'), 'date_limite', pg_temp.d('d1'), 'quantite', 2));
  perform pg_temp.ev('releve', 'c06c2', jsonb_build_object('ean', pg_temp.e('E2'), 'date_limite', pg_temp.d('d1'), 'quantite', 1));
  r := pg_temp.n(r, '6c renfort refusé', 'droit_refuse', pg_temp.appel(format('dates_courtes_poser_correspondance(%L,%L,%L)', 'ean', pg_temp.e('ER'), pg_temp.e('E2'))));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '6c manager accepté', 'ok', pg_temp.appel(format('dates_courtes_poser_correspondance(%L,%L,%L)', 'ean', pg_temp.e('ER'), pg_temp.e('E2'))));
  r := pg_temp.n(r, '6c trace auteur', '=true', pg_temp.vrai(format('select (saisi_par = %L::uuid and saisi_le is not null)::text from dates_courtes_correspondances where cle_ancienne=%L', (select v from ids where k = 'M1'), pg_temp.e('ER'))));
  r := pg_temp.n(r, '6c quantité rattachée', '=3', pg_temp.q(pg_temp.e('E2'), null, pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c07(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('CA1');
  r := pg_temp.n(r, '7 relevé', 'droit_refuse', pg_temp.er('releve', 'c07a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '7 ajout', 'droit_refuse', pg_temp.er('ajout', 'c07b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '7 correction', 'droit_refuse', pg_temp.er('correction', 'c07c', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -1, 'motif', 'x')));
  return r;
end $$;

create function pg_temp.c08(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; k text; op text; ops text[] := array['releve','ajout','correction','retrait','trouve_retire','changement_date','annulation']; i int := 0;
begin
  foreach k in array array['P1','V1'] loop
    perform pg_temp.comme(k);
    foreach op in array ops loop
      i := i + 1;
      r := pg_temp.n(r, '8 ' || k || ' ' || op, 'droit_refuse', pg_temp.er(op, 'c08' || i, jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
    end loop;
  end loop;
  return r;
end $$;

create function pg_temp.c10(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c10', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  perform pg_temp.comme('RF2');
  r := pg_temp.n(r, '10 lecture autre station', '=0', pg_temp.val('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '10 quantité autre station', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '10 modification impossible', '=0', pg_temp.val('with u as (update dates_courtes_releves set annule_le = now() returning 1) select count(*) from u'));
  r := pg_temp.n(r, '10 insertion directe refusée', '!ok', pg_temp.tente(format($q$insert into dates_courtes_releves (site, ean, date_limite, quantite, cle_groupe, tournee_id, heure_geste, cle_idempotence) values (%L, %L, %L, 1, 'x', gen_random_uuid(), now(), 'c10x')$q$, 'site-fantome-test', pg_temp.e('E1'), pg_temp.d('d1'))));
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '10 relevé intact', '=4', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c12(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  if a = 'C1' then perform pg_temp.exec('update sites set acces_createur_autorise = true where site_id = ''site-fantome-test'''); end if;
  perform pg_temp.comme('CA1');
  r := pg_temp.n(r, '12 ' || a || ' avant activation', 'droit_refuse', pg_temp.er('releve', 'c12a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  perform pg_temp.comme(a);
  r := pg_temp.n(r, '12 ' || a || ' active', 'ok', pg_temp.appel('dates_courtes_regler_acces_caissiere(true)'));
  perform pg_temp.comme('CA1');
  r := pg_temp.n(r, '12 ' || a || ' caissière ensuite', 'cree', pg_temp.er('releve', 'c12b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '12 ' || a || ' annulation refusée à la caissière', 'droit_refuse', pg_temp.er('annulation', 'c12c', jsonb_build_object('cible', 'releves', 'id', gen_random_uuid(), 'motif', 'x')));
  perform pg_temp.comme('CA2');
  r := pg_temp.n(r, '12 ' || a || ' autre station refusée', 'droit_refuse', pg_temp.er('releve', 'c12d', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  return r;
end $$;

create function pg_temp.c13(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme(a);
  r := pg_temp.n(r, '13 ' || a || ' refusé', 'droit_refuse', pg_temp.appel('dates_courtes_regler_acces_caissiere(true)'));
  r := pg_temp.n(r, '13 ' || a || ' aucune ligne', '=0', pg_temp.vrai('select count(*) from dates_courtes_acces_caissiere'));
  return r;
end $$;

create function pg_temp.c14(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('M1');
  perform pg_temp.appel('dates_courtes_regler_acces_caissiere(true)');
  perform pg_temp.comme('CA2');
  r := pg_temp.n(r, '14 R2 reste fermée', 'droit_refuse', pg_temp.er('releve', 'c14', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '14 aucune ligne R2', '=0', pg_temp.vrai('select count(*) from dates_courtes_acces_caissiere where site = ''nexus-station-test'''));
  return r;
end $$;

create function pg_temp.c15(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c15a', jsonb_build_object('libelle', 'Produit fictif sans code', 'date_limite', pg_temp.d('d1'), 'quantite', 2));
  perform pg_temp.ev('releve', 'c15b', jsonb_build_object('libelle', 'Produit fictif sans code', 'date_limite', pg_temp.d('d2'), 'quantite', 3));
  r := pg_temp.n(r, '15 deux groupes', '=2', pg_temp.vrai('select count(distinct cle_groupe) from dates_courtes_releves'));
  r := pg_temp.n(r, '15 date 1', '=2', pg_temp.q(null, 'Produit fictif sans code', pg_temp.d('d1')));
  r := pg_temp.n(r, '15 date 2', '=3', pg_temp.q(null, 'Produit fictif sans code', pg_temp.d('d2')));
  r := pg_temp.n(r, '15 relevés visibles', '=2', pg_temp.val('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c16(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c16a', jsonb_build_object('libelle', 'Produit fictif sans code', 'date_limite', pg_temp.d('d1'), 'quantite', 1));
  perform pg_temp.ev('releve', 'c16b', jsonb_build_object('libelle', '  PRODUIT   Fictif SANS code ', 'date_limite', pg_temp.d('d1'), 'quantite', 1));
  perform pg_temp.ev('releve', 'c16c', jsonb_build_object('libelle', '15/12 produit fictif sans code', 'date_limite', pg_temp.d('d1'), 'quantite', 1));
  r := pg_temp.n(r, '16 un seul groupe', '=1', pg_temp.vrai('select count(distinct cle_groupe) from dates_courtes_releves'));
  r := pg_temp.n(r, '16 quantité', '=3', pg_temp.q(null, 'Produit fictif sans code', pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c16b(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; ancien text := 'Produit fictif - 68P'; nouveau text := 'Produit fictif - 96P';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c16b1', jsonb_build_object('libelle', ancien, 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  perform pg_temp.ev('releve', 'c16b2', jsonb_build_object('libelle', nouveau, 'date_limite', pg_temp.d('d1'), 'quantite', 5));
  r := pg_temp.n(r, '16b deux groupes', '=2', pg_temp.vrai('select count(distinct cle_groupe) from dates_courtes_releves'));
  r := pg_temp.n(r, '16b renfort refusé', 'droit_refuse', pg_temp.appel(format('dates_courtes_poser_correspondance(%L,%L,%L)', 'libelle', ancien, nouveau)));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '16b manager accepté', 'ok', pg_temp.appel(format('dates_courtes_poser_correspondance(%L,%L,%L)', 'libelle', ancien, nouveau)));
  r := pg_temp.n(r, '16b un groupe', '=9', pg_temp.q(null, nouveau, pg_temp.d('d1')));
  r := pg_temp.n(r, '16b historique intact', '=2', pg_temp.vrai('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '16b geste tracé', '=1', pg_temp.vrai('select count(*) from dates_courtes_correspondances where saisi_par is not null'));
  return r;
end $$;

create function pg_temp.c17(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c17a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3));
  r := pg_temp.n(r, '17 refus', 'plancher_zero', pg_temp.er('correction', 'c17b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -5, 'motif', 'test')));
  r := pg_temp.n(r, '17 quantité inchangée', '=3', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

-- Tournée précédente : gestes datés de la semaine passée (heure_geste explicite).
create function pg_temp.prec() returns text language sql stable as $$ select (pg_temp.sem() - interval '2 days')::text $$;

create function pg_temp.c21(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c21a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 6));
  perform pg_temp.ev('releve', 'c21b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  r := pg_temp.n(r, '21 quantité', '=10', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c22_23(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c22a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 6, 'heure_geste', pg_temp.prec()));
  perform pg_temp.ev('releve', 'c22b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4, 'heure_geste', pg_temp.prec()));
  r := pg_temp.n(r, '22 avant relevé de la semaine', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  perform pg_temp.ev('releve', 'c22c', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  r := pg_temp.n(r, '22 quantité active 4 et non 14', '=4', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  perform pg_temp.ev('releve', 'c22d', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3));
  r := pg_temp.n(r, '23 second relevé', '=7', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '22 historique semaine 1 conservé', '=4', pg_temp.val('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c24(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c24', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 10, 'heure_geste', pg_temp.prec()));
  r := pg_temp.n(r, '24 quantité active', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '24 historique', '=1', pg_temp.val('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '24 aucun retrait ni correction créés', '=0', pg_temp.vrai('select (select count(*) from dates_courtes_retraits) + (select count(*) from dates_courtes_corrections)'));
  return r;
end $$;

create function pg_temp.c25(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  if a = 'C1' then perform pg_temp.exec('update sites set acces_createur_autorise = true where site_id = ''site-fantome-test'''); end if;
  perform pg_temp.comme(a);
  r := pg_temp.n(r, '25 ' || a || ' accepté', 'cree', pg_temp.appel('dates_courtes_ouvrir_tournee(''c25'')'));
  r := pg_temp.n(r, '25 ' || a || ' tracé', '=manuelle', pg_temp.vrai('select origine from dates_courtes_tournees where origine = ''manuelle'' and saisi_par is not null'));
  return r;
end $$;

create function pg_temp.c25r(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme(a);
  r := pg_temp.n(r, '25 ' || a || ' refusé', 'droit_refuse', pg_temp.appel('dates_courtes_ouvrir_tournee(''c25r'')'));
  r := pg_temp.n(r, '25 ' || a || ' aucune tournée manuelle', '=0', pg_temp.vrai('select count(*) from dates_courtes_tournees where origine = ''manuelle'''));
  return r;
end $$;

create function pg_temp.c26(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c26a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1, 'heure_geste', (pg_temp.sem() - interval '1 minute')::text));
  perform pg_temp.ev('releve', 'c26b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 2, 'heure_geste', pg_temp.sem()::text));
  r := pg_temp.n(r, '26 dimanche 23:59 dans l''ancienne', '=true', pg_temp.vrai(format('select (t.debut = %L::timestamptz - interval ''7 days'')::text from dates_courtes_releves r join dates_courtes_tournees t on t.id = r.tournee_id where r.cle_idempotence = ''c26a''', pg_temp.sem())));
  r := pg_temp.n(r, '26 lundi 00:00 dans la nouvelle', '=true', pg_temp.vrai(format('select (t.debut = %L::timestamptz)::text from dates_courtes_releves r join dates_courtes_tournees t on t.id = r.tournee_id where r.cle_idempotence = ''c26b''', pg_temp.sem())));
  r := pg_temp.n(r, '26 quantité active', '=2', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c27(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c27a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 8, 'heure_geste', pg_temp.prec()));
  perform pg_temp.ev('retrait', 'c27b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3, 'heure_geste', pg_temp.prec()));
  perform pg_temp.ev('releve', 'c27c', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 5));
  r := pg_temp.n(r, '27 quantité active', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '27 retrait dans l''historique', '=1', pg_temp.val('select count(*) from dates_courtes_retraits'));
  return r;
end $$;

create function pg_temp.c28(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c28a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  perform pg_temp.ev('releve', 'c28p', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3, 'heure_geste', (pg_temp.sem() - interval '20 minutes')::text));
  perform pg_temp.ev('retrait', 'c28b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 2, 'heure_geste', (pg_temp.sem() - interval '10 minutes')::text));
  r := pg_temp.n(r, '28 sans effet sur la nouvelle tournée', '=4', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '28 heure de réception conservée', '=true', pg_temp.vrai('select (recu_le > heure_geste)::text from dates_courtes_retraits'));
  return r;
end $$;

create function pg_temp.c30(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c30a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 10, 'heure_geste', pg_temp.prec()));
  perform pg_temp.ev('releve', 'c30b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d2'), 'quantite', 6));
  r := pg_temp.n(r, '30 date revue', '=6', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d2')));
  r := pg_temp.n(r, '30 date disparue', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '30 aucun retrait demandé', '=0', pg_temp.vrai('select count(*) from dates_courtes_retraits'));
  r := pg_temp.n(r, '30 historique semaine 1', '=2', pg_temp.val('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c31(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '31 trouvé et retiré sans relevé', 'cree', pg_temp.er('trouve_retire', 'c31', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3)));
  r := pg_temp.n(r, '31 quantité active', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '31 retiré à comptabiliser', '=3', pg_temp.vrai('select sum(quantite)::text from dates_courtes_retraits'));
  return r;
end $$;

create function pg_temp.c32(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c32a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 9));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '32 ouverture', 'cree', pg_temp.appel('dates_courtes_ouvrir_tournee(''c32'')'));
  r := pg_temp.n(r, '32 quantités à zéro', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c32b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  r := pg_temp.n(r, '32 premier relevé', '=4', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  perform pg_temp.ev('releve', 'c32c', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3));
  r := pg_temp.n(r, '32 second relevé', '=7', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '32 historique conservé', '=3', pg_temp.val('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c09(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c09a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 8));
  perform pg_temp.ev('retrait', 'c09b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3));
  r := pg_temp.n(r, '9 quantité active', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '9 retrait tracé', '=true', pg_temp.vrai(format('select (quantite = 3 and saisi_par = %L::uuid and heure_geste is not null)::text from dates_courtes_retraits', (select v from ids where k = 'RF1'))));
  return r;
end $$;

-- Cas 29 et 34, moitié du lot 1 : aucune ligne de retrait n'est créée par le simple fait de la date passée.
create function pg_temp.c29(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]';
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c29a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('passee'), 'quantite', 3));
  perform pg_temp.ev('releve', 'c34a', jsonb_build_object('ean', pg_temp.e('E2'), 'date_limite', pg_temp.d('passee'), 'quantite', 6, 'heure_geste', pg_temp.prec()));
  r := pg_temp.n(r, '29 quantité inchangée', '=3', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('passee')));
  r := pg_temp.n(r, '29 aucune ligne de retrait', '=0', pg_temp.vrai('select count(*) from dates_courtes_retraits'));
  r := pg_temp.n(r, '34 quantité venue de la tournée précédente', '=0', pg_temp.q(pg_temp.e('E2'), null, pg_temp.d('passee')));
  return r;
end $$;

create function pg_temp.c35(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; id1 text;
begin
  perform pg_temp.comme('RF1');
  perform pg_temp.ev('releve', 'c35a', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 4));
  r := pg_temp.n(r, '35 champ inconnu', 'champ_inconnu', pg_temp.er('releve', 'c35b', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1, 'site', 'nexus-station-test')));
  r := pg_temp.n(r, '35 geste dans le futur', 'heure_geste_hors_bornes', pg_temp.er('releve', 'c35c', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1, 'heure_geste', (now() + interval '2 days')::text)));
  r := pg_temp.n(r, '35 quantité zéro', 'valeur_invalide', pg_temp.er('releve', 'c35d', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 0)));
  r := pg_temp.n(r, '35 EAN invalide', 'ean_invalide', pg_temp.er('releve', 'c35e', jsonb_build_object('ean', '2000000000016', 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '35 clé requise', 'cle_idempotence_requise', pg_temp.er('releve', '', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  perform pg_temp.tente('delete from dates_courtes_releves');
  r := pg_temp.n(r, '35 suppression sans effet', '=1', pg_temp.vrai('select count(*) from dates_courtes_releves'));
  perform pg_temp.tente('update dates_courtes_releves set quantite = 99');
  r := pg_temp.n(r, '35 quantité non modifiable', '=4', pg_temp.vrai('select quantite::text from dates_courtes_releves'));
  id1 := pg_temp.vrai('select id::text from dates_courtes_releves');
  r := pg_temp.n(r, '35 annulation par un opérateur', 'annule', pg_temp.er('annulation', 'c35f', jsonb_build_object('cible', 'releves', 'id', id1, 'motif', 'erreur de saisie')));
  r := pg_temp.n(r, '35 quantité après annulation', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  perform pg_temp.exec('reset role');
  set local role anon;
  r := pg_temp.n(r, '35 anon refusé (table)', 'permission denied', pg_temp.tente('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '35 anon refusé (fonction)', 'permission denied', pg_temp.tente('select public.dates_courtes_enregistrer(''releve'',''c35g'',''{}''::jsonb)'));
  reset role;
  return r;
end $$;

-- Exécution : chaque cas dans un sous-bloc annulé ; le résultat survit par la variable.
create function pg_temp.jouer(nom text, arg text default null) returns void language plpgsql as $$
declare r jsonb := null; e jsonb; lbl text := nom || coalesce(' ' || arg, '');
begin
  begin
    execute format('select pg_temp.%I(%L)', nom, arg) into r;
    raise exception 'FIN_CAS';
  exception when others then
    if sqlerrm <> 'FIN_CAS' then
      r := jsonb_build_array(jsonb_build_object('cas', lbl, 'attendu', 'exécution sans exception', 'obtenu', 'ERREUR ' || sqlerrm, 'ok', false));
    end if;
  end;
  reset role;
  for e in select * from jsonb_array_elements(coalesce(r, '[]')) loop
    insert into journal (cas, attendu, obtenu, ok) values (e->>'cas', e->>'attendu', e->>'obtenu', (e->>'ok')::boolean);
  end loop;
end $$;

select pg_temp.jouer('c01');
select pg_temp.jouer('c02');
select pg_temp.jouer('c03');
select pg_temp.jouer('c04');
select pg_temp.jouer('c05');
select pg_temp.jouer('c06');
select pg_temp.jouer('c06b');
select pg_temp.jouer('c06c');
select pg_temp.jouer('c07');
select pg_temp.jouer('c08');
select pg_temp.jouer('c09');
select pg_temp.jouer('c10');
select pg_temp.jouer('c12', 'M1');
select pg_temp.jouer('c12', 'G1');
select pg_temp.jouer('c12', 'C1');
select pg_temp.jouer('c13', 'RF1');
select pg_temp.jouer('c13', 'CA1');
select pg_temp.jouer('c14');
select pg_temp.jouer('c15');
select pg_temp.jouer('c16');
select pg_temp.jouer('c16b');
select pg_temp.jouer('c17');
select pg_temp.jouer('c21');
select pg_temp.jouer('c22_23');
select pg_temp.jouer('c24');
select pg_temp.jouer('c25', 'M1');
select pg_temp.jouer('c25', 'G1');
select pg_temp.jouer('c25', 'C1');
select pg_temp.jouer('c25r', 'RF1');
select pg_temp.jouer('c25r', 'CA1');
select pg_temp.jouer('c26');
select pg_temp.jouer('c27');
select pg_temp.jouer('c28');
select pg_temp.jouer('c29');
select pg_temp.jouer('c30');
select pg_temp.jouer('c31');
select pg_temp.jouer('c32');
select pg_temp.jouer('c35');

do $rapport$
declare j jsonb;
begin
  select jsonb_build_object(
    'total', count(*), 'ok', count(*) filter (where ok), 'ko', count(*) filter (where not ok),
    'lignes', jsonb_agg(jsonb_build_object('cas', cas, 'attendu', attendu, 'obtenu', obtenu, 'verdict', case when ok then 'OK' else 'KO' end) order by n),
    'non_joues', 'cas 19, 20, 33 (lot 3), 11 et 18 (lot 2) ; moitié lot 3 des cas 9, 24, 27, 29, 30, 31, 32, 34'
  ) into j from journal;
  raise exception 'RAPPORT_DC1 %', j::text;
end
$rapport$;

rollback;
