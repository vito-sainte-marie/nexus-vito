-- Un audit neuf n'est plus contrôlé. Rougit : UPSERT.
select pg_temp.muter('public.audits_caisse_regularisations_controle', 'v_doit := true;', 'v_doit := false;');
