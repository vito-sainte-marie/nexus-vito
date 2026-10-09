-- Un transfert sans versement est compté en espèces. Rougit : DETAIL.
select pg_temp.muter('public._regul_tiroir_detail', 'coalesce(v.mode_encaissement, ''sans_mode'')', '''especes''');
