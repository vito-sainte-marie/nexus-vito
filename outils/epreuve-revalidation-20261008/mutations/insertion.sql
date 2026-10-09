-- Croit les drapeaux envoyés à l'insertion. Rougit : ECRAN.
select pg_temp.muter('public.audits_caisse_revalidation_controle', $a$  if tg_op = 'INSERT' then
    new.revalidation_requise_piste_le := null;$a$, $a$  if tg_op = 'INSERT' then$a$);
