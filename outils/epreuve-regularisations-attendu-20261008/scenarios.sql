-- Scénarios : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
-- Le quart récepteur est J−1 Q1 (défaut de pg_temp.verser) ; aucun audit ni
-- caisse FDJ n'y existe dans les fixtures.
\set ON_ERROR_STOP 0

-- Le chemin réel de Verify : upsert sur (site, date, quart). Un attendu qui
-- oublie un versement reçu est refusé ; le même, régularisations comprises,
-- passe.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.verser(15);
  perform pg_temp.refus(format($q$ insert into public.audits_caisse as a (site, date, quart, ecart_piste, regularisations_piste)
    values ('site-a', %L, '1', 15, 0)
    on conflict (site, date, quart) do update set ecart_piste = excluded.ecart_piste, regularisations_piste = excluded.regularisations_piste $q$,
    pg_temp.j(-1)), '[REGULARISATIONS_PERIMEES]');
  insert into public.audits_caisse as a (site, date, quart, ecart_piste, regularisations_piste)
  values ('site-a', pg_temp.j(-1), '1', 0, 15)
  on conflict (site, date, quart) do update set ecart_piste = excluded.ecart_piste, regularisations_piste = excluded.regularisations_piste;
  perform pg_temp.ok((select regularisations_piste = 15 and regularisations_boutique = 0 from public.audits_caisse
                       where site = 'site-a' and date = pg_temp.j(-1) and quart = '1'), 'upsert aligné accepté');
  raise notice 'OK UPSERT';
end $$;
rollback;

-- Un versement reçu après le calcul : la validation est refusée tant que
-- l'écart n'a pas été recalculé avec lui.
begin; \i fixtures.sql
do $$ declare v_id uuid; begin
  insert into public.audits_caisse (site, date, quart, ecart_piste) values ('site-a', pg_temp.j(-1), '1', 0) returning id into v_id;
  perform pg_temp.verser(15);
  perform pg_temp.refus(format('update public.audits_caisse set valide_le_piste = clock_timestamp() where id = %L', v_id), '[REGULARISATIONS_PERIMEES]');
  perform pg_temp.refus(format('update public.audits_caisse set ecart_piste = -15 where id = %L', v_id), '[REGULARISATIONS_PERIMEES]');
  update public.audits_caisse set ecart_piste = -15, regularisations_piste = 15 where id = v_id;
  update public.audits_caisse set valide_le_piste = clock_timestamp(), ecart_piste_valide = -15 where id = v_id;
  perform pg_temp.ok((select valide_le_piste is not null from public.audits_caisse where id = v_id), 'validation après recalcul');
  raise notice 'OK VALIDATION';
end $$;
rollback;

-- Une écriture qui ne touche ni l'écart, ni les régularisations, ni la
-- validation n'est pas jugée : un ancien écran peut encore la faire.
begin; \i fixtures.sql
do $$ declare v_id uuid; begin
  insert into public.audits_caisse (site, date, quart, ecart_piste) values ('site-a', pg_temp.j(-1), '1', 0) returning id into v_id;
  perform pg_temp.verser(15);
  update public.audits_caisse set employes_piste = '["a0000000-0000-0000-0000-000000000006"]' where id = v_id;
  perform pg_temp.ok((select regularisations_piste = 0 from public.audits_caisse where id = v_id), 'écriture neutre acceptée, rien réécrit');
  raise notice 'OK AUTRECOLONNE';
end $$;
rollback;

