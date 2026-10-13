-- Plus de plafond versement dans la RPC. Rougit : SUPERIEUR SUPERTRIGGER.
select pg_temp.muter('public.enregistrer_versement_groupe', $a$if v_somme > p_montant then$a$, $a$if false then$a$);
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
