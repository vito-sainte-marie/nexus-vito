-- Tient tout contrôle FDJ pour validé, comme P2 avec resultat_controle. Rougit : NONVALIDE.
select pg_temp.muter('public._ecarts_regul_origine', 'cloture := v_f.valide_le is not null and v_f.valide_par is not null', 'cloture := true');
