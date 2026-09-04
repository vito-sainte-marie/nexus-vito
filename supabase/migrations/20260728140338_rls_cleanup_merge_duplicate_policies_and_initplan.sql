-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260728140338 · rls_cleanup_merge_duplicate_policies_and_initplan
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- advisor_feedback
drop policy if exists inserer_advisor_feedback on public.advisor_feedback;
drop policy if exists select_advisor_feedback on public.advisor_feedback;
create policy select_advisor_feedback on public.advisor_feedback for select to authenticated
  using (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));
create policy inserer_advisor_feedback on public.advisor_feedback for insert to authenticated
  with check (site_id in (select e.site_id from employees e where e.id = (select auth.uid())) and manager_id = (select auth.uid()));
-- advisor_message_evidence
drop policy if exists inserer_advisor_evidence on public.advisor_message_evidence;
drop policy if exists select_advisor_evidence on public.advisor_message_evidence;
create policy select_advisor_evidence on public.advisor_message_evidence for select to authenticated
  using (exists (select 1 from advisor_messages m join employees e on e.site_id = m.site_id where m.id = advisor_message_evidence.advisor_message_id and e.id = (select auth.uid())));
create policy inserer_advisor_evidence on public.advisor_message_evidence for insert to authenticated
  with check (exists (select 1 from advisor_messages m join employees e on e.site_id = m.site_id where m.id = advisor_message_evidence.advisor_message_id and e.id = (select auth.uid())));
-- advisor_messages
drop policy if exists inserer_advisor_messages on public.advisor_messages;
drop policy if exists select_advisor_messages on public.advisor_messages;
drop policy if exists modifier_advisor_messages on public.advisor_messages;
create policy select_advisor_messages on public.advisor_messages for select to authenticated
  using (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));
create policy inserer_advisor_messages on public.advisor_messages for insert to authenticated
  with check (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));
create policy modifier_advisor_messages on public.advisor_messages for update to authenticated
  using (site_id in (select e.site_id from employees e where e.id = (select auth.uid())))
  with check (site_id in (select e.site_id from employees e where e.id = (select auth.uid())));
-- advisor_rules
drop policy if exists modifier_advisor_rules_manager on public.advisor_rules;
drop policy if exists select_advisor_rules on public.advisor_rules;
create policy select_advisor_rules on public.advisor_rules for select to authenticated
  using (
    site_id is null
    or site_id in (select e.site_id from employees e where e.id = (select auth.uid()))
    or exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant']))
  );
create policy manager_insert_advisor_rules on public.advisor_rules for insert to authenticated
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])));
create policy manager_update_advisor_rules on public.advisor_rules for update to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])))
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])));
create policy manager_delete_advisor_rules on public.advisor_rules for delete to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])));
-- apprentissage_snapshots
drop policy if exists createur_lit_si_autorise on public.apprentissage_snapshots;
drop policy if exists employee_own_snapshot_select on public.apprentissage_snapshots;
drop policy if exists manager_sees_all_snapshots on public.apprentissage_snapshots;
drop policy if exists employee_own_snapshot_upsert on public.apprentissage_snapshots;
drop policy if exists employee_own_snapshot_update on public.apprentissage_snapshots;
create policy select_apprentissage_snapshots on public.apprentissage_snapshots for select to public
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = apprentissage_snapshots.site_id and s.acces_createur_autorise = true))
  );
create policy employee_own_snapshot_upsert on public.apprentissage_snapshots for insert to public
  with check (employee_id = (select auth.uid()));
create policy employee_own_snapshot_update on public.apprentissage_snapshots for update to public
  using (employee_id = (select auth.uid()));
