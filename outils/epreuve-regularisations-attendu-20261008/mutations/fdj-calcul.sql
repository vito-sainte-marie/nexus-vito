-- L'attendu FDJ ignore les versements. Rougit : FDJ, FDJVALIDATION.
select pg_temp.muter('public.fdj_calculer_caisse', 'v_grattage + v_tirages + v_regul + v_versements', 'v_grattage + v_tirages + v_regul');
