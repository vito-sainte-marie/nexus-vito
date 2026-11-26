-- Preuve étape 5 (Test) : exécuter chaque bloc dans un appel séparé. Comptes fictifs uniquement.
-- 1) rétention et purge planifiée : attendu 180 ; job nexus-connexion-purge présent
select retention_journal_j from nexus_connexion.parametres where id = 1;
select jobname, schedule from cron.job where jobname = 'nexus-connexion-purge';
-- 2) purge : une ligne de 181 jours disparaît, une de 179 jours reste
insert into nexus_connexion.journal (evenement, at) values ('recette_etape5', now() - interval '181 days'), ('recette_etape5', now() - interval '179 days');
select nexus_connexion.purger();
select count(*) from nexus_connexion.journal where evenement = 'recette_etape5'; -- attendu 1
delete from nexus_connexion.journal where evenement = 'recette_etape5';
-- 3) alerte : gérant → verifier_service ; manager → prevenir_gerant ; pompiste → refus journalisé
-- (remplacer par les ids des comptes fictifs Test : gérant, manager, pompiste)
-- select nexus_connexion.alerte_indisponible_pour('<id>');
