-- epreuve-sql-dynamique-public-20261003.sql
--
-- Condition d'escalade P0 de la dette TRUNCATE (qualifiée P2 le 03/10/2026).
--
-- 144 tables `public` sur 162 accordent TRUNCATE à `anon` et `authenticated`
-- (défaut Supabase). TRUNCATE ignore la RLS. La dette reste P2 tant qu'AUCUN
-- chemin ne permet d'émettre un TRUNCATE sous ces rôles : PostgREST n'expose
-- pas TRUNCATE, pg_graphql n'est pas installé, `cron` n'ouvre pas USAGE.
-- Le seul chemin restant est une fonction `public` exécutable par l'un des
-- deux rôles qui porte du SQL dynamique (`EXECUTE`) ou un `TRUNCATE` :
--   - en SECURITY INVOKER, elle tronque avec le droit que le rôle détient ;
--   - en SECURITY DEFINER, avec celui du propriétaire.
-- Cette épreuve refuse qu'une telle fonction existe. Si elle rougit, la dette
-- TRUNCATE passe P0 : STOP, et `revoke truncate` devient la correction.
--
-- Mesuré le 03/10/2026 en lecture seule : Production 68 fonctions, Test 69,
-- zéro correspondance des deux côtés ; témoin `realtime` = 6 des deux côtés.
--
-- Trois parties, et les deux premières existent pour que la troisième ne
-- puisse pas être verte pour une mauvaise raison :
--   SQLDYN-001  témoin : le motif trouve du SQL dynamique là où il y en a ;
--   SQLDYN-002  contre-témoin : une fonction fautive, créée dans pg_temp et
--               annulée, est vue par le prédicat COMPLET (motif, langage,
--               droit d'exécution) ;
--   SQLDYN-000  le catalogue `public` est visible (sinon zéro ne prouve rien) ;
--   SQLDYN-003  verdict : aucune fonction `public` fautive.
--
-- Faux positif connu, et il penche vers le rouge, jamais vers le vert : le
-- motif voit aussi `execute` dans un commentaire ou un littéral (le prédicat
-- ci-dessous se détecte lui-même par son `'EXECUTE'`). Aucune fonction
-- `public` n'en porte au 03/10/2026 ; si l'une en porte un jour, la lire
-- avant de conclure P0, et ne jamais l'exempter par son nom.
--
-- Lecture seule sur `public`. La seule écriture est une fonction temporaire,
-- dans une transaction terminée par ROLLBACK.

\set ON_ERROR_STOP 1
\set VERBOSITY verbose

begin;

-- Le prédicat, défini UNE fois et appliqué aux trois parties : le témoin et
-- le contre-témoin éprouvent ainsi le même code que le verdict.
create function pg_temp.fonctions_sql_dynamique(schema_vise text)
returns table (fonction text, definer boolean, anon boolean, authenticated boolean)
language sql stable as $f$
  select p.oid::regprocedure::text, p.prosecdef,
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
  where n.nspname = schema_vise
    and l.lanname in ('plpgsql', 'sql')
    and (p.prosrc ~* '\mexecute\M' or p.prosrc ~* '\mtruncate\M')
    and (has_function_privilege('anon', p.oid, 'EXECUTE')
         or has_function_privilege('authenticated', p.oid, 'EXECUTE'))
$f$;

-- SQLDYN-001 — témoin. Le motif seul, sans le filtre de droits : les
-- fonctions `realtime` ne sont pas forcément exécutables par anon.
do $$
declare n int;
begin
  select count(*) into n
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'realtime' and p.prosrc ~* '\mexecute\M';
  if n = 0 then
    raise exception 'SQLDYN-001 — témoin muet : le motif ne trouve aucun EXECUTE dans realtime (6 attendus au 03/10/2026). Instrument aveugle, verdict impossible.';
  end if;
  raise notice 'SQLDYN-001 OK — témoin : % fonction(s) realtime portent EXECUTE.', n;
end $$;

-- SQLDYN-002 — contre-témoin. Une fonction exactement fautive.
create function pg_temp.contre_temoin_sql_dynamique(t text)
returns void language plpgsql as $f$
begin
  execute format('truncate %I', t);
end
$f$;

do $$
declare n int; schema_temp text;
begin
  select nspname into schema_temp from pg_namespace where oid = pg_my_temp_schema();
  select count(*) into n
  from pg_temp.fonctions_sql_dynamique(schema_temp)
  where fonction like '%contre_temoin_sql_dynamique%';
  if n <> 1 then
    raise exception 'SQLDYN-002 — contre-témoin non vu (% au lieu de 1) : le prédicat ne détecte pas une fonction fautive.', n;
  end if;
  raise notice 'SQLDYN-002 OK — contre-témoin : la fonction fautive de % est détectée.', schema_temp;
end $$;

-- SQLDYN-000 — le catalogue `public` est visible. Plancher, pas égalité :
-- ajouter des fonctions ne doit pas rougir, ne plus en voir doit rougir.
do $$
declare n int;
begin
  select count(*) into n
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public';
  if n < 30 then
    raise exception 'SQLDYN-000 — seulement % fonction(s) visibles dans public (69 sur Test au 03/10/2026) : un zéro ne prouverait rien.', n;
  end if;
  raise notice 'SQLDYN-000 OK — % fonction(s) public examinées.', n;
end $$;

-- SQLDYN-003 — verdict.
do $$
declare fautives text;
begin
  select string_agg(format('%s [definer=%s anon=%s authenticated=%s]',
                           fonction, definer, anon, authenticated), '; ' order by fonction)
    into fautives
  from pg_temp.fonctions_sql_dynamique('public');
  if fautives is not null then
    raise exception 'SQLDYN-003 — P0 TRUNCATE : fonction(s) public exécutable(s) par anon/authenticated portant EXECUTE ou TRUNCATE : %. Avec TRUNCATE accordé à ces rôles sur 144 tables, c''est un chemin de troncature hors RLS. STOP.', fautives;
  end if;
  raise notice 'SQLDYN-003 OK — aucune fonction public exécutable par anon/authenticated ne porte EXECUTE ni TRUNCATE.';
end $$;

rollback;

\echo 'ÉPREUVE SQL DYNAMIQUE PUBLIC : toutes les parties ont passé.'
