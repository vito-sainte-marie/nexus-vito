-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260902183734 · indexer_cles_etrangeres_nexus_paye
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Indexes de couverture recommandés par l'advisor Supabase pour les FK PAYE.
create index if not exists idx_nexus_paye_settings_updated_by
  on public.nexus_paye_employee_settings(updated_by);
create index if not exists idx_nexus_paye_items_employee
  on public.nexus_paye_items(employee_id);
create index if not exists idx_nexus_paye_items_cree_par
  on public.nexus_paye_items(cree_par);
create index if not exists idx_nexus_paye_items_modifie_par
  on public.nexus_paye_items(modifie_par);
create index if not exists idx_nexus_paye_periodes_verifie_par
  on public.nexus_paye_periodes(verifie_par);
create index if not exists idx_nexus_paye_periodes_transmis_par
  on public.nexus_paye_periodes(transmis_par);
