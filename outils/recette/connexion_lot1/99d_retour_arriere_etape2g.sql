-- Retour arrière de l'étape 2g (Test uniquement).
drop function if exists nexus_connexion.budget_auth();
alter table nexus_connexion.parametres drop column if exists budget_auth_min;
delete from nexus_connexion.journal where evenement in ('appel_auth','budget_auth');
