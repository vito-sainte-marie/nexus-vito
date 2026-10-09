-- Rend les quarts FDJ de tout le monde. Rougit : FDJ, RATTACHEMENT.
select pg_temp.muter('public.mes_regularisations', 'and s.employee_id = moi.uid', 'and true');
