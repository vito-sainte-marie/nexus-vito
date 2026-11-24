-- Recette SQL RLS-3 : 4 vues (v_caisse_ecart_a_traiter, nexus_stock_etat_v2, nexus_stock_etat_v3, view_inventaire_dernier_controle_produit) en security_invoker.
-- Une transaction, rollback final ; le résultat sort dans l'exception RAPPORT_RLS_LOT3.
-- Cible : nexus-station-test UNIQUEMENT (garde ci-dessous) ou banc pglite jetable. Jamais Production. Données fictives seulement.
-- « Avant » est mesuré dans la même transaction en remettant temporairement security_invoker à false (annulé par le rollback).
begin;

do $garde_recette$
declare v_id text; v text;
begin
  if coalesce(current_setting('recette.banc_local', true), '') <> 'pglite-jetable' then
    select system_identifier::text into v_id from pg_control_system();
    if v_id is distinct from '7678069749886157684' then
      raise exception 'GARDE_RECETTE : base inattendue (%), arrêt', v_id;
    end if;
  end if;
  foreach v in array array['v_caisse_ecart_a_traiter','nexus_stock_etat_v2','nexus_stock_etat_v3','view_inventaire_dernier_controle_produit'] loop
    if not coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = to_regclass('public.' || v)), false) then
      raise exception 'GARDE_RECETTE : migration 20261125180000_rls_lot3 absente (% pas en security_invoker), arrêt', v;
    end if;
  end loop;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'nexus-station-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'nexus-station-test');
insert into sites (site_id, nom_entreprise, timezone) select 'recette-autre-station', 'Station de recette', 'America/Martinique' where not exists (select 1 from sites where site_id = 'recette-autre-station');
-- Accès créateur posé À L'INSERTION (le déclencheur nexus_acces_createur_immuable ne vise que l'UPDATE) ; jamais d'UPDATE de sites.acces_createur_autorise.
insert into sites (site_id, nom_entreprise, timezone, acces_createur_autorise) values
  ('recette-createur-non', 'Station de recette créateur sans accès', 'America/Martinique', false),
  ('recette-createur-oui', 'Station de recette créateur avec accès', 'America/Martinique', true);

-- Six identités et plus : employé A (E1), manager A (M1), gérant A (G1), employé B (X1), manager B (XM), créateurs (CRN, CRO).
create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('E1',  '00000000-0000-4000-8000-0000000f0301', 'caissier', 'nexus-station-test', false),
  ('M1',  '00000000-0000-4000-8000-0000000f0302', 'manager',  'nexus-station-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000f0303', 'gerant',   'nexus-station-test', false),
  ('X1',  '00000000-0000-4000-8000-0000000f0304', 'caissier', 'recette-autre-station', false),
  ('XM',  '00000000-0000-4000-8000-0000000f0305', 'manager',  'recette-autre-station', false),
  ('CRN', '00000000-0000-4000-8000-0000000f0306', 'caissier', 'recette-createur-non', true),
  ('EN1', '00000000-0000-4000-8000-0000000f0307', 'caissier', 'recette-createur-non', false),
  ('CRO', '00000000-0000-4000-8000-0000000f0308', 'caissier', 'recette-createur-oui', true),
  ('EO1', '00000000-0000-4000-8000-0000000f0309', 'caissier', 'recette-createur-oui', false);

insert into auth.users (id, aud, role, email) select v, 'authenticated', 'authenticated', 'recette-rls3-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
  select v, 'recette-rls3-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

-- Écarts de caisse à traiter : un par station, imputé à l'employé de la station (côté piste dominant).
insert into audits_caisse (site, date, quart, statut, ecart_piste, ecart_boutique, employes_piste, employee_id)
  select i.site, current_date, '1', 'anomalie', -20, 0, jsonb_build_array(i.v::text), i.v
  from ids i where i.k in ('E1', 'X1', 'EN1', 'EO1');

-- Chaîne inventaire fictive : catégorie -> zone -> produit -> quart -> comptage d'ouverture, par station.
create temp table inv (site text primary key, cat uuid, zone uuid, prod uuid, quart uuid) on commit drop;
grant all on inv to public;
insert into inv select s, gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), gen_random_uuid()
  from (values ('nexus-station-test'), ('recette-autre-station'), ('recette-createur-non'), ('recette-createur-oui')) x(s);
insert into inventaire_categories (id, site, nom) select cat, site, 'Catégorie recette' from inv;
insert into inventaire_zones (id, site, code, nom) select zone, site, 'ZR', 'Zone recette' from inv;
insert into inventaire_zone_produit (id, site, designation, categorie_id, zone_id) select prod, site, 'Produit recette', cat, zone from inv;
insert into inventaire_quarts (id, site, date, quart) select quart, site, current_date + 300, '1' from inv;
insert into inventaire_comptages (site, quart_id, produit_id, type_comptage, quantite) select site, quart, prod, 'ouverture', 5 from inv;

