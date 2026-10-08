-- Retire la chronologie des restitutions. Rougit : TIERS.
select pg_temp.muter('public.enregistrer_restitution_trop_percu', 'if (p_source_date, p_source_quart) < (v_o.date_ecart, v_o.quart_ecart) then', 'if false then');
