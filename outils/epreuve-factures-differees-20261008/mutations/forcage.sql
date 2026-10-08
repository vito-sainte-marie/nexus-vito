-- Laisse passer une somme forcée quand les lignes ne changent pas. Rougit : FORCAGE.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', 'and new.factures_differees_boutique is not distinct from old.factures_differees_boutique then', 'then');
