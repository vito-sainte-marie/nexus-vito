-- Débranche le plafond de la restitution. Rougit : TROPPERCU.
select pg_temp.muter('public.enregistrer_restitution_trop_percu', 'p_montant > v_s.trop_percu', 'false');
