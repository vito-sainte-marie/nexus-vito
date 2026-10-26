-- NEXUS — employé de recette AUTOMATISÉE, nexus-test UNIQUEMENT.
--
-- Decision-2 d'OUTILLAGE-REGULARISATION-20261026, proposition A, étape 1.
-- La recette automatisée partage aujourd'hui « Employé Test A » avec des
-- parcours humains ; l'incident du 11/09/2026 (service clôturé avant sa
-- création) est né de ce partage. Cette ligne donne à l'automate SON identité.
--
-- CE QUE CE FICHIER FAIT : une ligne `employees`, rien d'autre.
-- CE QU'IL NE FAIT PAS, et la décision l'interdit :
--   · aucun secret : ni PIN, ni mot de passe, ni jeton ;
--   · aucun compte Auth : `auth.users` n'est ni lu ni écrit. Un compte ne sera
--     demandé que le jour où une épreuve prouvera qu'il est indispensable
--     (la connexion par nom + PIN du scénario navigateur, étape 2) ;
--   · aucune suppression : « Employé Test A » reste en place jusqu'à trois
--     exécutions vertes consécutives du nouveau scénario, et jusqu'à l'épreuve
--     d'isolation et sa mutation ;
--   · aucune donnée métier : ni pointage, ni quart, ni relevé.
--
-- TEST UNIQUEMENT. Le garde-fou ci-dessous refuse de s'exécuter si le site de
-- recette n'existe pas : c'est ce qui arrête un lancement par erreur sur une
-- base qui n'est pas nexus-test. Il ne remplace pas de vérifier la cible
-- avant de lancer ; il rend l'erreur bruyante.
--
-- Versionné et idempotent : l'identifiant est une constante du dépôt, pas un
-- tirage ; `on conflict (id) do update` rend le rejeu sans effet de bord.
\set ON_ERROR_STOP on

do $garde$
begin
  if not exists (select 1 from public.sites where site_id = 'nexus-station-test') then
    raise exception 'semer-employe-automate-test : site nexus-station-test absent, cette base n''est pas nexus-test';
  end if;
end
$garde$;

insert into public.employees (id, username, nom, role, site_id, compte_test, est_createur, actif)
values ('00000000-0000-4000-8000-0000a070ca7e', 'employe-test-auto', 'Employé Test Auto',
        'caissier', 'nexus-station-test', true, false, true)
on conflict (id) do update
  set username = excluded.username,
      nom = excluded.nom,
      role = excluded.role,
      site_id = excluded.site_id,
      compte_test = excluded.compte_test,
      est_createur = excluded.est_createur,
      actif = excluded.actif;
