-- N'importe quel quart du site devient un précédent. Rougit : LIEN.
select pg_temp.muter('public.fdj_lier_quart_precedent',
  E'if v_prec.statut <> \'valide\'\n     or (v_prec.date, v_prec.quart) >= (v_shift.date, v_shift.quart) then',
  'if false then');
