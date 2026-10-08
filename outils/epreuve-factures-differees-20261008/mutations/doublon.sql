-- Accepte deux fois le même numéro dans un quart. Rougit : DOUBLON.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'if v_numero = any(v_numeros) then', 'if false then');
