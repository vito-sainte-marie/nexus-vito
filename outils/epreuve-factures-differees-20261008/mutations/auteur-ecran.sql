-- Croit l''auteur envoyé par l''écran. Rougit : SAISIE.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', '''auteur_id'', v_acteur, ''saisie_le'', now()));', '''auteur_id'', coalesce(v_ligne->''auteur_id'', to_jsonb(v_acteur)), ''saisie_le'', now()));');
