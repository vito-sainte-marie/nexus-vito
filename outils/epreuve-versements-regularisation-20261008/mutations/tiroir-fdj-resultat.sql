-- Tient pour clos un tiroir FDJ « à revoir » (resultat_controle au lieu de valide_le). Rougit : NONVALIDE.
select pg_temp.muter('public._ecarts_regul_tiroir_clos', 'and c.valide_le is not null)', 'and c.resultat_controle is not null)');
