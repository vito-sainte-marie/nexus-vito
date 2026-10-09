-- Compare sans arrondir au centime. Rougit : SANSCHANGEMENT.
select pg_temp.muter('public.audits_caisse_revalidation_controle', 'round(new.ecart_piste, 2) is distinct from round(old.ecart_piste, 2)', 'new.ecart_piste is distinct from old.ecart_piste');
