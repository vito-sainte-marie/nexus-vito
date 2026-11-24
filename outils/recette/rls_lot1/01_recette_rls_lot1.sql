-- Recette SQL RLS-1 : vues view_fdj_* en security_invoker ; evaluations_employes et controles_tenue limitées à l'employé.
-- Une transaction, rollback final ; le résultat sort dans l'exception RAPPORT_RLS_LOT1.
-- Cible : nexus-station-test UNIQUEMENT (garde ci-dessous) ou banc pglite jetable. Jamais Production.
-- « Avant » est mesuré dans la même transaction en remettant temporairement security_invoker à false (annulé par le rollback).
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
  if not coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = to_regclass('public.view_fdj_shift_facts')), false) then
    raise exception 'GARDE_RECETTE : migration 20261125100000_rls_lot1 absente (view_fdj_shift_facts pas en security_invoker), arrêt';
  end if;
end
$garde_recette$;

insert into sites (site_id, timezone) select 'nexus-station-test', 'America/Martinique' where not exists (select 1 from sites where site_id = 'nexus-station-test');
insert into sites (site_id, nom_entreprise, timezone) select 'recette-autre-station', 'Station de recette', 'America/Martinique' where not exists (select 1 from sites where site_id = 'recette-autre-station');
update sites set acces_createur_autorise = false where site_id in ('nexus-station-test', 'recette-autre-station');

create temp table ids (k text primary key, v uuid, role text, site text, createur boolean) on commit drop;
grant all on ids to public;
insert into ids values
  ('E1',  '00000000-0000-4000-8000-0000000f0101', 'caissier', 'nexus-station-test', false),
  ('E2',  '00000000-0000-4000-8000-0000000f0102', 'pompiste', 'nexus-station-test', false),
  ('M1',  '00000000-0000-4000-8000-0000000f0103', 'manager',  'nexus-station-test', false),
  ('G1',  '00000000-0000-4000-8000-0000000f0104', 'gerant',   'nexus-station-test', false),
  ('CR1', '00000000-0000-4000-8000-0000000f0105', 'caissier', 'nexus-station-test', true),
  ('X1',  '00000000-0000-4000-8000-0000000f0106', 'caissier', 'recette-autre-station', false);

insert into auth.users (id, aud, role, email) select v, 'authenticated', 'authenticated', 'recette-rls1-' || lower(k) || '@invalid.test' from ids;
insert into employees (id, username, nom, role, actif, est_createur, site_id, compte_test)
  select v, 'recette-rls1-' || lower(k), 'Recette ' || k, role, true, createur, site, true from ids;

-- Une feuille FDJ par station, avec un jeu et un comptage, pour que les vues aient des lignes.
create temp table fdj (site text primary key, shift uuid, game uuid) on commit drop;
grant all on fdj to public;
insert into fdj select s, gen_random_uuid(), gen_random_uuid() from (values ('nexus-station-test'), ('recette-autre-station')) x(s);
insert into fdj_games (id, site, nom, prix) select game, site, 'Jeu recette', 2 from fdj;
insert into fdj_shifts (id, site, date, quart, employee_id, statut)
  select f.shift, f.site, current_date, '1', (select v from ids where k = case f.site when 'nexus-station-test' then 'E1' else 'X1' end), 'valide' from fdj f;
insert into fdj_shift_counts (site, shift_id, game_id, stock_initial, appro, stock_final, ventes_qte, ventes_valeur)
  select site, shift, game, 10, 0, 6, 4, 8 from fdj;

-- Évaluations et tenue : une ligne pour E1, une pour E2 (même station), une pour X1 (autre station).
insert into evaluations_employes (site, employee_id, evaluateur_id, type, criteres, total)
  select i.site, i.v, (select v from ids where k = 'M1'), 'standard', '{}'::jsonb, 10 from ids i where i.k in ('E1', 'E2', 'X1');
insert into controles_tenue (site, employee_id, controleur_id, conforme, items)
  select i.site, i.v, (select v from ids where k = 'M1'), true, '{}'::jsonb from ids i where i.k in ('E1', 'E2', 'X1');

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
  vues constant text[] := array['view_fdj_daily_summary','view_fdj_discrepancy_daily','view_fdj_employee_daily','view_fdj_employee_price_tier_daily',
    'view_fdj_game_daily','view_fdj_game_daily_mouvements','view_fdj_game_daily_ventes','view_fdj_monthly_summary','view_fdj_price_tier_daily',
    'view_fdj_shift_facts','view_fdj_weekly_summary','view_fdj_yearly_summary'];
  avant text;
  apres text;
  n int := 0;
