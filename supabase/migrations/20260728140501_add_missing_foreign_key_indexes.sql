-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260728140501 · add_missing_foreign_key_indexes
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

create index if not exists idx_advisor_feedback_advisor_message_id on public.advisor_feedback(advisor_message_id);
create index if not exists idx_advisor_feedback_manager_id on public.advisor_feedback(manager_id);
create index if not exists idx_advisor_feedback_site_id on public.advisor_feedback(site_id);
create index if not exists idx_advisor_messages_rule_id on public.advisor_messages(rule_id);
create index if not exists idx_advisor_rules_message_template_id on public.advisor_rules(message_template_id);
create index if not exists idx_advisor_rules_site_id on public.advisor_rules(site_id);
create index if not exists idx_audits_caisse_employee_id on public.audits_caisse(employee_id);
create index if not exists idx_campagnes_nexus_cree_par on public.campagnes_nexus(cree_par);
create index if not exists idx_campagnes_nexus_imports_importe_par on public.campagnes_nexus_imports(importe_par);
create index if not exists idx_campagnes_nexus_imports_site on public.campagnes_nexus_imports(site);
create index if not exists idx_controles_stock_controle_par on public.controles_stock(controle_par);
create index if not exists idx_controles_tenue_controleur_id on public.controles_tenue(controleur_id);
create index if not exists idx_employee_contraintes_site_id on public.employee_contraintes(site_id);
create index if not exists idx_employee_indisponibilites_cree_par on public.employee_indisponibilites(cree_par);
create index if not exists idx_employee_indisponibilites_employee_id on public.employee_indisponibilites(employee_id);
create index if not exists idx_employee_indisponibilites_site_id on public.employee_indisponibilites(site_id);
create index if not exists idx_employees_site_id on public.employees(site_id);
create index if not exists idx_evaluations_employes_evaluateur_id on public.evaluations_employes(evaluateur_id);
create index if not exists idx_journal_decisions_employee_id on public.journal_decisions(employee_id);
create index if not exists idx_marge_exceptions_ajoute_par on public.marge_exceptions(ajoute_par);
create index if not exists idx_mission_assignments_assigned_by_employee_id on public.mission_assignments(assigned_by_employee_id);
create index if not exists idx_mission_assignments_assigned_to_employee_id on public.mission_assignments(assigned_to_employee_id);
create index if not exists idx_mission_assignments_site_id on public.mission_assignments(site_id);
create index if not exists idx_mission_catalog_site_id on public.mission_catalog(site_id);
create index if not exists idx_mission_completions_ajuste_par on public.mission_completions(ajuste_par);
create index if not exists idx_mission_completions_employee_id on public.mission_completions(employee_id);
create index if not exists idx_mission_completions_site_id on public.mission_completions(site_id);
create index if not exists idx_mission_progress_site_id on public.mission_progress(site_id);
create index if not exists idx_panier_moyen_quotidien_importe_par on public.panier_moyen_quotidien(importe_par);
create index if not exists idx_planning_generations_genere_par on public.planning_generations(genere_par);
create index if not exists idx_planning_generations_site_id on public.planning_generations(site_id);
create index if not exists idx_planning_regles_effectif_site_id on public.planning_regles_effectif(site_id);
create index if not exists idx_planning_shifts_genere_par on public.planning_shifts(genere_par);
create index if not exists idx_planning_shifts_modifie_par on public.planning_shifts(modifie_par);
create index if not exists idx_planning_shifts_site_id on public.planning_shifts(site_id);
create index if not exists idx_product_locations_assigne_par on public.product_locations(assigne_par);
create index if not exists idx_product_photos_verifie_par on public.product_photos(verifie_par);
create index if not exists idx_products_imported_by on public.products(imported_by);
create index if not exists idx_produits_appel_ajoute_par on public.produits_appel(ajoute_par);
create index if not exists idx_recommandations_validees_employee_id on public.recommandations_validees(employee_id);
create index if not exists idx_role_changes_employee_id on public.role_changes(employee_id);
create index if not exists idx_role_changes_shift_id on public.role_changes(shift_id);
create index if not exists idx_shifts_employee_id on public.shifts(employee_id);
create index if not exists idx_shifts_site_id on public.shifts(site_id);
create index if not exists idx_stock_releves_importe_par on public.stock_releves(importe_par);
