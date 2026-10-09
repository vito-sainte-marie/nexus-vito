-- Rend l'UUID du manager qui a saisi. Rougit : FUITE, VERSEMENT.
select pg_temp.muter('public.mes_regularisations', '''auteur_id'', case when v.auteur_id is not null then ''manager'' end', '''auteur_id'', v.auteur_id');
