-- Les transferts vers le coffre ne sortent plus du tiroir. Rougit : DETAIL.
-- (Ancre adaptée à 20261013140000, qui lit aussi le mode du groupe.)
select pg_temp.muter('public._regul_tiroir_detail', 'select coalesce(v.mode_encaissement, g.mode_encaissement, ''sans_mode''), 0, t.montant', 'select coalesce(v.mode_encaissement, g.mode_encaissement, ''sans_mode''), 0, 0 * t.montant');
