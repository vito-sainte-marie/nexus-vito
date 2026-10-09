-- Accepte un montant nul, négatif ou au-delà du centime. Rougit : CHAMPS.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'v_montant is null or v_montant <= 0 or v_montant <> round(v_montant, 2)', 'v_montant is null');