create function pg_temp.comme(k text) returns void language plpgsql as $$
declare u uuid;
begin
  reset role;
  select v into u from ids where ids.k = comme.k;
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', u::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  set local role authenticated;
end $$;

create function pg_temp.exec(q text) returns void language plpgsql as $$
begin
  reset role; execute q;
  if current_user <> session_user then null; end if;
end $$;

create function pg_temp.val(q text) returns text language plpgsql as $$
declare r text;
begin reset role; execute q into r; return r; end $$;

create function pg_temp.essai(k text, q text) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.comme(k);
  execute q into r;
  reset role;
  return coalesce(r, '');
exception when others then
  reset role;
  return 'ERR ' || sqlerrm;
end $$;

-- n(acc, cas, attendu, obtenu) : '=x' exact, '!x' absence, sinon sous-chaîne ; alternatives séparées par '~'.
create function pg_temp.n(acc jsonb, cas text, attendu text, obtenu text) returns jsonb language plpgsql as $$
declare ok boolean := false; a text;
begin
  if left(attendu, 1) = '=' then ok := obtenu = substr(attendu, 2);
  elsif left(attendu, 1) = '!' then ok := position(substr(attendu, 2) in coalesce(obtenu, '')) = 0;
  else
    foreach a in array string_to_array(attendu, '~') loop
      if position(a in coalesce(obtenu, '')) > 0 then ok := true; end if;
    end loop;
  end if;
  return acc || jsonb_build_array(jsonb_build_object('cas', cas, 'attendu', attendu, 'obtenu', obtenu, 'ok', ok));
end $$;

do $rapport$
declare
  r jsonb := '[]';
  st constant text := 'nexus-station-test';
  os constant text := 'recette-autre-station';
  nom_vue text;
  vues constant text[] := array['v_caisse_ecart_a_traiter','nexus_stock_etat_v2','nexus_stock_etat_v3','view_inventaire_dernier_controle_produit'];
  stock constant text[] := array['nexus_stock_etat_v2','nexus_stock_etat_v3'];
  k text;
  n int := 0;
  avant text;
  autre text;
