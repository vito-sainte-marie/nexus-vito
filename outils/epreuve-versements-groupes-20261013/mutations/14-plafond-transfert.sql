-- Le transfert dépasse le versement. Rougit : TRANSFERTG.
select pg_temp.muter('public.enregistrer_transfert_coffre_groupe', $a$if v_deja + p_montant > g.montant then$a$, $a$if false then$a$);
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
