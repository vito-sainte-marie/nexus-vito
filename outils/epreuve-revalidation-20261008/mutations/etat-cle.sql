-- L'état ne distingue plus « à valider de nouveau ». Rougit : ETAT.
select pg_temp.muter('public.ecart_regularisation_etat', 'and case when p_caisse = ''piste''', 'and false and case when p_caisse = ''piste''');
