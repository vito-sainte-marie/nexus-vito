-- Une affectation s'annule seule. Rougit : GROUPEACTIF.
select pg_temp.muter('public._evr_groupe_annulation', $a$coalesce(current_setting('nexus.annulation_groupe', true), '') <> 'on'$a$, $a$false$a$);
select pg_temp.qui('a0000000-0000-0000-0000-000000000001');
