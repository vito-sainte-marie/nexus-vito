-- RETOUR ARRIÈRE de 20260904140000_fermer_lecture_anonyme_sites.sql
--
-- Restaure l'état antérieur au 04/09/2026 : politique ouverte sur le rôle
-- `public` avec la condition `true`, et SELECT rendu à `anon`.
--
-- AVERTISSEMENT — exécuter ce fichier ROUVRE la lecture anonyme de `sites` :
-- identifiants techniques, raison sociale, forfait et logo redeviennent
-- accessibles sans aucun compte. À n'utiliser que si un écran s'avérait
-- cassé, le temps de comprendre lequel — jamais comme état durable.
--
-- Vérification attendue après exécution : un appel anonyme sur
-- /rest/v1/sites redevient HTTP 200 avec des lignes. C'est précisément ce
-- qu'on cherchait à empêcher.

drop policy if exists select_sites on public.sites;
create policy select_sites on public.sites for select to public using (true);
grant select on public.sites to anon;
