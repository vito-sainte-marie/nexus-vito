-- L'état annonce encore une clôture. Rougit : ETAT.
select pg_temp.muter('public._ecarts_regul_origine', 'cloture := v_a.valide_le_piste is not null and v_a.revalidation_requise_piste_le is null;', 'cloture := v_a.valide_le_piste is not null;');
