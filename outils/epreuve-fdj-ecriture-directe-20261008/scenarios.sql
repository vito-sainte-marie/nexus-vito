-- Scénarios : chaque bloc part de fixtures neuves et se termine par rollback.
-- Étiquettes en majuscules sans chiffre (lues par executer.sh).
\set ON_ERROR_STOP 0

-- Un employé ne se valide pas lui-même par appel direct.
begin; \i fixtures.sql
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', true);
do $$ begin
  perform pg_temp.ok((select count(*) = 1 from public.fdj_cash_controls), 'le caissier lit la caisse de son site');
  perform pg_temp.refus($q$ update public.fdj_cash_controls
      set valide_par = 'a0000000-0000-0000-0000-000000000004', resultat_controle = 'conforme', ecart = 0
    where shift_id = 'fd000000-0000-0000-0000-000000000002' $q$, 'permission denied');
  raise notice 'OK MISEAJOUR';
end $$;
reset role;
do $$ begin
  perform pg_temp.ok((select ecart = -15 and resultat_controle = 'a_regulariser'
                        and valide_par = 'a0000000-0000-0000-0000-000000000001'
                        from public.fdj_cash_controls where shift_id = 'fd000000-0000-0000-0000-000000000002'),
                     'caisse validée intacte');
end $$;
rollback;

-- Ni création ni suppression directe d'une caisse.
begin; \i fixtures.sql
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', true);
do $$ begin
  perform pg_temp.refus($q$ insert into public.fdj_cash_controls (site, shift_id, ecart, resultat_controle, statut)
    values ('site-a', 'fd000000-0000-0000-0000-000000000001', 0, 'conforme', 'conforme') $q$, 'permission denied');
  raise notice 'OK INSERTION';
  perform pg_temp.refus($q$ delete from public.fdj_cash_controls
    where shift_id = 'fd000000-0000-0000-0000-000000000002' $q$, 'permission denied');
  raise notice 'OK SUPPRESSION';
end $$;
rollback;

-- Les commandes fonctionnent toujours : brouillon, confirmation (employé),
-- validation (manager), et la validation reste refusée à l'employé.
begin; \i fixtures.sql
set local role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', true);
do $$ declare r jsonb; begin
  r := public.fdj_enregistrer_brouillon_caisse('fd000000-0000-0000-0000-000000000001', '{}'::jsonb, 0, 0, 0, 0);
  perform pg_temp.ok(r->>'enregistre' is distinct from 'false', 'brouillon : ' || r::text);
  r := public.fdj_confirmer_caisse('fd000000-0000-0000-0000-000000000001', '{}'::jsonb, 0, 0, 0, 0);
  perform pg_temp.ok((select confirme_le is not null and valide_le is null from public.fdj_cash_controls
                       where shift_id = 'fd000000-0000-0000-0000-000000000001'), 'confirmée, non validée : ' || r::text);
  perform pg_temp.refus($q$ select public.fdj_valider_caisse('fd000000-0000-0000-0000-000000000001', 'conforme', null, null) $q$,
                        'Seul un manager');
end $$;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', true);
do $$ begin
  perform public.fdj_valider_caisse('fd000000-0000-0000-0000-000000000001', 'conforme', null, null);
  perform pg_temp.ok((select valide_le is not null and valide_par = 'a0000000-0000-0000-0000-000000000001'
                        from public.fdj_cash_controls where shift_id = 'fd000000-0000-0000-0000-000000000001'),
                     'validée par le manager');
  raise notice 'OK CHAINE';
end $$;
rollback;

-- Lecture : une autre station ne voit rien.
begin; \i fixtures.sql
set local role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000004', true);
do $$ begin
  perform pg_temp.ok((select count(*) = 0 from public.fdj_cash_controls), 'B ne lit pas la caisse de A');
  raise notice 'OK SITES';
end $$;
rollback;

-- Droits : plus aucune écriture pour anon et authenticated.
begin; \i fixtures.sql
do $$ begin
  perform pg_temp.ok(not has_table_privilege('anon', 'public.fdj_cash_controls', 'select,insert,update,delete,truncate,references,trigger'), 'anon');
  perform pg_temp.ok(not has_table_privilege('authenticated', 'public.fdj_cash_controls', 'insert,update,delete,truncate,references,trigger'), 'authenticated écrit');
  perform pg_temp.ok(has_table_privilege('authenticated', 'public.fdj_cash_controls', 'select'), 'authenticated lit');
  raise notice 'OK DROITS';
end $$;
rollback;
