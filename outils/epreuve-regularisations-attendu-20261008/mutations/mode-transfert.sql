-- Un transfert sans versement ni groupe est compté en espèces. Rougit : DETAIL.
-- (Ancre adaptée à 20261013140000, qui lit aussi le mode du groupe : coalesce(v, g, 'sans_mode').)
select pg_temp.muter('public._regul_tiroir_detail', 'coalesce(v.mode_encaissement, g.mode_encaissement, ''sans_mode'')', '''especes''');
