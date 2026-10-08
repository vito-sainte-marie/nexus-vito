-- Retire le refus d'un écart soldé. Rougit : MULTIPLE.
select pg_temp.muter('public.enregistrer_versement_regularisation', 'if v_s.reste_du = 0 then', 'if false then');
