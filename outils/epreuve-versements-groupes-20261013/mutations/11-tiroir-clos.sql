-- Un tiroir validé reçoit encore. Rougit : CLOTUREG.
select pg_temp.muter('public.enregistrer_versement_groupe', $a$public._ecarts_regul_tiroir_clos(v_site, p_destination, p_recepteur_date, p_recepteur_quart)$a$, $a$false$a$);
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
