-- Recette SQL RLS-2 : 12 tables closes à la gestion en lecture ; écritures inventaire_lots par rôle ; controles_stock en insertion par la gestion.
-- Une transaction, rollback final ; le résultat sort dans l'exception RAPPORT_RLS_LOT2.
-- Cible : nexus-station-test UNIQUEMENT (garde ci-dessous) ou banc pglite jetable. Jamais Production.
begin;

do $garde_recette$
declare v_id text;
begin
  if coalesce(current_setting('recette.banc_local', true), '') <> 'pglite-jetable' then
    select system_identifier::text into v_id from pg_control_system();
    if v_id is distinct from '7678069749886157684' then
      raise exception 'GARDE_RECETTE : base inattendue (%), arrêt', v_id;
    end if;
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.inventaire_lots'::regclass and polname = 'insert_gestion_inventaire_lots') then
    raise exception 'GARDE_RECETTE : migration 20261125140000_rls_lot2 absente (insert_gestion_inventaire_lots manquante), arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'nexus-station-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'nexus-station-test');
insert into sites (site_id, nom_entreprise, timezone) select 'recette-autre-station', 'Station de recette', 'America/Martinique' where not exists (select 1 from sites where site_id = 'recette-autre-station');
-- Deux stations dédiées au cas « créateur » : l'accès créateur est posé À L'INSERTION (le déclencheur
-- nexus_acces_createur_immuable ne vise que l'UPDATE) ; la recette ne modifie jamais sites.acces_createur_autorise.
insert into sites (site_id, nom_entreprise, timezone, acces_createur_autorise) values
  ('recette-createur-non', 'Station de recette créateur sans accès', 'America/Martinique', false),
  ('recette-createur-oui', 'Station de recette créateur avec accès', 'America/Martinique', true);

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('E1',  '00000000-0000-4000-8000-0000000f0101', 'caissier', 'nexus-station-test', false),
  ('E2',  '00000000-0000-4000-8000-0000000f0102', 'pompiste', 'nexus-station-test', false),
  ('M1',  '00000000-0000-4000-8000-0000000f0103', 'manager',  'nexus-station-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000f0104', 'gerant',   'nexus-station-test', false),
  ('X1',  '00000000-0000-4000-8000-0000000f0106', 'caissier', 'recette-autre-station', false),
  ('CRN', '00000000-0000-4000-8000-0000000f0107', 'caissier', 'recette-createur-non', true),
  ('EN1', '00000000-0000-4000-8000-0000000f0108', 'caissier', 'recette-createur-non', false),
  ('EN2', '00000000-0000-4000-8000-0000000f0109', 'pompiste', 'recette-createur-non', false),
  ('CRO', '00000000-0000-4000-8000-0000000f010a', 'caissier', 'recette-createur-oui', true),
  ('EO1', '00000000-0000-4000-8000-0000000f010b', 'caissier', 'recette-createur-oui', false),
  ('EO2', '00000000-0000-4000-8000-0000000f010c', 'pompiste', 'recette-createur-oui', false);

insert into auth.users (id, aud, role, email) select v, 'authenticated', 'authenticated', 'recette-rls2-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
  select v, 'recette-rls2-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

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

-- Une ligne par table et par station (superuser, avant tout changement de rôle).
create function pg_temp.semer(t text, s text) returns void language plpgsql as $$
declare emp uuid := (select v from ids where site = s order by k limit 1);
begin
  reset role;
  if t = 'campagnes_nexus' then
    insert into campagnes_nexus (site, nom, date_debut, date_fin, type, nature, objectif) values (s, 'R', '2026-01-01', '2026-01-02', 'boutique', 'pack', 'autre');
  elsif t = 'campagnes_nexus_imports' then
    insert into campagnes_nexus_imports (site, campagne_id, phase, periode_debut, periode_fin) select s, id, 'avant', '2026-01-01', '2026-01-02' from campagnes_nexus where site = s and nom = 'R' limit 1;
  elsif t = 'carburant_sonde_alertes' then
    insert into carburant_sonde_alertes (site, carburant, sens, nb_receptions, fenetre, expire_le) values (s, 'go', 'plus', 1, 1, now() + interval '1 day');
  elsif t = 'moteur_documentaire_etat' then
    insert into moteur_documentaire_etat (site) values (s);
  elsif t = 'employee_contraintes' then
    insert into employee_contraintes (employee_id, site_id) values (emp, s);
  elsif t = 'employee_indisponibilites' then
    insert into employee_indisponibilites (employee_id, site_id, date_debut, date_fin, type) values (emp, s, '2026-01-01', '2026-01-02', 'conge');
  elsif t = 'controles_stock' then
    insert into controles_stock (site, article, quantite_theorique, quantite_comptee, ecart) values (s, 'R', 1, 1, 0);
  elsif t = 'panier_moyen_quotidien' then
    insert into panier_moyen_quotidien (site, date, nb_tickets) values (s, current_date, 1);
  elsif t = 'stock_releves' then
    insert into stock_releves (site, releve_le, article, quantite_theorique) values (s, now(), 'R', 1);
  elsif t = 'marge_exceptions' then
    insert into marge_exceptions (site, article) values (s, 'R');
  elsif t = 'product_locations' then
    insert into product_locations (site, categorie, article, emplacement) values (s, 'R', 'R', 'R');
  elsif t = 'product_photos' then
    insert into product_photos (site, categorie, article, photo_url) values (s, 'R', 'R', 'R');
  else raise exception 'table inconnue %', t;
  end if;
end $$;

do $rapport$
declare
  r jsonb := '[]';
  st constant text := 'nexus-station-test';
  os constant text := 'recette-autre-station';
  cn constant text := 'recette-createur-non';
  co constant text := 'recette-createur-oui';
  tbl text;
  col text;
  n int := 0;
  tables constant text[] := array['campagnes_nexus','campagnes_nexus_imports','carburant_sonde_alertes','moteur_documentaire_etat',
    'employee_contraintes','employee_indisponibilites','controles_stock','panier_moyen_quotidien','stock_releves','marge_exceptions',
    'product_locations','product_photos'];
  s text;
begin
  -- Semis : une ligne par station et par table (campagnes avant imports).
  foreach tbl in array tables loop
    foreach s in array array[st, os, cn, co] loop
      perform pg_temp.semer(tbl, s);
    end loop;
  end loop;

  -- 1 Réglage : aucune politique SELECT ne reste ouverte à tout employé du site
  foreach tbl in array tables loop
    n := n + 1;
    r := pg_temp.n(r, '1.' || n || ' ' || tbl || ' : policy select_gestion présente', '=true',
      pg_temp.val(format($f$select exists (select 1 from pg_policy where polrelid = 'public.%s'::regclass and polname = 'select_gestion_%s' and polcmd = 'r')::text$f$, tbl, tbl)));
    r := pg_temp.n(r, '1.' || n || 'b ' || tbl || ' : toute politique SELECT/ALL mentionne le rôle', '=0',
      pg_temp.val(format($f$select count(*)::text from pg_policy where polrelid = 'public.%s'::regclass and polcmd in ('r','*') and pg_get_expr(polqual, polrelid) not like '%%current_employee_role%%'$f$, tbl)));
  end loop;

  -- 2 Lecture : la gestion voit sa station, l'employé et l'autre station rien
  n := 0;
  foreach tbl in array tables loop
    n := n + 1;
    col := case when tbl in ('employee_contraintes','employee_indisponibilites') then 'site_id' else 'site' end;
    r := pg_temp.n(r, '2.' || n || '.1 ' || tbl || ' : manager lit sa station', '=1',
      pg_temp.essai('M1', format($f$select count(*)::text from public.%s where %s = %L$f$, tbl, col, st)));
    r := pg_temp.n(r, '2.' || n || '.2 ' || tbl || ' : gérant lit sa station', '=1',
      pg_temp.essai('G1', format($f$select count(*)::text from public.%s where %s = %L$f$, tbl, col, st)));
    r := pg_temp.n(r, '2.' || n || '.3 ' || tbl || ' : caissier ne lit rien', '=0',
      pg_temp.essai('E1', format($f$select count(*)::text from public.%s$f$, tbl)));
    r := pg_temp.n(r, '2.' || n || '.4 ' || tbl || ' : pompiste ne lit rien', '=0',
      pg_temp.essai('E2', format($f$select count(*)::text from public.%s$f$, tbl)));
    r := pg_temp.n(r, '2.' || n || '.5 ' || tbl || ' : employé d''une autre station ne lit rien', '=0',
      pg_temp.essai('X1', format($f$select count(*)::text from public.%s$f$, tbl)));
    r := pg_temp.n(r, '2.' || n || '.6 ' || tbl || ' : manager ne lit pas l''autre station', '=0',
      pg_temp.essai('M1', format($f$select count(*)::text from public.%s where %s = %L$f$, tbl, col, os)));
    r := pg_temp.n(r, '2.' || n || '.7 ' || tbl || ' : créateur lit la station à accès autorisé', '=1',
      pg_temp.essai('CRO', format($f$select count(*)::text from public.%s where %s = %L$f$, tbl, col, co)));
    r := pg_temp.n(r, '2.' || n || '.8 ' || tbl || ' : créateur ne lit pas la station sans accès', '=0',
      pg_temp.essai('CRN', format($f$select count(*)::text from public.%s where %s = %L$f$, tbl, col, cn)));
    r := pg_temp.n(r, '2.' || n || '.9 ' || tbl || ' : employé ordinaire d''une station autorisée ne lit rien', '=0',
      pg_temp.essai('EO1', format($f$select count(*)::text from public.%s$f$, tbl)));
  end loop;

  -- 3 controles_stock : insertion réservée à la gestion, sur sa station
  r := pg_temp.n(r, '3.1 controles_stock : caissier ne peut pas insérer', 'row-level security',
    pg_temp.essai('E1', format($f$insert into public.controles_stock (site, article, quantite_theorique, quantite_comptee, ecart) values (%L, 'X', 1, 1, 0) returning 'ok'$f$, st)));
  r := pg_temp.n(r, '3.2 controles_stock : manager insère sur sa station', '=ok',
    pg_temp.essai('M1', format($f$insert into public.controles_stock (site, article, quantite_theorique, quantite_comptee, ecart) values (%L, 'X', 1, 1, 0) returning 'ok'$f$, st)));
  r := pg_temp.n(r, '3.3 controles_stock : manager ne peut pas insérer dans l''autre station', 'row-level security',
    pg_temp.essai('M1', format($f$insert into public.controles_stock (site, article, quantite_theorique, quantite_comptee, ecart) values (%L, 'X', 1, 1, 0) returning 'ok'$f$, os)));

  -- 4 inventaire_lots : plus de politique ALL ; écritures de la gestion seulement.
  -- Le manager passe la RLS puis bute sur la clé étrangère (produit inexistant) : l'erreur « foreign key » prouve que la RLS a laissé passer.
  r := pg_temp.n(r, '4.1 inventaire_lots : aucune politique ALL', '=0',
    pg_temp.val($q$select count(*)::text from pg_policy where polrelid = 'public.inventaire_lots'::regclass and polcmd = '*'$q$));
  r := pg_temp.n(r, '4.2 inventaire_lots : insert, update et delete de la gestion présentes', '=3',
    pg_temp.val($q$select count(*)::text from pg_policy where polrelid = 'public.inventaire_lots'::regclass and polname in ('insert_gestion_inventaire_lots','update_gestion_inventaire_lots','delete_gestion_inventaire_lots')$q$));
  r := pg_temp.n(r, '4.3 inventaire_lots : caissier ne peut pas insérer', 'row-level security',
    pg_temp.essai('E1', format($f$insert into public.inventaire_lots (site, produit_id, quantite_recue) values (%L, gen_random_uuid(), 1) returning 'ok'$f$, st)));
  r := pg_temp.n(r, '4.4 inventaire_lots : pompiste ne peut pas insérer', 'row-level security',
    pg_temp.essai('E2', format($f$insert into public.inventaire_lots (site, produit_id, quantite_recue) values (%L, gen_random_uuid(), 1) returning 'ok'$f$, st)));
  r := pg_temp.n(r, '4.5 inventaire_lots : manager passe la RLS (bute sur la clé étrangère)', 'foreign key',
    pg_temp.essai('M1', format($f$insert into public.inventaire_lots (site, produit_id, quantite_recue) values (%L, gen_random_uuid(), 1) returning 'ok'$f$, st)));
  r := pg_temp.n(r, '4.6 inventaire_lots : gérant passe la RLS (bute sur la clé étrangère)', 'foreign key',
    pg_temp.essai('G1', format($f$insert into public.inventaire_lots (site, produit_id, quantite_recue) values (%L, gen_random_uuid(), 1) returning 'ok'$f$, st)));
  r := pg_temp.n(r, '4.7 inventaire_lots : manager ne peut pas insérer dans l''autre station', 'row-level security',
    pg_temp.essai('M1', format($f$insert into public.inventaire_lots (site, produit_id, quantite_recue) values (%L, gen_random_uuid(), 1) returning 'ok'$f$, os)));
  r := pg_temp.n(r, '4.8 inventaire_lots : la lecture (select_inventaire_lots) est inchangée', '=1',
    pg_temp.val($q$select count(*)::text from pg_policy where polrelid = 'public.inventaire_lots'::regclass and polname = 'select_inventaire_lots' and polcmd = 'r'$q$));

  -- 5 Politique de recette : absente hors Test (la recette tourne sur Test, où elle reste)
  r := pg_temp.n(r, '5.1 recette_ci_site_test : conservée sur Test, supprimée ailleurs', '=true',
    pg_temp.val($q$select (case when (select system_identifier from pg_control_system()) = 7678069749886157684
      then exists (select 1 from pg_policy where polname = 'recette_ci_site_test')
      else not exists (select 1 from pg_policy where polname = 'recette_ci_site_test') end)::text$q$));

  raise exception 'RAPPORT_RLS_LOT2 %', jsonb_build_object('total', jsonb_array_length(r),
    'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
