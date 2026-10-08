-- Réattribue une ligne existante à qui réenregistre. Rougit : AUTEUR MODIFICATION.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', '''auteur_id'', v_ancienne->''auteur_id'', ''saisie_le'', v_ancienne->''saisie_le'')', '''auteur_id'', v_acteur, ''saisie_le'', now())');
