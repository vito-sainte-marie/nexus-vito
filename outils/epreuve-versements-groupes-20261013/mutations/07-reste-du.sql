-- Plus de plafond au reste dû dans la validation. Rougit : PLAFONDR.
select pg_temp.muter('public._groupe_valider_affectations', $a$if a.montant > s.reste_du then$a$, $a$if false then$a$);
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
