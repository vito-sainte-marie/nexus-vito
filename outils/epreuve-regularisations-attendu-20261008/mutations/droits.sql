-- La lecture n'exige plus un manager du site. Rougit : DROITS.
select pg_temp.muter('public.regularisations_tiroirs', 'perform public._ecarts_regul_manager(p_site);', 'null;');
