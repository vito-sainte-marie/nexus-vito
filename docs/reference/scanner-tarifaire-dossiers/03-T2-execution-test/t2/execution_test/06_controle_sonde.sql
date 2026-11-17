-- Contrôle de la sonde, LECTURE SEULE. Attendu : {"table_sonde": false, "sonde_enregistree": 0}.
select json_build_object(
  'table_sonde', to_regclass('public.tarif_sonde_atomicite') is not null,
  'sonde_enregistree', (select count(*) from supabase_migrations.schema_migrations where name = 'tarif_sonde_arret_sur_erreur')
) as sonde;
