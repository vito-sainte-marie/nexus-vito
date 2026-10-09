-- Rend un écart avant son contrôle. Rougit : CONTROLE, PERIMETRE.
select pg_temp.muter('public.mes_regularisations', 'and t.valide_le is not null', 'and true');
