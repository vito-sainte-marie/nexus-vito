-- Laisse passer l'écriture sur une caisse à valider de nouveau. Rougit : RESTITUTION VERSEMENT.
select pg_temp.muter('public._ecarts_regul_origine', 'if p_verrouiller and v_a.revalidation_requise_piste_le is not null then', 'if false then');
