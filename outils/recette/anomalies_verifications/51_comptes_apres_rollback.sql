-- A10, apres le rollback de 50_assertions_cycle_verification.sql : lecture seule, aucune ecriture.
-- Comparer ces comptes a « comptes_avant » du rapport JSON de 50 : ils doivent etre identiques. Aucune identite ni lot de recette ne doit rester.
select (select count(*) from tarif_anomalies_verifications) as verifications,
       (select count(*) from tarif_anomalies_reevaluations) as reevaluations,
       (select count(*) from import_batches) as import_batches,
       (select count(*) from employees where id::text like '00000000-0000-4000-8000-0000000e01%') as identites_de_recette_restantes,
       (select count(*) from import_batches where id::text like '00000000-0000-4000-8000-00000000f1%') as lots_de_recette_restants;
