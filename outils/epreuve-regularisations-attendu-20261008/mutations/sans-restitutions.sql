-- Les restitutions ne sortent plus du tiroir. Rougit : DETAIL.
select pg_temp.muter('public._regul_tiroir_detail', 'select r.mode_restitution, 0, r.montant', 'select r.mode_restitution, 0, 0 * r.montant');
