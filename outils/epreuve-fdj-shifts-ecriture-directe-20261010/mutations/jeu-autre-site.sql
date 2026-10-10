-- Un jeu de n'importe quel site est accepté. Rougit : APPRO, MANAGER, OUVERTURE.
select pg_temp.muter('public.fdj_exiger_jeu_du_site', ' and g.site = p_site', '');