-- audits_caisse
drop policy if exists createur_lit_si_autorise on public.audits_caisse;
drop policy if exists lecture_audits_caisse_meme_site on public.audits_caisse;
drop policy if exists lecture_manager_meme_site on public.audits_caisse;
drop policy if exists ecriture_manager_meme_site on public.audits_caisse;
drop policy if exists modification_manager_meme_site on public.audits_caisse;
create policy select_audits_caisse on public.audits_caisse for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = audits_caisse.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.audits_caisse for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.audits_caisse for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- caisse_sante_historique
drop policy if exists createur_lit_si_autorise on public.caisse_sante_historique;
drop policy if exists lecture_meme_site on public.caisse_sante_historique;
drop policy if exists ecriture_manager_meme_site on public.caisse_sante_historique;
drop policy if exists modification_manager_meme_site on public.caisse_sante_historique;
create policy select_caisse_sante_historique on public.caisse_sante_historique for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = caisse_sante_historique.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.caisse_sante_historique for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.caisse_sante_historique for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- campagnes_nexus
drop policy if exists createur_lit_si_autorise on public.campagnes_nexus;
drop policy if exists lecture_meme_site on public.campagnes_nexus;
drop policy if exists ecriture_manager_meme_site on public.campagnes_nexus;
create policy select_campagnes_nexus on public.campagnes_nexus for select to public
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = campagnes_nexus.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.campagnes_nexus for insert to public
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- campagnes_nexus_imports
drop policy if exists createur_lit_si_autorise on public.campagnes_nexus_imports;
drop policy if exists lecture_meme_site on public.campagnes_nexus_imports;
drop policy if exists ecriture_manager_meme_site on public.campagnes_nexus_imports;
drop policy if exists suppression_manager_meme_site on public.campagnes_nexus_imports;
create policy select_campagnes_nexus_imports on public.campagnes_nexus_imports for select to public
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = campagnes_nexus_imports.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.campagnes_nexus_imports for insert to public
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.campagnes_nexus_imports for delete to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- controles_stock
drop policy if exists authenticated_reads_controles_stock on public.controles_stock;
drop policy if exists createur_lit_si_autorise on public.controles_stock;
drop policy if exists authenticated_inserts_controles_stock on public.controles_stock;
create policy select_controles_stock on public.controles_stock for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = controles_stock.site and s.acces_createur_autorise = true))
  );
create policy authenticated_inserts_controles_stock on public.controles_stock for insert to authenticated
  with check (site = (select current_employee_site_id()));
-- controles_tenue
drop policy if exists createur_lit_si_autorise on public.controles_tenue;
drop policy if exists lecture_meme_site on public.controles_tenue;
drop policy if exists ecriture_manager_meme_site on public.controles_tenue;
create policy select_controles_tenue on public.controles_tenue for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = controles_tenue.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.controles_tenue for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- employee_contraintes
drop policy if exists lecture_meme_site on public.employee_contraintes;
drop policy if exists ecriture_manager_meme_site on public.employee_contraintes;
drop policy if exists modification_manager_meme_site on public.employee_contraintes;
create policy lecture_meme_site on public.employee_contraintes for select to authenticated
  using (site_id = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.employee_contraintes for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.employee_contraintes for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- employee_indisponibilites
drop policy if exists lecture_meme_site on public.employee_indisponibilites;
drop policy if exists ecriture_manager_meme_site on public.employee_indisponibilites;
drop policy if exists modification_manager_meme_site on public.employee_indisponibilites;
drop policy if exists suppression_manager_meme_site on public.employee_indisponibilites;
create policy lecture_meme_site on public.employee_indisponibilites for select to authenticated
  using (site_id = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.employee_indisponibilites for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.employee_indisponibilites for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.employee_indisponibilites for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- employees
drop policy if exists createur_lit_si_autorise on public.employees;
drop policy if exists employee_sees_own_row on public.employees;
drop policy if exists manager_sees_all on public.employees;
create policy select_employees on public.employees for select to public
  using (
    id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = employees.site_id and s.acces_createur_autorise = true))
  );
-- evaluations_employes
drop policy if exists createur_lit_si_autorise on public.evaluations_employes;
drop policy if exists lecture_meme_site on public.evaluations_employes;
drop policy if exists ecriture_manager_meme_site on public.evaluations_employes;
create policy select_evaluations_employes on public.evaluations_employes for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = evaluations_employes.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.evaluations_employes for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- journal_decisions
drop policy if exists createur_lit_si_autorise on public.journal_decisions;
drop policy if exists lecture_meme_site on public.journal_decisions;
drop policy if exists ecriture_manager_meme_site on public.journal_decisions;
create policy select_journal_decisions on public.journal_decisions for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = journal_decisions.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.journal_decisions for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- marge_exceptions
drop policy if exists lecture_meme_site on public.marge_exceptions;
drop policy if exists ecriture_manager_meme_site on public.marge_exceptions;
drop policy if exists suppression_manager_meme_site on public.marge_exceptions;
create policy lecture_meme_site on public.marge_exceptions for select to authenticated
  using (site = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.marge_exceptions for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.marge_exceptions for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- mission_assignments
drop policy if exists manager_manages_all_assignments on public.mission_assignments;
drop policy if exists createur_lit_si_autorise on public.mission_assignments;
drop policy if exists employee_sees_own_assignments on public.mission_assignments;
drop policy if exists employee_updates_own_assignment_status on public.mission_assignments;
create policy select_mission_assignments on public.mission_assignments for select to public
  using (
    ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or (assigned_to_employee_id = (select auth.uid()))
    or (assigned_to_role in (select shifts.role from shifts where shifts.employee_id = (select auth.uid()) and shifts.statut = 'en_cours'))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = mission_assignments.site_id and s.acces_createur_autorise = true))
  );
