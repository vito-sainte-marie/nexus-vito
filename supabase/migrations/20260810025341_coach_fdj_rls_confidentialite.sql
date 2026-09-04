-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260810025341 · coach_fdj_rls_confidentialite
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Coach x FDJ Pilotage — étape "écran employé" (09/08/2026). Audit §21 :
-- "Un employé ne voit que son propre conseil. Le manager voit les
-- conseils de son équipe selon permissions." La RLS initiale (migration
-- coach_fdj_schema_v1) ne scopait que par site, comme la plupart des
-- tables fdj_* — insuffisant ici : un conseil personnalisé est plus
-- sensible qu'un simple mouvement de stock (il porte sur la performance
-- d'une personne). employees.id = auth.uid() dans ce projet (voir
-- current_employee_site_id()), donc employee_id = auth.uid() suffit à
-- identifier "son propre conseil" sans nouvelle fonction.
drop policy select_coach_daily_recommendations on public.coach_daily_recommendations;
create policy select_coach_daily_recommendations on public.coach_daily_recommendations for select
  using (
    site = (select current_employee_site_id())
    and (employee_id = auth.uid() or current_employee_role() in ('manager', 'gerant'))
  );

drop policy insert_coach_daily_recommendations on public.coach_daily_recommendations;
create policy insert_coach_daily_recommendations on public.coach_daily_recommendations for insert
  with check (
    site = (select current_employee_site_id())
    and (employee_id = auth.uid() or current_employee_role() in ('manager', 'gerant'))
  );

-- coach_recommendation_events : même principe, scopé par l'acteur de
-- l'événement (celui qui consulte/applique SON propre conseil) plutôt que
-- par la recommandation elle-même (éviterait une sous-requête coûteuse et
-- reste cohérent : actor_id est toujours l'employé qui interagit).
drop policy select_coach_recommendation_events on public.coach_recommendation_events;
create policy select_coach_recommendation_events on public.coach_recommendation_events for select
  using (
    site = (select current_employee_site_id())
    and (actor_id = auth.uid() or current_employee_role() in ('manager', 'gerant'))
  );

drop policy insert_coach_recommendation_events on public.coach_recommendation_events;
create policy insert_coach_recommendation_events on public.coach_recommendation_events for insert
  with check (
    site = (select current_employee_site_id())
    and actor_id = auth.uid()
  );
