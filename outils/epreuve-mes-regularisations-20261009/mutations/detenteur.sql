-- Oublie de filtrer sur l'appelant. Rougit : FDJ, PERIMETRE, RATTACHEMENT.
select pg_temp.muter('public.mes_regularisations', 'and t.employes ? (moi.uid)::text', 'and true');
