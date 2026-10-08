-- Débranche le plafond du transfert vers le coffre. Rougit : TRANSFERT.
select pg_temp.muter('public.enregistrer_transfert_coffre', 'v_deja + p_montant > v_v.montant', 'false');
