-- Ne demande plus si la facture figure dans la vente. Rougit : CHAMPS.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'if jsonb_typeof(v_ligne->''incluse_dans_ventes'') is distinct from ''boolean'' then', 'if false then');
