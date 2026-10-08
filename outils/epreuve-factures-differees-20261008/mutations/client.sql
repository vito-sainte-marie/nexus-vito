-- Accepte un client vide. Rougit : CHAMPS.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'if v_client = '''' then', 'if false then');
