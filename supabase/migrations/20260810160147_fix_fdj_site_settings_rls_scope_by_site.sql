-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810160147 · fix_fdj_site_settings_rls_scope_by_site
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Corrige la politique de lecture posée dans la migration précédente :
-- elle utilisait `using (true)` (tout authentifié voit tous les sites), alors
-- que la convention déjà en place sur fdj_games/fdj_locations restreint
-- chaque lecture au site de l'employé connecté via current_employee_site_id().
-- Incohérent avec le principe multi-site P2 de l'audit ("chaque site son
-- propre profil FDJ, indépendant des autres") de laisser fuiter les seuils
-- d'un site vers un autre.
drop policy if exists "fdj_site_settings_select_authenticated" on public.fdj_site_settings;

create policy "select_fdj_site_settings"
  on public.fdj_site_settings for select
  to public
  using (site = (select current_employee_site_id()));

-- Politique update posée dès maintenant (même si aucun écran ne l'utilise
-- encore) pour suivre la même convention que fdj_games/fdj_locations : un
-- manager du site pourra éditer ses propres réglages une fois l'écran
-- Paramètres FDJ construit, sans nouvelle migration RLS à ce moment-là.
create policy "update_fdj_site_settings"
  on public.fdj_site_settings for update
  to public
  using (site = (select current_employee_site_id()));
