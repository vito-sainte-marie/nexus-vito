-- Un écart réécrit n'est plus contrôlé. Rougit : VALIDATION.
select pg_temp.muter('public.audits_caisse_regularisations_controle', 'or round(new.ecart_piste, 2) is distinct from round(old.ecart_piste, 2)', '');
