-- Recette SQL du Lot 1 "Dates courtes" (v4 : tournées individuelles, démarque comptabilisée).
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
  select public.dates_courtes_quantite_courante(ean, lib, dt::date)::text $$;

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
create function pg_temp.tn(cle text) returns text language sql as $$
  select (public.dates_courtes_creer_tournee('recette', cle) ->> 'tournee_id') $$;
create function pg_temp.rel(cle text, t text, ean text, dt text, qte int, extra jsonb default '{}') returns text language sql as $$
  select pg_temp.er('releve', cle, jsonb_build_object('tournee_id', t, 'ean', ean, 'date_limite', dt, 'quantite', qte) || extra) $$;
create function pg_temp.ligne(col text, ean text, dt text) returns text language plpgsql as $$
declare r text;
begin
  execute format('select %I::text from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date limit 1', col, ean, dt) into r;
  return r;
end $$;

create function pg_temp.c01(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t01');
  perform pg_temp.rel('c01a', t, pg_temp.e('E1'), pg_temp.d('d1'), 4, '{"libelle":"frigo"}');
  perform pg_temp.rel('c01b', t, pg_temp.e('E1'), pg_temp.d('d1'), 3, '{"libelle":"gondole"}');
  r := pg_temp.n(r, '1 quantité dans la tournée', '=7', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '1 relevés visibles', '=2', pg_temp.val('select count(*) from dates_courtes_releves'));
  return r;
end $$;

create function pg_temp.c02(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t02');
  perform pg_temp.rel('c02a', t, pg_temp.e('E1'), pg_temp.d('d1'), 5);
  perform pg_temp.rel('c02b', t, pg_temp.e('E1'), pg_temp.d('d2'), 6);
  r := pg_temp.n(r, '2 date 1', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '2 date 2', '=6', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d2')));
  return r;
end $$;

create function pg_temp.c03(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t03');
  perform pg_temp.rel('c03a', t, pg_temp.e('E1'), pg_temp.d('d1'), 10);
  perform pg_temp.ev('correction', 'c03b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -2, 'motif', 'recompte'));
  r := pg_temp.n(r, '3 total', '=8', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '3 relevés conservés', '=1', pg_temp.val('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '3 corrections conservées', '=1', pg_temp.val('select count(*) from dates_courtes_corrections'));
  return r;
end $$;

create function pg_temp.c04(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; x1 text; x2 text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t04');
  x1 := pg_temp.rel('c04', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  x2 := pg_temp.rel('c04', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  r := pg_temp.n(r, '4 premier envoi', 'cree', x1);
  r := pg_temp.n(r, '4 rejeu réseau', 'deja_enregistre', x2);
  r := pg_temp.n(r, '4 une seule ligne', '=1', pg_temp.vrai('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '4 tournée rejouée', 'deja_enregistre', pg_temp.val('select public.dates_courtes_creer_tournee(''recette'', ''t04'')::text'));
  return r;
end $$;

create function pg_temp.c05(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t1 text; t2 text;
begin
  perform pg_temp.comme('RF1'); t1 := pg_temp.tn('t05a');
  perform pg_temp.rel('c05a', t1, pg_temp.e('E1'), pg_temp.d('d1'), 5, jsonb_build_object('heure_geste', (now() - interval '3 hours')::text));
  perform pg_temp.comme('M1'); t2 := pg_temp.tn('t05b');
  perform pg_temp.rel('c05b', t2, pg_temp.e('E1'), pg_temp.d('d1'), 3, jsonb_build_object('heure_geste', (now() - interval '1 hour')::text));
  r := pg_temp.n(r, '5 le relevé le plus récent fait foi', '=3', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '5 tournée retenue', t2, pg_temp.ligne('tournee_id', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '5 autre tournée listée', t1, pg_temp.ligne('autres_tournees', pg_temp.e('E1'), pg_temp.d('d1')));
  perform pg_temp.comme('RF1');
  perform pg_temp.rel('c05c', t1, pg_temp.e('E1'), pg_temp.d('d1'), 2, jsonb_build_object('heure_geste', now()::text));
  r := pg_temp.n(r, '5 un relevé plus récent déplace la référence', '=7', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c06(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t06');
  perform pg_temp.rel('c06a', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  r := pg_temp.n(r, '6 correction sous zéro refusée', 'plancher_zero', pg_temp.er('correction', 'c06b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -9, 'motif', 'trop retiré')));
  r := pg_temp.n(r, '6 quantité inchangée', '=4', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  perform pg_temp.er('correction', 'c06c', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -4, 'motif', 'tout retiré'));
  r := pg_temp.n(r, '6 plancher atteint à zéro', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c07(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t07');
  perform pg_temp.rel('c07a', t, pg_temp.e('E1'), pg_temp.d('d1'), 8);
  r := pg_temp.n(r, '7 retrait de 3', 'cree', pg_temp.er('retrait', 'c07b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3)));
  r := pg_temp.n(r, '7 reste 5', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '7 retrait conservé', '=3', pg_temp.vrai('select sum(quantite) from dates_courtes_retraits'));
  return r;
end $$;

create function pg_temp.c08(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t08');
  r := pg_temp.n(r, '8 trouvé déjà retiré', 'cree', pg_temp.er('trouve_retire', 'c08a', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 3)));
  r := pg_temp.n(r, '8 la tournée garde zéro', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '8 le retrait porte 3', '=3', pg_temp.vrai('select sum(quantite) from dates_courtes_retraits'));
  return r;
end $$;

create function pg_temp.c09(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t09');
  perform pg_temp.rel('c09a', t, pg_temp.e('E1'), pg_temp.d('d1'), 8);
  r := pg_temp.n(r, '9 changement de date', 'cree', pg_temp.er('changement_date', 'c09b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'ancienne_date', pg_temp.d('d1'), 'nouvelle_date', pg_temp.d('d2'), 'quantite', 3, 'motif', 'date relue')));
  r := pg_temp.n(r, '9 ancienne date', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '9 nouvelle date', '=3', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d2')));
  return r;
end $$;

create function pg_temp.c10(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t10');
  r := pg_temp.n(r, '10 champ inconnu', 'champ_inconnu', pg_temp.rel('c10a', t, pg_temp.e('E1'), pg_temp.d('d1'), 1, '{"site":"nexus-station-test"}'));
  r := pg_temp.n(r, '10 geste dans le futur', 'heure_geste_hors_bornes', pg_temp.rel('c10b', t, pg_temp.e('E1'), pg_temp.d('d1'), 1, jsonb_build_object('heure_geste', (now() + interval '2 days')::text)));
  r := pg_temp.n(r, '10 quantité zéro', 'valeur_invalide', pg_temp.rel('c10c', t, pg_temp.e('E1'), pg_temp.d('d1'), 0));
  r := pg_temp.n(r, '10 EAN invalide', 'ean_invalide', pg_temp.rel('c10d', t, '2000000000016', pg_temp.d('d1'), 1));
  r := pg_temp.n(r, '10 clé requise', 'cle_idempotence_requise', pg_temp.rel('', t, pg_temp.e('E1'), pg_temp.d('d1'), 1));
  r := pg_temp.n(r, '10 tournée requise', 'tournee_requise', pg_temp.er('releve', 'c10e', jsonb_build_object('ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '10 date requise', 'date_limite_requise', pg_temp.er('releve', 'c10f', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'quantite', 1)));
  r := pg_temp.n(r, '10 opération inconnue', 'operation_inconnue', pg_temp.er('zzz', 'c10g', '{}'));
  return r;
end $$;

create function pg_temp.c12(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; x text;
begin
  perform pg_temp.comme(a);
  x := pg_temp.appel('dates_courtes_creer_tournee(''recette'', ''t12'')');
  if a in ('M1', 'G1', 'C1', 'RF1') then
    r := pg_temp.n(r, '12 ' || a || ' crée une tournée', 'cree', x);
    t := pg_temp.tn('t12');
    r := pg_temp.n(r, '12 ' || a || ' relève', 'cree', pg_temp.rel('c12a', t, pg_temp.e('E1'), pg_temp.d('d1'), 2));
    r := pg_temp.n(r, '12 ' || a || ' retire', 'cree', pg_temp.er('retrait', 'c12b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  else
    r := pg_temp.n(r, '12 ' || a || ' refusé', 'droit_refuse', x);
  end if;
  return r;
end $$;

create function pg_temp.c13(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('CA1');
  r := pg_temp.n(r, '13 caissier sans interrupteur', 'droit_refuse', pg_temp.appel('dates_courtes_creer_tournee(''recette'', ''t13'')'));
  r := pg_temp.n(r, '13 caissier ne règle pas', 'droit_refuse', pg_temp.appel('dates_courtes_regler_acces_caissier(true)'));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '13 manager ouvre', 'ok', pg_temp.appel('dates_courtes_regler_acces_caissier(true)'));
  perform pg_temp.comme('CA1'); t := pg_temp.tn('t13');
  r := pg_temp.n(r, '13 caissier relève', 'cree', pg_temp.rel('c13a', t, pg_temp.e('E1'), pg_temp.d('d1'), 2));
  r := pg_temp.n(r, '13 caissier ne retire pas', 'droit_refuse', pg_temp.er('retrait', 'c13b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 1)));
  r := pg_temp.n(r, '13 caissier ne comptabilise pas', 'droit_refuse', pg_temp.appel('dates_courtes_comptabiliser_demarque(gen_random_uuid(), 1, null, ''c13c'')'));
  return r;
end $$;

create function pg_temp.c14(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t14');
  perform pg_temp.rel('c14a', t, pg_temp.e('E1'), pg_temp.d('passee'), 2, jsonb_build_object('heure_geste', (now() - interval '3 days')::text));
  perform pg_temp.rel('c14b', t, pg_temp.e('E2'), pg_temp.d('passee'), 2, jsonb_build_object('heure_geste', (now() - interval '10 days')::text));
  perform pg_temp.rel('c14c', t, pg_temp.e('E3'), pg_temp.d('passee'), 2, jsonb_build_object('heure_geste', (now() - interval '20 days')::text));
  perform pg_temp.rel('c14d', t, pg_temp.e('E1'), pg_temp.d('d1'), 2, jsonb_build_object('heure_geste', (now() - interval '20 days')::text));
  r := pg_temp.n(r, '14 courante', 'courante', pg_temp.ligne('etat_age', pg_temp.e('E1'), pg_temp.d('passee')));
  r := pg_temp.n(r, '14 passée et récente : à retirer', 'a_retirer', pg_temp.ligne('echeance', pg_temp.e('E1'), pg_temp.d('passee')));
  r := pg_temp.n(r, '14 8 à 14 jours', 'a_verifier', pg_temp.ligne('etat_age', pg_temp.e('E2'), pg_temp.d('passee')));
  r := pg_temp.n(r, '14 passée et ancienne : dépassée à vérifier', 'depassee_a_verifier', pg_temp.ligne('echeance', pg_temp.e('E2'), pg_temp.d('passee')));
  r := pg_temp.n(r, '14 plus de 14 jours', 'a_recontroler', pg_temp.ligne('etat_age', pg_temp.e('E3'), pg_temp.d('passee')));
  r := pg_temp.n(r, '14 date future ancienne : aucune échéance', 'aucune', pg_temp.ligne('echeance', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c15(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t15');
  perform pg_temp.rel('c15a', t, pg_temp.e('E1'), pg_temp.d('d1'), 6, jsonb_build_object('heure_geste', (now() - interval '20 days')::text));
  perform pg_temp.ev('correction', 'c15b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'delta', -1, 'motif', 'recompte'));
  r := pg_temp.n(r, '15 quantité corrigée', '=5', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '15 la ligne reste ancienne', 'a_recontroler', pg_temp.ligne('etat_age', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c16(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; dem text; rl text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t16');
  perform pg_temp.rel('c16a', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  rl := pg_temp.vrai('select id::text from dates_courtes_releves limit 1');
  r := pg_temp.n(r, '16 état initial', 'EN_COURS', pg_temp.vrai(format('select etat from dates_courtes_tournees where id = %L', t)));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '16 certifier avant la fin', 'etat_incompatible', pg_temp.appel(format('dates_courtes_certifier_tournee(%L, null, ''c16x'')', t)));
  r := pg_temp.n(r, '16 un autre ne termine pas', 'tournee_interdite', pg_temp.appel(format('dates_courtes_terminer_tournee(%L)', t)));
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '16 terminer', 'terminee', pg_temp.appel(format('dates_courtes_terminer_tournee(%L)', t)));
  r := pg_temp.n(r, '16 terminer deux fois', 'deja_terminee', pg_temp.appel(format('dates_courtes_terminer_tournee(%L)', t)));
  r := pg_temp.n(r, '16 état après fin', 'TERMINEE_A_CERTIFIER', pg_temp.vrai(format('select etat from dates_courtes_tournees where id = %L', t)));
  r := pg_temp.n(r, '16 le renfort ne certifie pas', 'droit_refuse', pg_temp.appel(format('dates_courtes_certifier_tournee(%L, null, ''c16y'')', t)));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '16 le manager certifie', 'cree', pg_temp.appel(format('dates_courtes_certifier_tournee(%L, ''ras'', ''c16z'')', t)));
  r := pg_temp.n(r, '16 rejeu de la certification', 'deja_enregistre', pg_temp.appel(format('dates_courtes_certifier_tournee(%L, ''ras'', ''c16z'')', t)));
  r := pg_temp.n(r, '16 état certifié', 'CERTIFIEE', pg_temp.vrai(format('select etat from dates_courtes_tournees where id = %L', t)));
  r := pg_temp.n(r, '16 motif requis', 'motif_requis', pg_temp.appel(format('dates_courtes_demander_correction(%L, array[%L]::uuid[], '''', ''c16d'')', t, rl)));
  r := pg_temp.n(r, '16 relevés requis', 'releves_requis', pg_temp.appel(format('dates_courtes_demander_correction(%L, array[]::uuid[], ''relire'', ''c16e'')', t)));
  r := pg_temp.n(r, '16 demande de correction', 'cree', pg_temp.appel(format('dates_courtes_demander_correction(%L, array[%L]::uuid[], ''relire la date'', ''c16f'')', t, rl)));
  r := pg_temp.n(r, '16 état correction demandée', 'CORRECTION_DEMANDEE', pg_temp.vrai(format('select etat from dates_courtes_tournees where id = %L', t)));
  dem := pg_temp.vrai('select id::text from dates_courtes_demandes_correction limit 1');
  r := pg_temp.n(r, '16 un autre ne répond pas', 'tournee_interdite', pg_temp.appel(format('dates_courtes_repondre_correction(%L, ''ok'')', dem)));
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '16 réponse requise', 'reponse_requise', pg_temp.appel(format('dates_courtes_repondre_correction(%L, '''')', dem)));
  r := pg_temp.n(r, '16 réponse', 'repondue', pg_temp.appel(format('dates_courtes_repondre_correction(%L, ''date relue, inchangée'')', dem)));
  r := pg_temp.n(r, '16 deuxième réponse', 'deja_repondue', pg_temp.appel(format('dates_courtes_repondre_correction(%L, ''encore'')', dem)));
  r := pg_temp.n(r, '16 retour à certifier', 'TERMINEE_A_CERTIFIER', pg_temp.vrai(format('select etat from dates_courtes_tournees where id = %L', t)));
  return r;
end $$;

create function pg_temp.c17(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; rt text; did text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t17');
  perform pg_temp.rel('c17a', t, pg_temp.e('E1'), pg_temp.d('d1'), 8);
  perform pg_temp.er('retrait', 'c17b', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 5));
  rt := pg_temp.vrai('select id::text from dates_courtes_retraits limit 1');
  r := pg_temp.n(r, '17 le renfort est refusé', 'droit_refuse', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 2, null, ''c17x'')', rt)));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '17 clé requise', 'cle_idempotence_requise', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 2, null, '''')', rt)));
  r := pg_temp.n(r, '17 quantité positive', 'valeur_invalide', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 0, null, ''c17y'')', rt)));
  r := pg_temp.n(r, '17 supérieure au retrait', 'quantite_superieure_au_retrait', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 6, null, ''c17z'')', rt)));
  r := pg_temp.n(r, '17 le manager comptabilise', 'cree', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 3, ''casse'', ''c17k'')', rt)));
  r := pg_temp.n(r, '17 rejeu réseau', 'deja_enregistre', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 3, ''casse'', ''c17k'')', rt)));
  r := pg_temp.n(r, '17 une seule démarque', '=1', pg_temp.vrai('select count(*) from dates_courtes_demarques'));
  r := pg_temp.n(r, '17 cumul supérieur au retrait', 'quantite_superieure_au_retrait', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 3, null, ''c17m'')', rt)));
  r := pg_temp.n(r, '17 cumul exact', 'cree', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 2, null, ''c17n'')', rt)));
  r := pg_temp.n(r, '17 retrait inconnu', 'introuvable', pg_temp.appel('dates_courtes_comptabiliser_demarque(gen_random_uuid(), 1, null, ''c17p'')'));
  r := pg_temp.n(r, '17 retrait avec démarque non annulable', 'demarque_existante', pg_temp.er('annulation', 'c17q', jsonb_build_object('cible', 'retraits', 'id', rt, 'motif', 'erreur')));
  did := pg_temp.vrai('select id::text from dates_courtes_demarques where cle_idempotence = ''c17n''');
  r := pg_temp.n(r, '17 annulation de la démarque', 'annule', pg_temp.appel(format('dates_courtes_annuler_demarque(%L, ''erreur de saisie'')', did)));
  r := pg_temp.n(r, '17 quantité libérée', 'cree', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 2, null, ''c17r'')', rt)));
  r := pg_temp.n(r, '17 la quantité courante ne bouge pas', '=3', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '17 aucune colonne de valeur en euros', '=0', pg_temp.vrai('select count(*) from pg_attribute where attrelid = ''dates_courtes_demarques''::regclass and attnum > 0 and attname ~ ''(^|_)(eur|euro|euros|prix|valeur|montant|cout)(_|$)'''));
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '17 le renfort ne lit pas les démarques', '=0', pg_temp.val('select count(*) from dates_courtes_demarques'));
  perform pg_temp.comme('M2');
  r := pg_temp.n(r, '17 une autre station ne comptabilise pas', '!ok ', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 1, null, ''c17s'')', rt)));
  return r;
end $$;

create function pg_temp.c18(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; rt text; k text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t18');
  perform pg_temp.er('trouve_retire', 'c18a', jsonb_build_object('tournee_id', t, 'ean', pg_temp.e('E1'), 'date_limite', pg_temp.d('d1'), 'quantite', 2));
  rt := pg_temp.vrai('select id::text from dates_courtes_retraits limit 1');
  perform pg_temp.comme('G1');
  r := pg_temp.n(r, '18 le gérant comptabilise', 'cree', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 2, null, ''c18b'')', rt)));
  perform pg_temp.comme('C1');
  r := pg_temp.n(r, '18 créateur sans accès créateur sur la station', 'droit_refuse', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 1, null, ''c18c'')', rt)));
  reset role;
  update sites set acces_createur_autorise = true where site_id = 'site-fantome-test';
  perform pg_temp.comme('C1');
  r := pg_temp.n(r, '18 créateur autorisé (borne atteinte)', 'quantite_superieure_au_retrait', pg_temp.appel(format('dates_courtes_comptabiliser_demarque(%L, 1, null, ''c18e'')', rt)));
  foreach k in array array['CA1','P1','V1'] loop
    perform pg_temp.comme(k);
    r := pg_temp.n(r, '18 ' || k || ' refusé', 'droit_refuse', pg_temp.appel('dates_courtes_comptabiliser_demarque(gen_random_uuid(), 1, null, ''c18d'')'));
  end loop;
  return r;
end $$;

create function pg_temp.c19(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t19');
  perform pg_temp.rel('c19a', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  perform pg_temp.comme('RF2');
  r := pg_temp.n(r, '19 relevés invisibles', '=0', pg_temp.val('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '19 quantité courante vide', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  r := pg_temp.n(r, '19 tournée étrangère refusée', '!ok ', pg_temp.rel('c19b', t, pg_temp.e('E1'), pg_temp.d('d1'), 1));
  return r;
end $$;

create function pg_temp.c20(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; id1 text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t20');
  perform pg_temp.rel('c20a', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  perform pg_temp.tente('delete from dates_courtes_releves');
  r := pg_temp.n(r, '20 suppression sans effet', '=1', pg_temp.vrai('select count(*) from dates_courtes_releves'));
  perform pg_temp.tente('update dates_courtes_releves set quantite = 99');
  r := pg_temp.n(r, '20 quantité non modifiable', '=4', pg_temp.vrai('select quantite::text from dates_courtes_releves'));
  id1 := pg_temp.vrai('select id::text from dates_courtes_releves');
  r := pg_temp.n(r, '20 annulation par un opérateur', 'annule', pg_temp.er('annulation', 'c20b', jsonb_build_object('cible', 'releves', 'id', id1, 'motif', 'erreur de saisie')));
  r := pg_temp.n(r, '20 annulation rejouée', 'deja_annule', pg_temp.er('annulation', 'c20c', jsonb_build_object('cible', 'releves', 'id', id1, 'motif', 'erreur de saisie')));
  r := pg_temp.n(r, '20 quantité après annulation', '=0', pg_temp.q(pg_temp.e('E1'), null, pg_temp.d('d1')));
  reset role;
  set local role anon;
  r := pg_temp.n(r, '20 anon refusé (table)', 'permission denied', pg_temp.tente('select count(*) from dates_courtes_releves'));
  r := pg_temp.n(r, '20 anon refusé (fonction)', 'permission denied', pg_temp.tente('select public.dates_courtes_enregistrer(''releve'',''c20d'',''{}''::jsonb)'));
  r := pg_temp.n(r, '20 anon refusé (démarque)', 'permission denied', pg_temp.tente('select public.dates_courtes_comptabiliser_demarque(gen_random_uuid(), 1, null, ''c20e'')'));
  reset role;
  return r;
end $$;

create function pg_temp.c21(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; t text; v1 text; v2 text;
begin
  perform pg_temp.comme('RF1'); t := pg_temp.tn('t21');
  v1 := pg_temp.val(format('select public.dates_courtes_version_tournee(%L)::text', t));
  perform pg_temp.rel('c21a', t, pg_temp.e('E1'), pg_temp.d('d1'), 4);
  v2 := pg_temp.val(format('select public.dates_courtes_version_tournee(%L)::text', t));
  r := pg_temp.n(r, '21 la version change après un relevé', '=1', (v1 is distinct from v2)::int::text);
  return r;
end $$;

-- Cas 22 à 26 : un retrait n'est pas un relevé ; quantité courante sur toute la station ; mêmes valeurs pour renfort et manager.
create function pg_temp.h(k int) returns text language sql stable as $$ select (date_trunc('minute', now()) - make_interval(hours => k))::text $$;
create function pg_temp.ret(op text, cle text, t text, ean text, dt text, qte int, hk int) returns text language sql as $$
  select pg_temp.er(op, cle, jsonb_build_object('tournee_id', t, 'ean', ean, 'date_limite', dt, 'quantite', qte, 'heure_geste', pg_temp.h(hk))) $$;
create function pg_temp.relh(cle text, t text, ean text, dt text, qte int, hk int) returns text language sql as $$
  select pg_temp.er('releve', cle, jsonb_build_object('tournee_id', t, 'ean', ean, 'date_limite', dt, 'quantite', qte, 'heure_geste', pg_temp.h(hk))) $$;

create function pg_temp.c22(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text; o text;
begin
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t22m');
  perform pg_temp.relh('c22a', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 5);
  perform pg_temp.relh('c22b', tm, pg_temp.e('E1'), pg_temp.d('d2'), 4, 5);
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t22r');
  o := pg_temp.ret('trouve_retire', 'c22c', tr, pg_temp.e('E1'), pg_temp.d('d1'), 2, 4);
  r := pg_temp.n(r, '22 trouvé-retiré accepté', 'ok', o);
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '22 D1 diminuée à 3', '=3', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '22 D2 inchangée à 4', '=4', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d2')));
  r := pg_temp.n(r, '22 tournée de référence : celle du relevé', '=' || tm, pg_temp.ligne('tournee_id', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '22 âge compté depuis le relevé, pas depuis le retrait', '=' || pg_temp.vrai(format('select (now() at time zone ''America/Martinique'')::date - ((%L)::timestamptz at time zone ''America/Martinique'')::date', pg_temp.h(5))),
                 pg_temp.ligne('age_jours', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '22 dernier relevé inchangé', '=' || pg_temp.vrai(format('select (%L)::timestamptz::text', pg_temp.h(5))),
                 pg_temp.vrai(format('select dernier_releve::text from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date', pg_temp.e('E1'), pg_temp.d('d1'))));
  perform pg_temp.comme('RF1');
  o := pg_temp.ret('retrait', 'c22d', tr, pg_temp.e('E1'), pg_temp.d('d1'), 1, 3);
  r := pg_temp.n(r, '22 retrait physique accepté', 'ok', o);
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '22 D1 à 2, tournée de référence toujours M1', '=2|' || tm, pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')) || '|' || pg_temp.ligne('tournee_id', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c23(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text;
begin
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t23m');
  perform pg_temp.relh('c23a', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 5);
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t23r');
  r := pg_temp.n(r, '23 retrait de 6 sur 5 refusé depuis une autre tournée', 'plancher_zero', pg_temp.ret('retrait', 'c23b', tr, pg_temp.e('E1'), pg_temp.d('d1'), 6, 4));
  r := pg_temp.n(r, '23 retrait de 5 sur 5 accepté', 'ok', pg_temp.ret('retrait', 'c23c', tr, pg_temp.e('E1'), pg_temp.d('d1'), 5, 4));
  r := pg_temp.n(r, '23 un second retrait est refusé, la ligne est à zéro', 'plancher_zero', pg_temp.ret('retrait', 'c23d', tr, pg_temp.e('E1'), pg_temp.d('d1'), 1, 3));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '23 ligne à zéro absente de la liste', '=0', pg_temp.vrai(format('select count(*) from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date', pg_temp.e('E1'), pg_temp.d('d1'))));
  return r;
end $$;

create function pg_temp.c24(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text;
begin
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t24m');
  perform pg_temp.relh('c24a', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 5);
  perform pg_temp.relh('c24b', tm, pg_temp.e('E1'), pg_temp.d('d2'), 4, 5);
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t24r');
  perform pg_temp.ret('trouve_retire', 'c24c', tr, pg_temp.e('E1'), pg_temp.d('d1'), 2, 4);
  perform pg_temp.relh('c24d', tr, pg_temp.e('E1'), pg_temp.d('d1'), 3, 2);
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '24 un vrai relevé de RF1 désigne sa tournée', '=' || tr, pg_temp.ligne('tournee_id', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '24 la quantité est celle du relevé de la tournée de référence', '=3', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '24 la date non relevée par la tournée de référence disparaît (pas d''addition)', '=0', pg_temp.vrai(format('select count(*) from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date', pg_temp.e('E1'), pg_temp.d('d2'))));
  return r;
end $$;

create function pg_temp.c25(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tr text;
begin
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t25r');
  r := pg_temp.n(r, '25 trouvé-retiré sur un article jamais relevé accepté', 'ok', pg_temp.ret('trouve_retire', 'c25a', tr, pg_temp.e('E2'), pg_temp.d('d1'), 3, 2));
  r := pg_temp.n(r, '25 aucune quantité courante créée', '=0', pg_temp.vrai(format('select count(*) from dates_courtes_quantites_courantes(now()) where ean = %L', pg_temp.e('E2'))));
  r := pg_temp.n(r, '25 aucun relevé écrit', '=0', pg_temp.vrai(format('select count(*) from dates_courtes_releves where ean = %L', pg_temp.e('E2'))));
  r := pg_temp.n(r, '25 un retrait marqué trouvé est enregistré', '=1', pg_temp.vrai(format('select count(*) from dates_courtes_retraits where ean = %L and trouve', pg_temp.e('E2'))));
  r := pg_temp.n(r, '25 clé client avec « : » refusée', 'cle_idempotence_invalide', pg_temp.ret('retrait', 'a:b', tr, pg_temp.e('E2'), pg_temp.d('d1'), 1, 2));
  return r;
end $$;

create function pg_temp.c26(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text; sig text; sm text; sr text;
begin
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t26r');
  perform pg_temp.relh('c26a', tr, pg_temp.e('E1'), pg_temp.d('d1'), 7, 6);
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t26m');
  perform pg_temp.relh('c26b', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 5);
  perform pg_temp.comme('RF1');
  perform pg_temp.ret('trouve_retire', 'c26c', tr, pg_temp.e('E1'), pg_temp.d('d1'), 2, 4);
  sig := 'select quantite::text || ''|'' || tournee_id::text || ''|'' || echeance || ''|'' || age_jours::text from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date';
  perform pg_temp.comme('RF1'); sr := pg_temp.val(format(sig, pg_temp.e('E1'), pg_temp.d('d1')));
  perform pg_temp.comme('M1');  sm := pg_temp.val(format(sig, pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '26 renfort et manager obtiennent la même ligne', '=' || sm, sr);
  r := pg_temp.n(r, '26 la quantité est celle de la tournée de référence M1 moins le retrait', '=3|' || tm, split_part(sm, '|', 1) || '|' || split_part(sm, '|', 2));
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '26 le renfort ne reçoit pas le détail des autres tournées', '=1', pg_temp.val(format('select (autres_tournees is null)::int from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date', pg_temp.e('E1'), pg_temp.d('d1'))));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '26 la gestion reçoit le détail des autres tournées', '=1', pg_temp.val(format('select (autres_tournees is not null)::int from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date', pg_temp.e('E1'), pg_temp.d('d1'))));
  perform pg_temp.comme('P1');
  r := pg_temp.n(r, '26 pompiste refusé', 'droit_refuse', pg_temp.appel('dates_courtes_quantites_courantes(now())'));
  perform pg_temp.comme('V1');
  r := pg_temp.n(r, '26 vacataire refusé', 'droit_refuse', pg_temp.appel('dates_courtes_quantites_courantes(now())'));
  perform pg_temp.comme('RF2');
  r := pg_temp.n(r, '26 autre station : aucune ligne de R1', '=0', pg_temp.val(format('select count(*) from dates_courtes_quantites_courantes(now()) where ean = %L and date_limite = %L::date', pg_temp.e('E1'), pg_temp.d('d1'))));
  perform pg_temp.comme('RF1');
  r := pg_temp.n(r, '26 version de tournée : refusée à un renfort pour la tournée d''un autre', 'introuvable', pg_temp.appel(format('dates_courtes_version_tournee(%L)', tm)));
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '26 version de tournée : accordée à la gestion', 'ok', pg_temp.appel(format('dates_courtes_version_tournee(%L)', tr)));
  return r;
end $$;
-- B1 bis : un retrait se compare au dernier relevé de SA LIGNE (article, date), jamais au dernier relevé de l'article.
create function pg_temp.c27(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text;
begin
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t27m');
  perform pg_temp.relh('c27a', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 6);
  perform pg_temp.ret('retrait', 'c27b', tm, pg_temp.e('E1'), pg_temp.d('d1'), 2, 5);
  perform pg_temp.relh('c27c', tm, pg_temp.e('E1'), pg_temp.d('d2'), 4, 4);
  r := pg_temp.n(r, '27 le relevé d''une autre date n''efface pas le retrait de D1', '=3', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '27 la quantité de D2 est celle de son relevé', '=4', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d2')));
  return r;
end $$;

create function pg_temp.c28(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text;
begin
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t28m');
  perform pg_temp.relh('c28a', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 6);
  perform pg_temp.ret('retrait', 'c28b', tm, pg_temp.e('E1'), pg_temp.d('d1'), 2, 5);
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t28r');
  perform pg_temp.relh('c28c', tr, pg_temp.e('E1'), pg_temp.d('d1'), 3, 4);
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '28 un nouveau relevé de la ligne après le retrait ne déduit pas deux fois', '=3', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c29(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text;
begin
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t29m');
  perform pg_temp.relh('c29a', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 6);
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t29r');
  perform pg_temp.ret('trouve_retire', 'c29b', tr, pg_temp.e('E1'), pg_temp.d('d1'), 2, 4);
  perform pg_temp.comme('M1');
  r := pg_temp.n(r, '29 un retrait saisi dans une autre tournée après le relevé de référence est déduit', '=3', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c30(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tm text; tr text;
begin
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t30r');
  perform pg_temp.ret('trouve_retire', 'c30a', tr, pg_temp.e('E1'), pg_temp.d('d1'), 2, 6);
  perform pg_temp.comme('M1'); tm := pg_temp.tn('t30m');
  perform pg_temp.relh('c30b', tm, pg_temp.e('E1'), pg_temp.d('d1'), 5, 4);
  r := pg_temp.n(r, '30 un retrait antérieur au relevé de référence, saisi ailleurs, n''est pas déduit', '=5', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;
create function pg_temp.c31(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; tr text; o text;
begin
  perform pg_temp.comme('RF1'); tr := pg_temp.tn('t31r');
  perform pg_temp.relh('c31a', tr, pg_temp.e('E1'), pg_temp.d('d1'), 5, 6);
  perform pg_temp.comme('M1');
  o := pg_temp.relh('c31b', tr, pg_temp.e('E2'), pg_temp.d('d1'), 4, 4);
  r := pg_temp.n(r, '31 on ne saisit pas dans la tournée d''un autre', 'tournee_interdite', o);
  r := pg_temp.n(r, '31 aucune ligne créée pour l''article refusé', '=', coalesce(pg_temp.ligne('quantite', pg_temp.e('E2'), pg_temp.d('d1')), ''));
  r := pg_temp.n(r, '31 la quantité de l''auteur est inchangée', '=5', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  return r;
end $$;

create function pg_temp.c32(a text default null) returns jsonb language plpgsql as $$
declare r jsonb := '[]'; ta text; tb text;
begin
  perform pg_temp.comme('RF1'); ta := pg_temp.tn('t32a'); tb := pg_temp.tn('t32b');
  perform pg_temp.relh('c32a', ta, pg_temp.e('E1'), pg_temp.d('d1'), 5, 6);
  perform pg_temp.relh('c32b', tb, pg_temp.e('E1'), pg_temp.d('d1'), 3, 4);
  r := pg_temp.n(r, '32 deux tournées du même auteur ne s''additionnent pas : la dernière fait foi', '=3', pg_temp.ligne('quantite', pg_temp.e('E1'), pg_temp.d('d1')));
  r := pg_temp.n(r, '32 les deux tournées sont ouvertes en même temps', '=2', pg_temp.vrai(format('select count(*)::text from dates_courtes_tournees where id in (%L, %L) and etat = ''EN_COURS''', ta, tb)));
  r := pg_temp.n(r, '32 terminer la première', 'terminee', pg_temp.appel(format('dates_courtes_terminer_tournee(%L)', ta)));
  r := pg_temp.n(r, '32 la seconde reste en cours', 'EN_COURS', pg_temp.vrai(format('select etat from dates_courtes_tournees where id = %L', tb)));
  r := pg_temp.n(r, '32 terminer la seconde', 'terminee', pg_temp.appel(format('dates_courtes_terminer_tournee(%L)', tb)));
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
select pg_temp.jouer('c07');
select pg_temp.jouer('c08');
select pg_temp.jouer('c09');
select pg_temp.jouer('c10');
select pg_temp.jouer('c12', 'M1');
select pg_temp.jouer('c12', 'G1');
select pg_temp.jouer('c12', 'C1');
select pg_temp.jouer('c12', 'RF1');
select pg_temp.jouer('c12', 'CA1');
select pg_temp.jouer('c12', 'P1');
select pg_temp.jouer('c12', 'V1');
select pg_temp.jouer('c13');
select pg_temp.jouer('c14');
select pg_temp.jouer('c15');
select pg_temp.jouer('c16');
select pg_temp.jouer('c17');
select pg_temp.jouer('c18');
select pg_temp.jouer('c19');
select pg_temp.jouer('c20');
select pg_temp.jouer('c21');
select pg_temp.jouer('c22');
select pg_temp.jouer('c23');
select pg_temp.jouer('c24');
select pg_temp.jouer('c25');
select pg_temp.jouer('c26');
select pg_temp.jouer('c27');
select pg_temp.jouer('c28');
select pg_temp.jouer('c29');
select pg_temp.jouer('c30');
select pg_temp.jouer('c31');
select pg_temp.jouer('c32');

do $rapport$
declare j jsonb;
begin
  select jsonb_build_object(
    'total', count(*), 'ok', count(*) filter (where ok), 'ko', count(*) filter (where not ok),
    'lignes', jsonb_agg(jsonb_build_object('cas', cas, 'attendu', attendu, 'obtenu', obtenu, 'verdict', case when ok then 'OK' else 'KO' end) order by n),
    'non_joues', 'concurrence réelle (jouée en séquence), écrans (lots 2 à 4), preuve RLS réelle hors superutilisateur'
  ) into j from journal;
  raise exception 'RAPPORT_DC1 %', j::text;
end
$rapport$;

rollback;
