-- Scénarios : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
-- Quarts : …01 brouillon de A, …02 validé de A, …03 collègue de A, …04 station B.
-- Jeux : 9a… (site-a), 9b… (site-b).
\set ON_ERROR_STOP 0

-- Droits : plus aucune écriture directe ; anon ne lit ni n'exécute plus rien.
begin; \i fixtures.sql
do $$ declare t text; f text; begin
  foreach t in array array['public.fdj_shifts', 'public.fdj_shift_counts'] loop
    perform pg_temp.ok(not has_table_privilege('anon', t, 'select,insert,update,delete,truncate,references,trigger'), 'anon sur ' || t);
    perform pg_temp.ok(not has_table_privilege('authenticated', t, 'insert,update,delete,truncate,references,trigger'), 'authenticated écrit ' || t);
    perform pg_temp.ok(has_table_privilege('authenticated', t, 'select'), 'authenticated lit ' || t);
  end loop;
  foreach f in array array[
    'public.fdj_incrementer_appro_shift_count(text, uuid, uuid, numeric)',
    'public.fdj_lier_quart_precedent(uuid, uuid)',
    'public.fdj_valider_ouverture_quart(uuid, jsonb)',
    'public.fdj_manager_creer_quart(date, text, uuid, text)',
    'public.fdj_manager_modifier_quart(uuid, date, text, text)',
    'public.fdj_manager_changer_statut_quart(uuid, text)',
    'public.fdj_manager_enregistrer_comptages(uuid, jsonb)',
    'public.fdj_manager_corriger_comptages(uuid, jsonb)',
    'public.fdj_manager_marquer_releve_cloture(uuid, text)',
    'public.fdj_manager_marquer_replay(uuid, boolean)',
    'public.fdj_manager_incrementer_version(uuid)',
    'public.fdj_manager_marquer_a_revoir(uuid, text)'] loop
    perform pg_temp.ok(not has_function_privilege('anon', f, 'execute'), 'anon exécute ' || f);
    perform pg_temp.ok(has_function_privilege('authenticated', f, 'execute'), 'authenticated exécute ' || f);
  end loop;
  foreach f in array array[
    'public.fdj_quart_ouvert_de_l_employe(uuid)',
    'public.fdj_site_du_manager()',
    'public.fdj_exiger_jeu_du_site(uuid, text)'] loop
    perform pg_temp.ok(not has_function_privilege('authenticated', f, 'execute'), 'aide exposée ' || f);
    perform pg_temp.ok(not has_function_privilege('anon', f, 'execute'), 'aide exposée à anon ' || f);
  end loop;
  raise notice 'OK DROITS';
end $$;
rollback;