begin
  -- 1 Réglage : les 12 vues sont en security_invoker
  foreach nom_vue in array vues loop
    n := n + 1;
    r := pg_temp.n(r, '1.' || n || ' ' || nom_vue || ' en security_invoker', '=true',
      pg_temp.val(format($f$select coalesce((select c.reloptions @> array['security_invoker=true'] from pg_class c where c.oid = to_regclass('public.%s')), false)::text$f$, nom_vue)));
  end loop;

  -- 2 Avant / après : lignes d'une autre station vues par l'employé E1
  -- Avant : mesuré en remettant temporairement l'option à false (annulé par le rollback final).
  perform pg_temp.exec('alter view public.view_fdj_shift_facts set (security_invoker = false)');
  avant := pg_temp.essai('E1', format($f$select (count(*) > 0)::text from public.view_fdj_shift_facts where site = %L$f$, os));
  r := pg_temp.n(r, '2.1 AVANT : l''employé voyait l''autre station (shift_facts)', '=true', avant);
  perform pg_temp.exec('alter view public.view_fdj_shift_facts set (security_invoker = true)');
  n := 0;
  foreach nom_vue in array vues loop
    n := n + 1;
    perform pg_temp.exec(format('alter view public.%s set (security_invoker = false)', nom_vue));
    avant := pg_temp.essai('E1', format($f$select count(*)::text from public.%s where site = %L$f$, nom_vue, os));
    perform pg_temp.exec(format('alter view public.%s set (security_invoker = true)', nom_vue));
    apres := pg_temp.essai('E1', format($f$select count(*)::text from public.%s where site = %L$f$, nom_vue, os));
    -- l'avant est informatif (une vue sans ligne de recette peut afficher 0) ; l'après est une exigence
    r := r || jsonb_build_array(jsonb_build_object('cas', '2.' || (n + 1) || ' avant (info) ' || nom_vue, 'attendu', 'info', 'obtenu', avant, 'ok', true));
    r := pg_temp.n(r, '2.' || (n + 1) || ' APRÈS ' || nom_vue || ' : 0 ligne d''une autre station (employé)', '=0', apres);
    r := pg_temp.n(r, '2.' || (n + 1) || ' APRÈS ' || nom_vue || ' : 0 ligne d''une autre station (manager)', '=0',
      pg_temp.essai('M1', format($f$select count(*)::text from public.%s where site = %L$f$, nom_vue, os)));
    r := pg_temp.n(r, '2.' || (n + 1) || ' APRÈS ' || nom_vue || ' : 0 ligne de la station vue par l''employé d''une autre station', '=0',
      pg_temp.essai('X1', format($f$select count(*)::text from public.%s where site = %L$f$, nom_vue, st)));
  end loop;

  -- 3 Coach FDJ : les vues lues par l'employé restent lisibles sur sa station
  r := pg_temp.n(r, '3.1 Coach FDJ : view_fdj_daily_summary lisible (station)', '=true',
    pg_temp.essai('E1', format($f$select (count(*) > 0)::text from public.view_fdj_daily_summary where site = %L$f$, st)));
  r := pg_temp.n(r, '3.2 Coach FDJ : view_fdj_employee_daily lisible (station)', '=true',
    pg_temp.essai('E1', format($f$select (count(*) > 0)::text from public.view_fdj_employee_daily where site = %L$f$, st)));
  r := pg_temp.n(r, '3.3 Coach FDJ : view_fdj_employee_price_tier_daily lisible (station)', '=true',
    pg_temp.essai('E1', format($f$select (count(*) > 0)::text from public.view_fdj_employee_price_tier_daily where site = %L$f$, st)));
  r := pg_temp.n(r, '3.4 manager : view_fdj_shift_facts lisible (station)', '=true',
    pg_temp.essai('M1', format($f$select (count(*) > 0)::text from public.view_fdj_shift_facts where site = %L$f$, st)));
  r := pg_temp.n(r, '3.5 gérant : view_fdj_shift_facts lisible (station)', '=true',
    pg_temp.essai('G1', format($f$select (count(*) > 0)::text from public.view_fdj_shift_facts where site = %L$f$, st)));

  -- 4 Évaluations : l'employé ne voit que les siennes ; la gestion voit toute la station
  r := pg_temp.n(r, '4.1 évaluations : E1 ne voit que les siennes', '=1', pg_temp.essai('E1', 'select count(*)::text from public.evaluations_employes'));
  r := pg_temp.n(r, '4.2 évaluations : E1 ne voit pas celle de E2', '=0',
    pg_temp.essai('E1', format($f$select count(*)::text from public.evaluations_employes where employee_id = %L$f$, (select ids.v from ids where ids.k = 'E2'))));
  r := pg_temp.n(r, '4.3 évaluations : manager voit toute la station', '=2',
    pg_temp.essai('M1', format($f$select count(*)::text from public.evaluations_employes where site = %L$f$, st)));
  r := pg_temp.n(r, '4.4 évaluations : gérant voit toute la station', '=2',
    pg_temp.essai('G1', format($f$select count(*)::text from public.evaluations_employes where site = %L$f$, st)));
  r := pg_temp.n(r, '4.5 évaluations : manager ne voit pas l''autre station', '=0',
    pg_temp.essai('M1', format($f$select count(*)::text from public.evaluations_employes where site = %L$f$, os)));
  r := pg_temp.n(r, '4.6 évaluations : employé d''une autre station ne voit que les siennes', '=1', pg_temp.essai('X1', 'select count(*)::text from public.evaluations_employes'));

  -- 5 Tenue : mêmes règles
  r := pg_temp.n(r, '5.1 tenue : E1 ne voit que la sienne', '=1', pg_temp.essai('E1', 'select count(*)::text from public.controles_tenue'));
  r := pg_temp.n(r, '5.2 tenue : E1 ne voit pas celle de E2', '=0',
    pg_temp.essai('E1', format($f$select count(*)::text from public.controles_tenue where employee_id = %L$f$, (select ids.v from ids where ids.k = 'E2'))));
  r := pg_temp.n(r, '5.3 tenue : manager voit toute la station', '=2',
    pg_temp.essai('M1', format($f$select count(*)::text from public.controles_tenue where site = %L$f$, st)));
  r := pg_temp.n(r, '5.4 tenue : gérant voit toute la station', '=2',
    pg_temp.essai('G1', format($f$select count(*)::text from public.controles_tenue where site = %L$f$, st)));
  r := pg_temp.n(r, '5.5 tenue : manager ne voit pas l''autre station', '=0',
    pg_temp.essai('M1', format($f$select count(*)::text from public.controles_tenue where site = %L$f$, os)));
  r := pg_temp.n(r, '5.6 tenue : employé d''une autre station ne voit que la sienne', '=1', pg_temp.essai('X1', 'select count(*)::text from public.controles_tenue'));

  -- 6 Créateur : selon sites.acces_createur_autorise (état posé ici, jamais supposé)
  perform pg_temp.exec(format('update sites set acces_createur_autorise = false where site_id = %L', st));
  r := pg_temp.n(r, '6.1 créateur, accès non autorisé : aucune évaluation d''autrui', '=0',
    pg_temp.essai('CR1', 'select count(*)::text from public.evaluations_employes'));
  r := pg_temp.n(r, '6.2 créateur, accès non autorisé : aucune tenue d''autrui', '=0',
    pg_temp.essai('CR1', 'select count(*)::text from public.controles_tenue'));
  perform pg_temp.exec(format('update sites set acces_createur_autorise = true where site_id = %L', st));
  r := pg_temp.n(r, '6.3 créateur, accès autorisé : évaluations de la station', '=2',
    pg_temp.essai('CR1', 'select count(*)::text from public.evaluations_employes'));
  r := pg_temp.n(r, '6.4 créateur, accès autorisé : tenue de la station', '=2',
    pg_temp.essai('CR1', 'select count(*)::text from public.controles_tenue'));
  r := pg_temp.n(r, '6.5 créateur, accès autorisé : pas l''autre station', '=0',
    pg_temp.essai('CR1', format($f$select count(*)::text from public.evaluations_employes where site = %L$f$, os)));

  raise exception 'RAPPORT_RLS_LOT1 %', jsonb_build_object('total', jsonb_array_length(r),
    'ko', (select count(*) from jsonb_array_elements(r) e where not (e->>'ok')::boolean), 'cas', r);
end
$rapport$;
rollback;
