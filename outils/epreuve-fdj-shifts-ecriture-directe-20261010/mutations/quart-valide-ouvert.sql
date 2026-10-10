-- Un quart validé reste ouvert à son titulaire. Rougit : CLOS.
select pg_temp.muter('public.fdj_quart_ouvert_de_l_employe', 'if v_shift.statut = ''valide'' then', 'if false then');
