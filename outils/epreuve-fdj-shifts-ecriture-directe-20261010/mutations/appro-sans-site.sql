-- L'appro ne compare plus le site reçu à celui du quart. Rougit : APPRO.
select pg_temp.muter('public.fdj_incrementer_appro_shift_count', 'if p_site is distinct from v_shift.site then', 'if false then');
