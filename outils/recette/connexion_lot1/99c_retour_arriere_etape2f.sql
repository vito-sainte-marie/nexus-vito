-- Retour arrière de l'étape 2f (atomicité Auth/base, injection de pannes). Test uniquement.
drop function if exists nexus_connexion.panne_pour(uuid, text);
drop table if exists nexus_connexion.panne_injectee;
drop function if exists nexus_connexion.comptes_incoherents();
drop function if exists nexus_connexion.journaliser_incoherence(uuid, text, text);
