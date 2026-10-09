-- Un versement annulé reste dans l'attendu. Rougit : ANNULATION.
select pg_temp.muter('public._regul_tiroir_detail', 'and v.annule_le is null', 'and true');
