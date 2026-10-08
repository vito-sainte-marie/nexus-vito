-- Compte une facture non confirmée. Rougit : AVERIFIER PLAFOND.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'if v_incluse then', 'if true then');
