-- Ne vérifie plus que les factures forment une liste. Rougit : FORMAT.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'if jsonb_typeof(new.factures_differees) <> ''array'' then', 'if false then');
