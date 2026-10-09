-- La validation FDJ n'est plus contrôlée. Rougit : FDJVALIDATION.
select pg_temp.muter('public.fdj_cash_controls_regularisations_controle', 'if round(v_net, 2) <> round(old.versements_regularisation, 2) then', 'if false then');