create policy manager_insert_mission_assignments on public.mission_assignments for insert to public
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy update_mission_assignments on public.mission_assignments for update to public
  using (
    ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or (assigned_to_employee_id = (select auth.uid()))
  )
  with check (
    ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or (assigned_to_employee_id = (select auth.uid()))
  );
create policy manager_delete_mission_assignments on public.mission_assignments for delete to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- mission_catalog
drop policy if exists manager_edits_catalog on public.mission_catalog;
drop policy if exists authenticated_reads_catalog on public.mission_catalog;
drop policy if exists createur_lit_si_autorise on public.mission_catalog;
create policy select_mission_catalog on public.mission_catalog for select to public
  using (
    site_id = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = mission_catalog.site_id and s.acces_createur_autorise = true))
  );
create policy manager_insert_mission_catalog on public.mission_catalog for insert to public
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy manager_update_mission_catalog on public.mission_catalog for update to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy manager_delete_mission_catalog on public.mission_catalog for delete to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- mission_completions
drop policy if exists createur_lit_si_autorise on public.mission_completions;
drop policy if exists employee_own_completions_select on public.mission_completions;
drop policy if exists manager_sees_all_completions on public.mission_completions;
drop policy if exists employee_own_completions_insert on public.mission_completions;
drop policy if exists manager_ajuste_points on public.mission_completions;
create policy select_mission_completions on public.mission_completions for select to public
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = mission_completions.site_id and s.acces_createur_autorise = true))
  );
create policy employee_own_completions_insert on public.mission_completions for insert to public
  with check (employee_id = (select auth.uid()));
create policy manager_ajuste_points on public.mission_completions for update to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- mission_progress
drop policy if exists createur_lit_si_autorise on public.mission_progress;
drop policy if exists employee_own_progress_select on public.mission_progress;
drop policy if exists manager_sees_all_progress on public.mission_progress;
drop policy if exists employee_own_progress_upsert on public.mission_progress;
drop policy if exists employee_own_progress_update on public.mission_progress;
create policy select_mission_progress on public.mission_progress for select to public
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = mission_progress.site_id and s.acces_createur_autorise = true))
  );
create policy employee_own_progress_upsert on public.mission_progress for insert to public
  with check (employee_id = (select auth.uid()));
create policy employee_own_progress_update on public.mission_progress for update to public
  using (employee_id = (select auth.uid()));
