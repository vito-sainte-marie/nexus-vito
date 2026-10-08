-- Débranche le contrôle de site des RPC. Rougit : SITES.
select pg_temp.muter('public._ecarts_regul_manager', 'p_site is null or v_site is distinct from p_site', 'false');
