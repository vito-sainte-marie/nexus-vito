-- Inventaire du schéma public, catalogue seulement (aucune donnée lue).
-- La MÊME requête tourne sur la base jetable et, en lecture seule, sur Test :
-- la comparaison porte sur des listes, pas sur des impressions.
select json_build_object(
  'tables', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('r','p')),
  'tables_rls', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                 where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity),
  'vues', (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('v','m')),
  'politiques', (select count(*) from pg_policies where schemaname = 'public'),
  'fonctions', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'),
  'fonctions_security_definer', (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                 where n.nspname = 'public' and p.prosecdef),
  'declencheurs', (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid
                   join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not t.tgisinternal),
  'liste_tables', (select json_agg(c.relname order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where n.nspname = 'public' and c.relkind in ('r','p')),
  'liste_politiques', (select json_agg(tablename || '.' || policyname || ':' || cmd order by tablename, policyname)
                       from pg_policies where schemaname = 'public'),
  'liste_fonctions', (select json_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
                                      || case when p.prosecdef then ' DEFINER' else '' end
                                      order by p.proname, pg_get_function_identity_arguments(p.oid))
                      from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public')
) as inventaire;
