-- Retour arrière de l'étape 2 (état privé). Ne touche ni l'alias, ni la RPC anonyme, ni les e-mails Auth (étape 1).
drop function if exists nexus_connexion.reinitialiser_code(uuid, text, int, uuid);
drop function if exists nexus_connexion.auteur_autorise(uuid, uuid);
drop function if exists nexus_connexion.purger();
drop function if exists nexus_connexion.lever_verrou(uuid, uuid);
drop function if exists nexus_connexion.poser_code(uuid, text, text, int);
drop function if exists nexus_connexion.apres_succes(uuid, text);
drop function if exists nexus_connexion.apres_echec(uuid, text);
drop function if exists nexus_connexion.avant_essai(text, text);
drop function if exists nexus_connexion.resoudre(text);
drop function if exists nexus_connexion.attente_pour(int, int, int[]);
drop table if exists nexus_connexion.alerte, nexus_connexion.essais_ip, nexus_connexion.journal, nexus_connexion.compte, nexus_connexion.parametres;