-- nexus_language_templates
drop policy if exists modifier_nexus_language_templates_manager on public.nexus_language_templates;
create policy manager_insert_nexus_language_templates on public.nexus_language_templates for insert to authenticated
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])));
create policy manager_update_nexus_language_templates on public.nexus_language_templates for update to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])))
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])));
create policy manager_delete_nexus_language_templates on public.nexus_language_templates for delete to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])));
-- panier_moyen_quotidien
drop policy if exists createur_lit_si_autorise on public.panier_moyen_quotidien;
drop policy if exists lecture_meme_site on public.panier_moyen_quotidien;
drop policy if exists ecriture_manager_meme_site on public.panier_moyen_quotidien;
drop policy if exists modification_manager_meme_site on public.panier_moyen_quotidien;
drop policy if exists suppression_manager_meme_site on public.panier_moyen_quotidien;
create policy select_panier_moyen_quotidien on public.panier_moyen_quotidien for select to public
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = panier_moyen_quotidien.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.panier_moyen_quotidien for insert to public
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.panier_moyen_quotidien for update to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.panier_moyen_quotidien for delete to public
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- planning_generations
drop policy if exists lecture_manager_meme_site on public.planning_generations;
drop policy if exists ecriture_manager_meme_site on public.planning_generations;
create policy lecture_manager_meme_site on public.planning_generations for select to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.planning_generations for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- planning_regles_effectif
drop policy if exists lecture_meme_site on public.planning_regles_effectif;
drop policy if exists ecriture_manager_meme_site on public.planning_regles_effectif;
drop policy if exists modification_manager_meme_site on public.planning_regles_effectif;
drop policy if exists suppression_manager_meme_site on public.planning_regles_effectif;
create policy lecture_meme_site on public.planning_regles_effectif for select to authenticated
  using (site_id = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.planning_regles_effectif for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.planning_regles_effectif for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.planning_regles_effectif for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- planning_shifts
drop policy if exists lecture_brouillon_manager_meme_site on public.planning_shifts;
drop policy if exists lecture_publie_meme_site on public.planning_shifts;
drop policy if exists ecriture_manager_meme_site on public.planning_shifts;
drop policy if exists modification_manager_meme_site on public.planning_shifts;
drop policy if exists suppression_manager_meme_site on public.planning_shifts;
create policy select_planning_shifts on public.planning_shifts for select to authenticated
  using (
    (site_id = (select current_employee_site_id()) and (select current_employee_role()) = any(array['manager','gerant']))
    or (site_id = (select current_employee_site_id()) and publie = true)
  );
create policy ecriture_manager_meme_site on public.planning_shifts for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.planning_shifts for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.planning_shifts for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()));
-- pointages
drop policy if exists createur_lit_si_autorise on public.pointages;
drop policy if exists select_all_pointage_manager on public.pointages;
drop policy if exists select_own_pointage on public.pointages;
drop policy if exists insert_own_pointage on public.pointages;
create policy select_pointages on public.pointages for select to authenticated
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = pointages.site and s.acces_createur_autorise = true))
  );
create policy insert_own_pointage on public.pointages for insert to authenticated
  with check (employee_id = (select auth.uid()));
-- product_locations
drop policy if exists lecture_meme_site on public.product_locations;
drop policy if exists ecriture_manager_meme_site on public.product_locations;
drop policy if exists modification_manager_meme_site on public.product_locations;
drop policy if exists suppression_manager_meme_site on public.product_locations;
create policy lecture_meme_site on public.product_locations for select to authenticated
  using (site = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.product_locations for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.product_locations for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.product_locations for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- product_photos
drop policy if exists lecture_meme_site on public.product_photos;
drop policy if exists ecriture_manager_meme_site on public.product_photos;
drop policy if exists modification_manager_meme_site on public.product_photos;
drop policy if exists suppression_manager_meme_site on public.product_photos;
create policy lecture_meme_site on public.product_photos for select to authenticated
  using (site = (select current_employee_site_id()));
create policy ecriture_manager_meme_site on public.product_photos for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy modification_manager_meme_site on public.product_photos for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.product_photos for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- products
drop policy if exists authenticated_reads_products on public.products;
drop policy if exists createur_lit_si_autorise on public.products;
drop policy if exists manager_writes_products on public.products;
drop policy if exists manager_deletes_products on public.products;
create policy select_products on public.products for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = products.site and s.acces_createur_autorise = true))
  );
create policy manager_writes_products on public.products for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy manager_deletes_products on public.products for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- produits_appel
drop policy if exists manager_manages_produits_appel on public.produits_appel;
drop policy if exists authenticated_reads_produits_appel on public.produits_appel;
drop policy if exists createur_lit_si_autorise on public.produits_appel;
create policy select_produits_appel on public.produits_appel for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = produits_appel.site and s.acces_createur_autorise = true))
  );
create policy manager_insert_produits_appel on public.produits_appel for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy manager_update_produits_appel on public.produits_appel for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()))
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy manager_delete_produits_appel on public.produits_appel for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- recommandations_validees
drop policy if exists createur_lit_si_autorise on public.recommandations_validees;
drop policy if exists lecture_meme_site on public.recommandations_validees;
drop policy if exists ecriture_manager_meme_site on public.recommandations_validees;
drop policy if exists suppression_manager_meme_site on public.recommandations_validees;
create policy select_recommandations_validees on public.recommandations_validees for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = recommandations_validees.site and s.acces_createur_autorise = true))
  );
