-- Tient tout tiroir pour ouvert. Rougit : RECEPTEUR, TRANSFERT.
select pg_temp.muter('public._ecarts_regul_tiroir_clos', 'select case p_tiroir', 'select false and case p_tiroir');
