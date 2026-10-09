-- Les transferts vers le coffre ne sortent plus du tiroir. Rougit : DETAIL.
select pg_temp.muter('public._regul_tiroir_detail', 'select coalesce(v.mode_encaissement, ''sans_mode''), 0, t.montant', 'select coalesce(v.mode_encaissement, ''sans_mode''), 0, 0 * t.montant');
