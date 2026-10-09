-- Le versement d'une station entre dans le tiroir d'une autre. Rougit : ISOLATION.
select pg_temp.muter('public._regul_tiroir_detail', 'where v.site = p_site and v.destination', 'where v.destination');
