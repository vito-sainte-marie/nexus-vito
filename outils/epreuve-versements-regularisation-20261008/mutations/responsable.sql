-- Débranche l'exigence d'un responsable unique. Rougit : RESPONSABLE.
select pg_temp.muter('public.enregistrer_versement_regularisation', 'v_o.nb_responsables <> 1 or v_o.employee_id is null', 'false');
