-- Le surplus s'impute sans limite. Rougit : IMPUTATION.
select pg_temp.muter('public.affecter_surplus_groupe', $a$if v_deja + v_somme > g.montant then$a$, $a$if false then$a$);
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
