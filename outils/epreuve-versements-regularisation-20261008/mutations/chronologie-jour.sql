-- Compare les jours sans les quarts, comme P2. Rougit : CHRONOLOGIE.
select pg_temp.muter('public.enregistrer_versement_regularisation', 'if (p_recepteur_date, p_recepteur_quart) < (v_o.date_ecart, v_o.quart_ecart)', 'if p_recepteur_date < v_o.date_ecart');
