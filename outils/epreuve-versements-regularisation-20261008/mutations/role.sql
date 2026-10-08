-- Débranche la réserve aux managers et gérants. Rougit : ROLES.
select pg_temp.muter('public._ecarts_regul_manager', $m$v_role not in ('manager', 'gerant')$m$, 'false');
