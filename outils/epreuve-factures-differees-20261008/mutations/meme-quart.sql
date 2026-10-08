-- Prend la ligne du même quart, que l''upsert va mettre à jour, pour un autre quart. Rougit : AUTEUR MODIFICATION UPSERT.
select pg_temp.muter('public.audits_caisse_factures_differees_controle', '(a.date, a.quart) is distinct from (new.date, new.quart)', 'true');
