\set ON_ERROR_STOP 0
-- Rôles hors caisse : P pompiste, R renfort, V polyvalent ; M manager (motif historique).
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.refuse('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2', 'prise_de_poste_hors_caisse', 'P pompiste');
  raise notice 'OK P';
end $$;
rollback;
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.refuse('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d3', 'prise_de_poste_hors_caisse', 'R renfort');
  raise notice 'OK R';
end $$;
rollback;
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.refuse('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d4', 'prise_de_poste_hors_caisse', 'V polyvalent');
  raise notice 'OK V';
end $$;
rollback;
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.refuse('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000d5', 'prise_de_poste_managerial', 'M manager');
  raise notice 'OK M';
end $$;
rollback;
-- C. La caissière ouvre le quart 1, en est titulaire, et l'ouverture est journalisée.
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.qui('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.ok(public.fdj_ouvrir_quart_depuis_prise_de_poste('00000000-0000-0000-0000-0000000000d1')->>'motif' = 'ouverture_naturelle', 'C ouverture naturelle');
  perform pg_temp.ok((select count(*) from public.fdj_shifts where site = 'site-role' and quart = '1' and employee_id = '00000000-0000-0000-0000-0000000000c1' and statut = 'brouillon') = 1, 'C quart 1 au nom de la caissière');
  perform pg_temp.ok(pg_temp.journal() = 1, 'C ouverture journalisée');
  raise notice 'OK C';
end $$;
rollback;
-- I. Incident du 05/10 : le pompiste arrive d'abord ; la caissière ouvre ensuite sans conflit.
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.refuse('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d2', 'prise_de_poste_hors_caisse', 'I pompiste d''abord');
  perform pg_temp.qui('00000000-0000-0000-0000-0000000000c1');
  perform pg_temp.ok(public.fdj_ouvrir_quart_depuis_prise_de_poste('00000000-0000-0000-0000-0000000000d1')->>'motif' = 'ouverture_naturelle', 'I la caissière ouvre sans conflit');
  perform pg_temp.ok((select employee_id from public.fdj_shifts where site = 'site-role' and quart = '1') = '00000000-0000-0000-0000-0000000000c1', 'I titulaire = caissière');
  raise notice 'OK I';
end $$;
rollback;
-- K. Après ouverture par la caissière, un pompiste reçoit le refus de rôle, pas un conflit.
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.qui('00000000-0000-0000-0000-0000000000c1');
  perform public.fdj_ouvrir_quart_depuis_prise_de_poste('00000000-0000-0000-0000-0000000000d1');
  perform pg_temp.qui('00000000-0000-0000-0000-0000000000a1');
  perform pg_temp.ok(public.fdj_ouvrir_quart_depuis_prise_de_poste('00000000-0000-0000-0000-0000000000d2')->>'motif' = 'prise_de_poste_hors_caisse', 'K refus de rôle, pas conflit');
  perform pg_temp.ok(pg_temp.quarts() = 1 and pg_temp.journal() = 1, 'K rien de plus écrit');
  raise notice 'OK K';
end $$;
rollback;
-- ACL inchangées : authenticated et service_role exécutent, anon et public non.
begin;
\i fixtures.sql
do $$ begin
  perform pg_temp.ok(has_function_privilege('authenticated', 'public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid)', 'execute'), 'ACL authenticated');
  perform pg_temp.ok(has_function_privilege('service_role', 'public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid)', 'execute'), 'ACL service_role');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid)', 'execute'), 'ACL anon fermé');
  perform pg_temp.ok((select prosecdef and proconfig = array['search_path=""'] from pg_proc where oid = 'public.fdj_ouvrir_quart_depuis_prise_de_poste(uuid)'::regprocedure), 'ACL definer, search_path vide');
  raise notice 'OK ACL';
end $$;
rollback;
