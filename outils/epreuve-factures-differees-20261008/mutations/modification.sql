-- Ne trace plus qui modifie une ligne. Rougit : MODIFICATION.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'else jsonb_build_object(''modifie_par'', v_acteur, ''modifie_le'', now())', 'else ''{}''::jsonb');