begin
  -- 1 Réglage
  foreach nom_vue in array vues loop
    n := n + 1;
    r := pg_temp.n(r, '1.' || n || ' ' || nom_vue || ' en security_invoker', '=true',
      pg_temp.val(format($f$select coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = to_regclass('public.%s')), false)::text$f$, nom_vue)));
  end loop;

  -- 2 Avant (informatif) : sans security_invoker l'employé A lit l'écart de caisse de sa station et de l'autre.
  perform pg_temp.exec('alter view public.v_caisse_ecart_a_traiter set (security_invoker = false)');
  avant := pg_temp.essai('E1', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site in ('nexus-station-test','recette-autre-station')$q$);
  perform pg_temp.exec('alter view public.v_caisse_ecart_a_traiter set (security_invoker = true)');
  r := r || jsonb_build_array(jsonb_build_object('cas', '2.1 AVANT (informatif) : employé A lisait N écarts des stations de recette', 'attendu', 'info', 'obtenu', avant, 'ok', true));

  -- 3 Écarts de caisse : l'employé ne lit plus rien
  r := pg_temp.n(r, '3.1 employé A : 0 écart (sa station)', '=0', pg_temp.essai('E1', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site = 'nexus-station-test'$q$));
  r := pg_temp.n(r, '3.2 employé A : 0 écart (autre station)', '=0', pg_temp.essai('E1', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site = 'recette-autre-station'$q$));
  r := pg_temp.n(r, '3.3 employé A : 0 écart au total', '=0', pg_temp.essai('E1', 'select count(*)::text from public.v_caisse_ecart_a_traiter'));
  r := pg_temp.n(r, '3.4 employé B : 0 écart au total', '=0', pg_temp.essai('X1', 'select count(*)::text from public.v_caisse_ecart_a_traiter'));

  -- 4 Lecteurs légitimes : manager A et gérant A gardent leur station, noms d'employés compris
  foreach k in array array['M1', 'G1'] loop
    r := pg_temp.n(r, '4.' || k || '.1 ' || k || ' lit l''écart de sa station', '=1', pg_temp.essai(k, $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site = 'nexus-station-test' and employee_id = '00000000-0000-4000-8000-0000000f0301'$q$));
    r := pg_temp.n(r, '4.' || k || '.2 ' || k || ' lit le nom de l''employé imputé', '=Recette E1', pg_temp.essai(k, $q$select employee_nom from public.v_caisse_ecart_a_traiter where site = 'nexus-station-test' and employee_id = '00000000-0000-4000-8000-0000000f0301'$q$));
    r := pg_temp.n(r, '4.' || k || '.3 ' || k || ' ne lit rien de l''autre station', '=0', pg_temp.essai(k, $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site = 'recette-autre-station'$q$));
  end loop;
  r := pg_temp.n(r, '4.X.1 manager B lit l''écart de sa station', '=1', pg_temp.essai('XM', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site = 'recette-autre-station'$q$));
  r := pg_temp.n(r, '4.X.2 manager B lit le nom de son employé', '=Recette X1', pg_temp.essai('XM', $q$select employee_nom from public.v_caisse_ecart_a_traiter where site = 'recette-autre-station'$q$));
  r := pg_temp.n(r, '4.X.3 manager B : 0 écart de la station A', '=0', pg_temp.essai('XM', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site = 'nexus-station-test'$q$));
  r := pg_temp.n(r, '4.X.4 manager B : aucun écart hors de sa station', '=0', pg_temp.essai('XM', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site <> 'recette-autre-station'$q$));
  r := pg_temp.n(r, '4.X.5 manager A : aucun écart hors de sa station', '=0', pg_temp.essai('M1', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site <> 'nexus-station-test'$q$));

  -- 5 Stock v2 / v3 : isolation entre stations, légitimes inchangés (v2 = nexus_stock_etat, déjà invoker)
  foreach nom_vue in array stock loop
    foreach k in array array['E1', 'M1', 'G1', 'X1', 'XM'] loop
      r := pg_temp.n(r, '5.' || nom_vue || '.' || k || ' aucune ligne hors de sa station', '=0',
        pg_temp.essai(k, format('select count(*)::text from public.%s where site <> (select site_id from public.employees where id = auth.uid())', nom_vue)));
    end loop;
  end loop;
  foreach k in array array['M1', 'G1', 'XM'] loop
    r := pg_temp.n(r, '5.v2.' || k || ' lit autant que nexus_stock_etat (déjà invoker)',
      '=' || pg_temp.essai(k, 'select count(*)::text from public.nexus_stock_etat'),
      pg_temp.essai(k, 'select count(*)::text from public.nexus_stock_etat_v2'));
  end loop;
  r := pg_temp.n(r, '5.v3 la vue reste lisible pour le manager (pas d''erreur)', '!ERR', pg_temp.essai('M1', 'select count(*)::text from public.nexus_stock_etat_v3'));
  r := pg_temp.n(r, '5.v3 la vue reste lisible pour l''employé (pas d''erreur)', '!ERR', pg_temp.essai('E1', 'select count(*)::text from public.nexus_stock_etat_v3'));

  -- 6 Dernier contrôle par produit : tout employé du site, rien d'ailleurs
  foreach k in array array['E1', 'M1', 'G1'] loop
    r := pg_temp.n(r, '6.' || k || '.1 ' || k || ' lit le contrôle de sa station', '=1', pg_temp.essai(k, $q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site = 'nexus-station-test' and produit_id = (select prod from inv where site = 'nexus-station-test')$q$));
    r := pg_temp.n(r, '6.' || k || '.2 ' || k || ' ne lit pas l''autre station', '=0', pg_temp.essai(k, $q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site = 'recette-autre-station'$q$));
  end loop;
  r := pg_temp.n(r, '6.X.1 employé B lit le contrôle de sa station', '=1', pg_temp.essai('X1', $q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site = 'recette-autre-station' and produit_id = (select prod from inv where site = 'recette-autre-station')$q$));
  r := pg_temp.n(r, '6.X.2 employé B : 0 ligne de la station A', '=0', pg_temp.essai('X1', $q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site = 'nexus-station-test'$q$));
  r := pg_temp.n(r, '6.X.3 manager B : 0 ligne de la station A', '=0', pg_temp.essai('XM', $q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site = 'nexus-station-test'$q$));

  -- 7 Créateur : attendus calculés (acces_createur_autorise), jamais en dur
  r := pg_temp.n(r, '7.1 créateur : écarts de caisse = ceux des stations à accès autorisé',
    '=' || pg_temp.val($q$select count(*)::text from public.v_caisse_ecart_a_traiter where site in (select site_id from sites where acces_createur_autorise)$q$),
    pg_temp.essai('CRO', 'select count(*)::text from public.v_caisse_ecart_a_traiter'));
  r := pg_temp.n(r, '7.2 créateur : 0 écart d''une station sans accès créateur', '=0',
    pg_temp.essai('CRN', $q$select count(*)::text from public.v_caisse_ecart_a_traiter where site in (select site_id from sites where not acces_createur_autorise)$q$));
  r := pg_temp.n(r, '7.3 créateur : contrôles d''inventaire = ceux de sa propre station',
    '=' || pg_temp.val($q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site = 'recette-createur-oui'$q$),
    pg_temp.essai('CRO', 'select count(*)::text from public.view_inventaire_dernier_controle_produit'));
  r := pg_temp.n(r, '7.4 créateur : 0 contrôle d''une autre station', '=0',
    pg_temp.essai('CRN', $q$select count(*)::text from public.view_inventaire_dernier_controle_produit where site <> 'recette-createur-non'$q$));

  raise exception 'RAPPORT_RLS_LOT3 %', jsonb_build_object('total', jsonb_array_length(r),
    'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
