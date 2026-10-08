-- Ne cherche plus le numéro sur les autres quarts. Rougit : DEJASAISIE.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'and a.factures_differees @>', 'and false and a.factures_differees @>');
