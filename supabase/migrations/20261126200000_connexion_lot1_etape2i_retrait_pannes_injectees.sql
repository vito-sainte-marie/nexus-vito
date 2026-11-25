-- Connexion lot 1, étape 2i : retrait de l'injection de pannes (outil de recette Test).
-- La table panne_injectee et la fonction panne_pour (créées par l'étape 2f) ne doivent pas survivre en Production.
-- Cette migration les retire. Sans effet sur les autres objets de nexus_connexion.
drop function if exists nexus_connexion.panne_pour(uuid, text);
drop table if exists nexus_connexion.panne_injectee;
