-- Croit la valeur envoyée par l'écran. Rougit : ECRAN.
select pg_temp.muter('public.audits_caisse_revalidation_controle', 'new.revalidation_requise_piste_le := old.revalidation_requise_piste_le;', 'null;');