create policy ecriture_manager_meme_site on public.recommandations_validees for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy suppression_manager_meme_site on public.recommandations_validees for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- role_changes
drop policy if exists employee_own_role_changes_select on public.role_changes;
drop policy if exists manager_sees_all_role_changes on public.role_changes;
drop policy if exists employee_own_role_changes_insert on public.role_changes;
create policy select_role_changes on public.role_changes for select to public
  using (
    employee_id = (select auth.uid())
    or (select current_employee_role()) = any(array['manager','gerant'])
  );
create policy employee_own_role_changes_insert on public.role_changes for insert to public
  with check (employee_id = (select auth.uid()));
-- shifts
drop policy if exists createur_lit_si_autorise on public.shifts;
drop policy if exists employee_own_shifts_select on public.shifts;
drop policy if exists manager_sees_all_shifts on public.shifts;
drop policy if exists employee_own_shifts_insert on public.shifts;
drop policy if exists employee_own_shifts_update on public.shifts;
drop policy if exists manager_updates_all_shifts on public.shifts;
create policy select_shifts on public.shifts for select to public
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = shifts.site_id and s.acces_createur_autorise = true))
  );
create policy employee_own_shifts_insert on public.shifts for insert to authenticated
  with check (
    employee_id = (select auth.uid())
    and (role <> all(array['manager','gerant']) or (select current_employee_role()) = any(array['manager','gerant']))
  );
create policy update_shifts on public.shifts for update to public
  using (
    employee_id = (select auth.uid())
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
  )
  with check (
    (employee_id = (select auth.uid()) and (role <> all(array['manager','gerant']) or (select current_employee_role()) = any(array['manager','gerant'])))
    or ((select current_employee_role()) = any(array['manager','gerant']) and site_id = (select current_employee_site_id()))
  );
-- sites
drop policy if exists modifier_sites_createur on public.sites;
create policy createur_insert_sites on public.sites for insert to authenticated
  with check ((select je_suis_createur()));
create policy createur_update_sites on public.sites for update to authenticated
  using ((select je_suis_createur()))
  with check ((select je_suis_createur()));
create policy createur_delete_sites on public.sites for delete to authenticated
  using ((select je_suis_createur()));
-- station_config
drop policy if exists createur_lit_si_autorise on public.station_config;
drop policy if exists select_station_config on public.station_config;
drop policy if exists upsert_station_config_manager on public.station_config;
drop policy if exists update_station_config_manager on public.station_config;
create policy select_station_config on public.station_config for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = station_config.site and s.acces_createur_autorise = true))
  );
create policy upsert_station_config_manager on public.station_config for insert to authenticated
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])) and site = (select current_employee_site_id()));
create policy update_station_config_manager on public.station_config for update to authenticated
  using (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])) and site = (select current_employee_site_id()))
  with check (exists (select 1 from employees e where e.id = (select auth.uid()) and e.role = any(array['manager','gerant'])) and site = (select current_employee_site_id()));
-- stock_releves
drop policy if exists authenticated_reads_stock_releves on public.stock_releves;
drop policy if exists createur_lit_si_autorise on public.stock_releves;
drop policy if exists manager_writes_stock_releves on public.stock_releves;
drop policy if exists manager_updates_stock_releves on public.stock_releves;
drop policy if exists manager_deletes_stock_releves on public.stock_releves;
create policy select_stock_releves on public.stock_releves for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = stock_releves.site and s.acces_createur_autorise = true))
  );
create policy manager_writes_stock_releves on public.stock_releves for insert to authenticated
  with check ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy manager_updates_stock_releves on public.stock_releves for update to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
create policy manager_deletes_stock_releves on public.stock_releves for delete to authenticated
  using ((select current_employee_role()) = any(array['manager','gerant']) and site = (select current_employee_site_id()));
-- stock_sante_historique
drop policy if exists authenticated_reads_stock_sante on public.stock_sante_historique;
drop policy if exists createur_lit_si_autorise on public.stock_sante_historique;
drop policy if exists authenticated_inserts_stock_sante on public.stock_sante_historique;
create policy select_stock_sante_historique on public.stock_sante_historique for select to authenticated
  using (
    site = (select current_employee_site_id())
    or ((select je_suis_createur()) and exists (select 1 from sites s where s.site_id = stock_sante_historique.site and s.acces_createur_autorise = true))
  );
create policy authenticated_inserts_stock_sante on public.stock_sante_historique for insert to authenticated
  with check (site = (select current_employee_site_id()));
