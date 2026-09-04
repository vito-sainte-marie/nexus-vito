-- Fermer la lecture anonyme de la table `sites` (04/09/2026).
--
-- Constat vérifié par appel réel : un visiteur ANONYME, muni de la seule clé
-- publishable présente dans ce dépôt public, obtenait les lignes de `sites`
-- — identifiant technique, raison sociale, forfait, logo, type de commerce.
-- La politique `select_sites` visait le rôle `public`, qui inclut `anon`, et
-- sa condition était `true`.
--
-- C'est le dernier reliquat de l'exposition anonyme découverte le 04/09 :
-- le correctif d'urgence avait fermé les 17 vues SECURITY DEFINER, mais
-- cette table restait ouverte par sa propre politique.
--
-- Vérifié avant écriture : AUCUN écran ne lit `sites` sans authentification.
-- L'écran de connexion ne l'interroge pas, et les huit consommateurs
-- (Cockpit, App, Brief, Rapport, Paramètres Station, Admin Sites, Debug
-- Créateur, nexus-forfait.js) passent tous par nexusRequireAuth().
--
-- Nouvelle règle, au plus juste : un utilisateur authentifié voit SON site ;
-- le créateur voit les sites qui l'ont explicitement autorisé. Un compte
-- authentifié sans ligne `employees` obtient zéro ligne, puisque
-- current_employee_site_id() vaut alors NULL.

revoke select on public.sites from anon;
revoke select on public.sites from public;

drop policy if exists select_sites on public.sites;
create policy select_sites on public.sites for select to authenticated
  using (
    site_id = (select current_employee_site_id())
    or ((select je_suis_createur()) and acces_createur_autorise = true)
  );
