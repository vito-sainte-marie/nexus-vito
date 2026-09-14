-- Accès RLS du rôle CI de recette, borné au seul site de recette.
--
-- CE QUI MANQUAIT N'ÉTAIT PAS UN DROIT. Le rôle `nexus_ci_recette` porte déjà
-- exactement ce dont le semis a besoin : INSERT, SELECT, UPDATE sur ces deux
-- tables, rien d'autre — pas de DELETE, pas de BYPASSRLS, pas de superuser.
-- Mais toutes les politiques de ces tables ne visent que le rôle
-- `authenticated`, dont il n'est pas membre. Aucune politique ne le concernant,
-- RLS refusait chaque ligne : `new row violates row-level security policy`.
--
-- Le semis n'avait donc JAMAIS pu écrire. Personne ne pouvait s'en apercevoir :
-- jusqu'au 08/09/2026 il n'avait jamais réussi à se connecter, l'hôte direct de
-- Supabase ne publiant plus qu'une adresse IPv6 absente des runners GitHub.
--
-- LA BORNE EST LE SITE. Ces politiques ne donnent accès à aucune autre station.
-- L'alternative large — `alter role nexus_ci_recette bypassrls` — est
-- délibérément écartée : elle aurait ouvert toutes les tables et tous les sites
-- pour un besoin qui tient en deux tables et un site. Elle aurait aussi défait
-- le moindre privilège avec lequel ce rôle a été créé.
--
-- Autorisée par Frédéric Bragance le 08/09/2026 (gate humain : nouvelle
-- capacité d'écriture). TEST UNIQUEMENT — ce rôle n'existe pas en Production.
--
-- Les deux moitiés de la preuve sont exercées en CI par l'étape de semis :
-- l'écriture sur le site de recette doit RÉUSSIR, et la même écriture sur un
-- autre site doit ÉCHOUER. Une politique dont on ne vérifie que la moitié
-- rassurante ne prouve pas qu'elle borne quoi que ce soit.
drop policy if exists recette_ci_site_test on public.audits_caisse;
create policy recette_ci_site_test on public.audits_caisse
  for all to nexus_ci_recette
  using (site = 'nexus-station-test')
  with check (site = 'nexus-station-test');

drop policy if exists recette_ci_site_test on public.carburant_releves;
create policy recette_ci_site_test on public.carburant_releves
  for all to nexus_ci_recette
  using (site = 'nexus-station-test')
  with check (site = 'nexus-station-test');
