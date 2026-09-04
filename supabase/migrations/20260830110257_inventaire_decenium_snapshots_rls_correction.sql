-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830110257 · inventaire_decenium_snapshots_rls_correction
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.

-- Correctif immédiat (Article 5) : la politique posée dans la migration
-- précédente ("using(true) with check(true)") était un placeholder sans
-- isolation réelle. Alignée ici sur le même modèle RLS déjà appliqué à
-- inventaire_rapprochements (rôle manager/gerant + site courant),
-- vérifié directement sur la politique réelle de cette table avant
-- correction (Article 11 : jamais un modèle de sécurité réinventé).
drop policy if exists inventaire_decenium_snapshots_site_isolation on public.inventaire_decenium_snapshots;

create policy select_inventaire_decenium_snapshots on public.inventaire_decenium_snapshots
  for select
  using (
    (select current_employee_role()) = any (array['manager'::text, 'gerant'::text])
    and site = (select current_employee_site_id())
  );

create policy ecriture_inventaire_decenium_snapshots on public.inventaire_decenium_snapshots
  for all
  using (
    (select current_employee_role()) = any (array['manager'::text, 'gerant'::text])
    and site = (select current_employee_site_id())
  )
  with check (
    (select current_employee_role()) = any (array['manager'::text, 'gerant'::text])
    and site = (select current_employee_site_id())
  );
