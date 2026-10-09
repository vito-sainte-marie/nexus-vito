-- Débranche le plafond du versement. Rougit : PLAFOND.
select pg_temp.muter('public.enregistrer_versement_regularisation', 'p_montant > v_s.reste_du', 'false');