-- Ni le caissier ni le manager n'écrivent plus directement les deux tables.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.ok((select count(*) >= 1 from public.fdj_shifts where id = 'fd000000-0000-0000-0000-000000000001'), 'le caissier lit son quart');
  perform pg_temp.refus($q$ update public.fdj_shifts set statut = 'valide' where id = 'fd000000-0000-0000-0000-000000000001' $q$, 'permission denied');
  perform pg_temp.refus($q$ insert into public.fdj_shifts (site, date, quart, employee_id) values ('site-a', current_date + 9, '1', 'a0000000-0000-0000-0000-000000000004') $q$, 'permission denied');
  perform pg_temp.refus($q$ delete from public.fdj_shifts where id = 'fd000000-0000-0000-0000-000000000003' $q$, 'permission denied');
  perform pg_temp.refus($q$ update public.fdj_shift_counts set stock_final = 0 where shift_id = 'fd000000-0000-0000-0000-000000000002' $q$, 'permission denied');
  perform pg_temp.refus($q$ insert into public.fdj_shift_counts (site, shift_id, game_id, appro) values ('site-a', 'fd000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 99) $q$, 'permission denied');
end $$;
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
do $$ begin
  perform pg_temp.refus($q$ update public.fdj_shifts set a_revoir = true where id = 'fd000000-0000-0000-0000-000000000001' $q$, 'permission denied');
  perform pg_temp.refus($q$ delete from public.fdj_shift_counts where shift_id = 'fd000000-0000-0000-0000-000000000002' $q$, 'permission denied');
  raise notice 'OK DIRECT';
end $$;
rollback;

-- anon n'incrémente plus l'appro (l'ancienne fonction était exposée en INVOKER).
begin; \i fixtures.sql
set local role anon;
do $$ begin
  perform pg_temp.refus($q$ select public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 5) $q$, 'permission denied');
  perform pg_temp.refus($q$ select public.fdj_manager_incrementer_version('fd000000-0000-0000-0000-000000000001') $q$, 'permission denied');
  raise notice 'OK ANON';
end $$;
rollback;

-- Le titulaire valide son ouverture ; un jeu d'un autre site est refusé.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ declare r jsonb; begin
  perform pg_temp.refus($q$ select public.fdj_valider_ouverture_quart('fd000000-0000-0000-0000-000000000001',
    '[{"game_id":"9b000000-0000-0000-0000-000000000001","stock_initial":10}]'::jsonb) $q$, 'n''appartient pas au site');
  r := public.fdj_valider_ouverture_quart('fd000000-0000-0000-0000-000000000001',
    '[{"game_id":"9a000000-0000-0000-0000-000000000001","stock_initial":40,"stock_initial_auto":true}]'::jsonb);
  perform pg_temp.ok((r->>'comptages')::int = 1, 'une ligne : ' || r::text);
  perform pg_temp.ok((select ouverture_validee and ouverture_validee_le is not null from public.fdj_shifts
                       where id = 'fd000000-0000-0000-0000-000000000001'), 'ouverture validée');
  perform pg_temp.ok((select stock_initial = 40 and appro = 0 and stock_initial_auto and site = 'site-a'
                        from public.fdj_shift_counts where shift_id = 'fd000000-0000-0000-0000-000000000001'), 'comptage posé');
  raise notice 'OK OUVERTURE';
end $$;
rollback;

-- Appro : incrément atomique sur son quart ; site incohérent, jeu étranger,
-- quantité manquante refusés.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ declare v numeric; begin
  v := public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 2);
  v := public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 3);
  perform pg_temp.ok(v = 5, 'appro cumulée : ' || v);
  perform pg_temp.refus($q$ select public.fdj_incrementer_appro_shift_count('site-b', 'fd000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', 1) $q$, 'Site incohérent');
  perform pg_temp.refus($q$ select public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000001', '9b000000-0000-0000-0000-000000000001', 1) $q$, 'n''appartient pas au site');
  perform pg_temp.refus($q$ select public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000001', '9a000000-0000-0000-0000-000000000001', null) $q$, 'manquante');
  raise notice 'OK APPRO';
end $$;
rollback;

-- Lien vers le précédent : seulement un quart validé, antérieur, du même site ;
-- posé une seule fois.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.refus($q$ select public.fdj_lier_quart_precedent('fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000001') $q$, 'invalide');
  perform pg_temp.refus($q$ select public.fdj_lier_quart_precedent('fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000004') $q$, 'site du quart');
  perform pg_temp.refus($q$ select public.fdj_lier_quart_precedent('fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000003') $q$, 'validé antérieur');
  perform pg_temp.ok(public.fdj_lier_quart_precedent('fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002'), 'lien posé');
  perform pg_temp.ok(not public.fdj_lier_quart_precedent('fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002'), 'jamais réécrit');
  perform pg_temp.ok((select previous_shift_id = 'fd000000-0000-0000-0000-000000000002' from public.fdj_shifts
                       where id = 'fd000000-0000-0000-0000-000000000001'), 'lien lu');
  raise notice 'OK LIEN';
end $$;
rollback;

-- Un quart validé est clos pour son titulaire.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.refus($q$ select public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000002', '9a000000-0000-0000-0000-000000000001', 1) $q$, 'est validé');
  perform pg_temp.refus($q$ select public.fdj_valider_ouverture_quart('fd000000-0000-0000-0000-000000000002', '[]'::jsonb) $q$, 'est validé');
  raise notice 'OK CLOS';
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select appro = 0 and stock_final = 40 from public.fdj_shift_counts
                       where shift_id = 'fd000000-0000-0000-0000-000000000002'), 'quart validé intact');
end $$;
rollback;

-- Ni le quart d'un collègue, ni celui d'une autre station.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.refus($q$ select public.fdj_incrementer_appro_shift_count('site-a', 'fd000000-0000-0000-0000-000000000003', '9a000000-0000-0000-0000-000000000001', 1) $q$, 'autre employé');
  perform pg_temp.refus($q$ select public.fdj_valider_ouverture_quart('fd000000-0000-0000-0000-000000000003', '[]'::jsonb) $q$, 'autre employé');
end $$;
select pg_temp.qui('b0000000-0000-0000-0000-000000000004');
do $$ begin
  perform pg_temp.refus($q$ select public.fdj_valider_ouverture_quart('fd000000-0000-0000-0000-000000000001', '[]'::jsonb) $q$, 'autre site');
  perform pg_temp.refus($q$ select public.fdj_lier_quart_precedent('fd000000-0000-0000-0000-000000000001', 'fd000000-0000-0000-0000-000000000002') $q$, 'autre site');
  raise notice 'OK COLLEGUE';
end $$;
rollback;

-- Commandes manager : refusées au caissier, acceptées pour le manager du site,
-- refusées sur une autre station.
begin; \i fixtures.sql
set local role authenticated;
select pg_temp.qui('a0000000-0000-0000-0000-000000000004');
do $$ declare q text; begin
  foreach q in array array[
    $q$ select public.fdj_manager_creer_quart(current_date + 9, '1', null, 'brouillon') $q$,
    $q$ select public.fdj_manager_modifier_quart('fd000000-0000-0000-0000-000000000001', current_date, '1', 'valide') $q$,
    $q$ select public.fdj_manager_changer_statut_quart('fd000000-0000-0000-0000-000000000001', 'valide') $q$,
    $q$ select public.fdj_manager_enregistrer_comptages('fd000000-0000-0000-0000-000000000001', '[]'::jsonb) $q$,
    $q$ select public.fdj_manager_corriger_comptages('fd000000-0000-0000-0000-000000000002', '[]'::jsonb) $q$,
    $q$ select public.fdj_manager_marquer_releve_cloture('fd000000-0000-0000-0000-000000000001', 'ok') $q$,
    $q$ select public.fdj_manager_marquer_replay('fd000000-0000-0000-0000-000000000001', true) $q$,
    $q$ select public.fdj_manager_incrementer_version('fd000000-0000-0000-0000-000000000001') $q$,
    $q$ select public.fdj_manager_marquer_a_revoir('fd000000-0000-0000-0000-000000000001', 'x') $q$] loop
    perform pg_temp.refus(q, 'Seul un manager');
  end loop;
end $$;
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
do $$ declare r jsonb; n int; begin
  perform pg_temp.refus($q$ select public.fdj_manager_creer_quart(pg_temp.j(5), '1', 'b0000000-0000-0000-0000-000000000004', 'brouillon') $q$, 'titulaire');
  r := public.fdj_manager_creer_quart(pg_temp.j(5), '1', 'a0000000-0000-0000-0000-000000000004', 'brouillon');
  perform pg_temp.ok(r->>'site' = 'site-a' and r->>'created_by' = 'a0000000-0000-0000-0000-000000000001'
                     and r->>'ouverture_source' = 'creation_manager', 'quart créé : ' || r::text);
  r := public.fdj_manager_modifier_quart((r->>'id')::uuid, pg_temp.j(6), '2', 'valide');
  perform pg_temp.ok(r->>'quart' = '2' and r->>'valide_le' is not null, 'quart modifié : ' || r::text);
  r := public.fdj_manager_changer_statut_quart((r->>'id')::uuid, 'brouillon');
  perform pg_temp.ok(r->>'statut' = 'brouillon', 'statut changé');
  perform pg_temp.refus($q$ select public.fdj_manager_enregistrer_comptages('fd000000-0000-0000-0000-000000000002',
    '[{"game_id":"9b000000-0000-0000-0000-000000000001","stock_initial":1}]'::jsonb) $q$, 'n''appartient pas au site');
  r := public.fdj_manager_enregistrer_comptages('fd000000-0000-0000-0000-000000000002',
    '[{"game_id":"9a000000-0000-0000-0000-000000000001","stock_initial":50,"appro":4,"stock_final":30,"ventes_qte":24,"ventes_valeur":48}]'::jsonb);
  n := public.fdj_manager_corriger_comptages('fd000000-0000-0000-0000-000000000002',
    '[{"game_id":"9a000000-0000-0000-0000-000000000001","stock_initial":52}]'::jsonb);
  perform pg_temp.ok(n = 1, 'une ligne corrigée');
  perform pg_temp.ok((select stock_initial = 52 and appro = 4 and ventes_qte = 24 from public.fdj_shift_counts
                       where shift_id = 'fd000000-0000-0000-0000-000000000002'), 'comptages manager');
  perform public.fdj_manager_marquer_releve_cloture('fd000000-0000-0000-0000-000000000002', 'ok');
  perform public.fdj_manager_marquer_replay('fd000000-0000-0000-0000-000000000002', false);
  perform pg_temp.ok(public.fdj_manager_incrementer_version('fd000000-0000-0000-0000-000000000002')
                   < public.fdj_manager_incrementer_version('fd000000-0000-0000-0000-000000000002'), 'version croissante');
  perform pg_temp.refus($q$ select public.fdj_manager_marquer_a_revoir('fd000000-0000-0000-0000-000000000002', ' ') $q$, 'Motif');
  perform public.fdj_manager_marquer_a_revoir('fd000000-0000-0000-0000-000000000002', 'correction_amont_stock_initial_deja_confirme');
  perform pg_temp.ok((select releve_cloture_statut = 'ok' and needs_replay and a_revoir from public.fdj_shifts
                       where id = 'fd000000-0000-0000-0000-000000000002'), 'drapeaux posés');
  perform pg_temp.refus($q$ select public.fdj_manager_changer_statut_quart('fd000000-0000-0000-0000-000000000004', 'valide') $q$, 'autre site');
  raise notice 'OK MANAGER';
end $$;
rollback;
