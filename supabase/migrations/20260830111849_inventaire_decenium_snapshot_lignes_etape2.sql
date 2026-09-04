-- Récupérée depuis supabase_migrations.schema_migrations du projet de production
-- le 04/09/2026. Version 20260830111849 · inventaire_decenium_snapshot_lignes_etape2
--
-- Ces migrations avaient été appliquées via le tableau de bord ou l'API et
-- n'existaient dans AUCUN fichier du dépôt : c'est ce qui empêchait toute
-- reconstruction complète du schéma.


create table public.inventaire_decenium_snapshot_lignes (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.inventaire_decenium_snapshots(id),
  site text not null,
  produit_id uuid null,
  designation_brute text not null,
  code_barres_brut text null,
  quantite_stock numeric not null,
  prix_achat_ht numeric null,
  importe_par uuid null,
  importe_le timestamptz not null default now()
);

create index idx_inventaire_decenium_snapshot_lignes_snapshot on public.inventaire_decenium_snapshot_lignes(snapshot_id);

alter table public.inventaire_decenium_snapshot_lignes enable row level security;

create policy select_inventaire_decenium_snapshot_lignes on public.inventaire_decenium_snapshot_lignes
  for select
  using (current_employee_role() = ANY(array['manager','gerant']) and site = current_employee_site_id());

create policy ecriture_inventaire_decenium_snapshot_lignes on public.inventaire_decenium_snapshot_lignes
  for all
  using (current_employee_role() = ANY(array['manager','gerant']) and site = current_employee_site_id())
  with check (current_employee_role() = ANY(array['manager','gerant']) and site = current_employee_site_id());
