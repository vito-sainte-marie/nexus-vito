-- Contrôle entre deux migrations, projet Supabase Test. LECTURE SEULE : une seule requête SELECT.
-- Comparer le résultat à la ligne attendue de la procédure ; au moindre écart, arrêt et preuve 30.
select json_build_object(
  'horodatage', now(),
  'derniere_migration', (select version || ' ' || name from supabase_migrations.schema_migrations order by version desc limit 1),
  'tables_tarif', (select count(*) from pg_tables where schemaname = 'public' and tablename like 'tarif\_%'),
  'fonctions_tarif', (select count(*) from pg_proc where proname like 'tarif\_%'),
  'declencheurs_tarif', (select count(*) from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'tarif\_%'),
  'politiques_tarif', (select count(*) from pg_policies where tablename like 'tarif\_%'),
  'vues_tarif', (select count(*) from pg_views where viewname like 'v\_tarif\_%'),
  'rls_forcee', (select count(*) from pg_class where relname like 'tarif\_%' and relkind = 'r' and relforcerowsecurity)
) as etat;
