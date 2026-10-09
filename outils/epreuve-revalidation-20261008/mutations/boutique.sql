-- La boutique suit le drapeau de la piste. Rougit : INDEPENDANCE.
select pg_temp.muter('public.audits_caisse_revalidation_controle', 'new.revalidation_requise_boutique_le := now();', 'null;');
