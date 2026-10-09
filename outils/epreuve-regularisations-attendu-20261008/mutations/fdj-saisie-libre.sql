-- La colonne FDJ s'écrit à la main. Rougit : FDJVALIDATION.
select pg_temp.muter('public.fdj_cash_controls_regularisations_controle', E'else\n    new.versements_regularisation := old.versements_regularisation;\n  end if;', E'else\n    null;\n  end if;');
