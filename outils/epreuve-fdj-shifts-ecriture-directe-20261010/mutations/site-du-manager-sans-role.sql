-- La création de quart ne contrôle plus le rôle. Rougit : MANAGER.
select pg_temp.muter('public.fdj_site_du_manager', 'if v_role not in (''manager'', ''gerant'') then', 'if false then');