-- Le net d'un tiroir : versements reçus, moins restitutions et transferts
-- qui en sortent, ventilé par mode ; un transfert sans versement est
-- « sans_mode ». Lu par l'écran via regularisations_tiroirs.
begin; \i fixtures.sql
do $$ declare v1 uuid; d jsonb; p jsonb; b jsonb; begin
  v1 := (pg_temp.verser(15)->>'versement_id')::uuid;
  perform pg_temp.verser(5, mode => 'cheque');
  perform public.enregistrer_transfert_coffre('tiroir_verify_piste', pg_temp.j(-1), '1', 10, v1, 'dépôt au coffre en fin de quart', gen_random_uuid());
  update public.audits_caisse set ecart_piste_valide = -5, valide_le_piste = clock_timestamp() where id = 'ad000000-0000-0000-0000-000000000001';
  perform public.enregistrer_restitution_trop_percu('ad000000-0000-0000-0000-000000000001', 'piste', null,
    3, 'especes', 'audit corrigé le jour même', 'tiroir_verify_piste', pg_temp.j(-1), '1', gen_random_uuid());
  perform public.enregistrer_transfert_coffre('tiroir_verify_boutique', pg_temp.j(-1), '1', 4, null, 'excédent de caisse déposé', gen_random_uuid());
  d := public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1');
  p := d->'tiroir_verify_piste';
  b := d->'tiroir_verify_boutique';
  perform pg_temp.ok((p->>'net')::numeric = 7 and (p->>'entrees')::numeric = 20 and (p->>'sorties')::numeric = 13, 'piste : ' || p::text);
  perform pg_temp.ok((p#>>'{par_mode,especes,net}')::numeric = 2 and (p#>>'{par_mode,cheque,net}')::numeric = 5, 'piste par mode : ' || p::text);
  perform pg_temp.ok((b->>'net')::numeric = -4 and (b#>>'{par_mode,sans_mode,sorties}')::numeric = 4, 'boutique : ' || b::text);
  perform pg_temp.ok((d#>>'{tiroir_fdj,net}')::numeric = 0, 'FDJ intact');
  insert into public.audits_caisse (site, date, quart, ecart_piste, regularisations_piste, regularisations_boutique)
  values ('site-a', pg_temp.j(-1), '1', 0, 7, -4);
  raise notice 'OK DETAIL';
end $$;
rollback;

-- Un dépôt direct au coffre ne touche aucun tiroir.
begin; \i fixtures.sql
do $$ declare d jsonb; begin
  perform pg_temp.verser(20, dest => 'coffre');
  d := public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1');
  perform pg_temp.ok((d#>>'{tiroir_verify_piste,net}')::numeric = 0 and (d#>>'{tiroir_verify_boutique,net}')::numeric = 0
                     and (d#>>'{tiroir_fdj,net}')::numeric = 0, 'coffre sans effet : ' || d::text);
  insert into public.audits_caisse (site, date, quart, ecart_piste) values ('site-a', pg_temp.j(-1), '1', 0);
  raise notice 'OK COFFRE';
end $$;
rollback;

-- Un versement n'entre que dans son tiroir : ni l'autre caisse, ni l'autre
-- quart, ni l'autre station.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.verser(15);
  perform pg_temp.ok(public._regul_tiroir_net('site-a', 'tiroir_verify_piste', pg_temp.j(-1), '1') = 15, 'tiroir récepteur');
  perform pg_temp.ok(public._regul_tiroir_net('site-a', 'tiroir_verify_boutique', pg_temp.j(-1), '1') = 0, 'autre caisse');
  perform pg_temp.ok(public._regul_tiroir_net('site-a', 'tiroir_verify_piste', pg_temp.j(-1), '2') = 0, 'autre quart');
  perform pg_temp.ok(public._regul_tiroir_net('site-a', 'tiroir_verify_piste', pg_temp.j(0), '1') = 0, 'autre jour');
  perform pg_temp.ok(public._regul_tiroir_net('site-b', 'tiroir_verify_piste', pg_temp.j(-1), '1') = 0, 'autre station');
  insert into public.audits_caisse (site, date, quart, ecart_piste) values ('site-b', pg_temp.j(-1), '1', 0);
  raise notice 'OK ISOLATION';
end $$;
rollback;

-- Une contre-écriture retire le versement de l'attendu.
begin; \i fixtures.sql
do $$ declare v1 uuid; begin
  v1 := (pg_temp.verser(15)->>'versement_id')::uuid;
  perform public.annuler_versement_regularisation(v1, 'saisi sur le mauvais quart');
  perform pg_temp.ok(public._regul_tiroir_net('site-a', 'tiroir_verify_piste', pg_temp.j(-1), '1') = 0, 'annulé : hors attendu');
  insert into public.audits_caisse (site, date, quart, ecart_piste) values ('site-a', pg_temp.j(-1), '1', 0);
  raise notice 'OK ANNULATION';
end $$;
rollback;

-- La lecture est réservée aux managers et gérants de la station ; les
-- fonctions internes ne sont ouvertes à personne.
begin; \i fixtures.sql
do $$ begin
  perform public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000002');
  perform public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000003');
  perform pg_temp.refus($q$ select public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1') $q$, 'Seul un manager ou un gérant');
  perform pg_temp.qui('b0000000-0000-0000-0000-000000000001');
  perform pg_temp.refus($q$ select public.regularisations_tiroirs('site-a', pg_temp.j(-1), '1') $q$, 'autre site');
  perform pg_temp.qui('a0000000-0000-0000-0000-000000000001');
  perform pg_temp.refus($q$ select public.regularisations_tiroirs('site-a', pg_temp.j(-1), '3') $q$, '[QUART_INVALIDE]');
  perform pg_temp.ok(not has_function_privilege('anon', 'public.regularisations_tiroirs(text, date, text)', 'execute')
                     and has_function_privilege('authenticated', 'public.regularisations_tiroirs(text, date, text)', 'execute'), 'RPC : authenticated seul');
  perform pg_temp.ok(not has_function_privilege('authenticated', 'public._regul_tiroir_detail(text, text, date, text)', 'execute')
                     and not has_function_privilege('authenticated', 'public._regul_tiroir_net(text, text, date, text)', 'execute')
                     and not has_function_privilege('authenticated', 'public.fdj_calculer_caisse(uuid, numeric, numeric)', 'execute')
                     and not has_function_privilege('anon', 'public._regul_tiroir_detail(text, text, date, text)', 'execute'), 'internes fermées');
  raise notice 'OK DROITS';
end $$;
rollback;

-- FDJ : le calcul serveur ajoute le net du tiroir FDJ à l'attendu.
begin; \i fixtures.sql
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000010', 'site-a', pg_temp.j(-1), '1', 'a0000000-0000-0000-0000-000000000004', 'brouillon');
insert into public.fdj_reports (site, shift_id, type_rapport, lots_payes_grattage, caisse_tirages) values
  ('site-a', 'fd000000-0000-0000-0000-000000000010', 'journalier', 10, null),
  ('site-a', 'fd000000-0000-0000-0000-000000000010', 'temps_reel', null, 100);
do $$ declare c jsonb; begin
  c := public.fdj_calculer_caisse('fd000000-0000-0000-0000-000000000010', 90, 0);
  perform pg_temp.ok((c->>'caisse_attendue')::numeric = 90 and (c->>'versements_regularisation')::numeric = 0, 'sans versement : ' || c::text);
  perform pg_temp.verser(15, dest => 'tiroir_fdj');
  c := public.fdj_calculer_caisse('fd000000-0000-0000-0000-000000000010', 105, 2);
  perform pg_temp.ok((c->>'caisse_attendue')::numeric = 107 and (c->>'versements_regularisation')::numeric = 15
                     and (c->>'regularisations')::numeric = 2 and (c->>'ecart')::numeric = -2, 'avec versement : ' || c::text);
  raise notice 'OK FDJ';
end $$;
rollback;

-- FDJ : une caisse confirmée avant le versement ne se valide pas tant que le
-- manager ne l'a pas recalculée ; la correction managériale la recalcule.
begin; \i fixtures.sql
insert into public.fdj_shifts (id, site, date, quart, employee_id, statut) values
  ('fd000000-0000-0000-0000-000000000010', 'site-a', pg_temp.j(-1), '1', 'a0000000-0000-0000-0000-000000000004', 'brouillon');
insert into public.fdj_reports (site, shift_id, type_rapport, lots_payes_grattage, caisse_tirages) values
  ('site-a', 'fd000000-0000-0000-0000-000000000010', 'journalier', 10, null),
  ('site-a', 'fd000000-0000-0000-0000-000000000010', 'temps_reel', null, 100);
insert into public.fdj_cash_controls (id, site, shift_id, caisse_attendue, caisse_reelle, ecart, confirme_le) values
  ('fc000000-0000-0000-0000-000000000010', 'site-a', 'fd000000-0000-0000-0000-000000000010', 90, 105, 15, now());
do $$ begin
  perform pg_temp.verser(15, dest => 'tiroir_fdj');
  perform pg_temp.refus($q$ update public.fdj_cash_controls set valide_le = clock_timestamp(), valide_par = 'a0000000-0000-0000-0000-000000000001'
    where id = 'fc000000-0000-0000-0000-000000000010' $q$, '[REGULARISATIONS_PERIMEES]');
  perform public.fdj_corriger_caisse_manager('fd000000-0000-0000-0000-000000000010', 'recalcul après versement de régularisation');
  perform pg_temp.ok((select caisse_attendue = 105 and ecart = 0 and versements_regularisation = 15
                        from public.fdj_cash_controls where id = 'fc000000-0000-0000-0000-000000000010'), 'recalculée');
  update public.fdj_cash_controls set valide_le = clock_timestamp(), valide_par = 'a0000000-0000-0000-0000-000000000001'
   where id = 'fc000000-0000-0000-0000-000000000010';
  update public.fdj_cash_controls set versements_regularisation = 0 where id = 'fc000000-0000-0000-0000-000000000010';
  perform pg_temp.ok((select versements_regularisation = 15 from public.fdj_cash_controls
                       where id = 'fc000000-0000-0000-0000-000000000010'), 'la colonne ne s''écrit pas à la main');
  raise notice 'OK FDJVALIDATION';
end $$;
rollback;
