-- Accepte des factures au-delà de la vente boutique. Rougit : PLAFOND.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'if v_total > coalesce(new.vente_boutique, 0) then', 'if false then');
